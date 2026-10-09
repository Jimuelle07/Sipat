/**
 * Generates the root, pack and feed Ed25519 key pairs used by the publish
 * pipeline (docs/system-design.md "Trust chain", docs/api-layer.md section 10).
 *
 * The root key signs only `out/v1/keys.json`; the pack key signs pack manifests
 * offline; the feed key signs the feed manifest from the scraper job. Private
 * keys land in `keys/{name}.private.json` and must never be committed.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KeySet } from '../app/types/index.ts';
import { generateKeyPair, signEd25519, signedBytes } from '../app/core/signature.ts';
import {
  keyPath,
  manilaIso,
  manilaYear,
  oneYearAfter,
  parseArgs,
  writeJson,
  type KeyName,
  type PrivateKeyFile,
} from './lib/publish.ts';

export interface GenerateKeysOptions {
  keysDir: string;
  outDir: string;
  notBefore: string;
  notAfter: string;
  version: number;
  kids: Record<KeyName, string>;
  force?: boolean;
}

export interface GenerateKeysResult {
  keySet: KeySet;
  rootKid: string;
  rootPublicKey: string;
  written: string[];
  keysJsonPath: string;
}

const KEY_NAMES: KeyName[] = ['root', 'pack', 'feed'];

export function generateKeys(opts: GenerateKeysOptions): GenerateKeysResult {
  if (!opts.force) {
    for (const name of KEY_NAMES) {
      const path = keyPath(opts.keysDir, name);
      if (existsSync(path)) {
        throw new Error(`refusing to overwrite ${path}; pass --force to rotate keys`);
      }
    }
  }

  const pairs: Record<KeyName, { privateKey: string; publicKey: string }> = {
    root: generateKeyPair(),
    pack: generateKeyPair(),
    feed: generateKeyPair(),
  };

  const written: string[] = [];
  for (const name of KEY_NAMES) {
    const pair = pairs[name];
    const file: PrivateKeyFile = {
      kid: opts.kids[name],
      alg: 'Ed25519',
      private_key: pair.privateKey,
      public_key: pair.publicKey,
    };
    const path = keyPath(opts.keysDir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeJson(path, file);
    written.push(path);
  }

  const base: Omit<KeySet, 'signature'> = {
    schema_version: 1,
    version: opts.version,
    keys: [
      {
        kid: opts.kids.pack,
        alg: 'Ed25519',
        public_key: pairs.pack.publicKey,
        purpose: 'pack',
        scope: ['core', 'area', 'model'],
        not_before: opts.notBefore,
        not_after: opts.notAfter,
      },
      {
        kid: opts.kids.feed,
        alg: 'Ed25519',
        public_key: pairs.feed.publicKey,
        purpose: 'feed',
        not_before: opts.notBefore,
        not_after: opts.notAfter,
      },
    ],
  };

  const sig = signEd25519(pairs.root.privateKey, signedBytes(base));
  const keySet: KeySet = {
    ...base,
    signature: { kid: opts.kids.root, alg: 'Ed25519', sig },
  };

  const keysJsonPath = join(opts.outDir, 'keys.json');
  writeJson(keysJsonPath, keySet);

  return {
    keySet,
    rootKid: opts.kids.root,
    rootPublicKey: pairs.root.publicKey,
    written,
    keysJsonPath,
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const keysDir = args.value('keys') ?? 'keys';
  const outDir = args.value('out') ?? 'out/v1';
  const now = new Date();
  const year = manilaYear(now);

  const notBefore = args.value('not-before') ?? manilaIso(now);
  const notAfter = args.value('not-after') ?? manilaIso(oneYearAfter(now));
  const version = Number(args.value('version') ?? '1');
  if (!Number.isInteger(version) || version < 1) throw new Error('--version must be a positive integer');

  const kids: Record<KeyName, string> = {
    root: args.value('kid-root') ?? `root-${year}a`,
    pack: args.value('kid-pack') ?? `pack-${year}a`,
    feed: args.value('kid-feed') ?? `feed-${year}a`,
  };

  const result = generateKeys({
    keysDir,
    outDir,
    notBefore,
    notAfter,
    version,
    kids,
    force: args.flag('force'),
  });

  console.log(`wrote ${result.written.length} private key files under ${keysDir}/`);
  console.log(`wrote ${result.keysJsonPath} (version ${result.keySet.version}, not_after ${notAfter})`);
  console.log('');
  console.log('Paste this line into app/core/pinnedKeys.ts:');
  console.log(`  { kid: '${result.rootKid}', public_key: '${result.rootPublicKey}' },`);
  console.log('');
  console.log('Reminder: keys/ and out/ hold private keys and must stay out of git.');
  console.log('Add them to .gitignore if they are not already ignored.');
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
