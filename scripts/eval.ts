import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AnswerReport,
  EvalQuestion,
  EvalSummary,
  ModelManager,
  PhaseCase,
  RetrievalReport,
} from '../app/types/index.ts';
import { loadBundledContent } from '../app/content/index.ts';
import { createEvalRunner } from '../app/core/evalRunner.ts';
import { normalize } from '../app/core/normalize.ts';
import { route } from '../app/core/route.ts';
import { toManilaIso } from '../app/core/time.ts';

const evalDir = fileURLToPath(new URL('../eval/', import.meta.url));

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(evalDir, name), 'utf8')) as T;
}

function modelPathFromArgs(argv: string[]): string | null {
  const index = argv.indexOf('--model');
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

/** Best-effort adapter for a laptop GGUF; null when llama.rn cannot run in Node. */
async function loadNodeModel(path: string): Promise<Pick<ModelManager, 'generate'> | null> {
  try {
    const { createModelManager, defaultLlamaBackend } = await import('../app/services/model.ts');
    const backend = defaultLlamaBackend();
    if (!backend) return null;
    const size = statSync(path).size;
    const files = {
      freeBytes: async () => Number.MAX_SAFE_INTEGER,
      exists: async (p: string) => existsSync(p),
      size: async (p: string) => (existsSync(p) ? statSync(p).size : null),
      copyWithSha256: async () => { throw new Error('unsupported in eval'); },
      remove: async () => undefined,
      move: async () => { throw new Error('unsupported in eval'); },
    };
    return createModelManager({
      backend,
      files,
      modelDir: dirname(resolve(path)),
      readTier: async () => 'full',
      idleUnloadMs: 0,
      expected: { file_name: basename(path), size, sha256: '' },
    });
  } catch {
    return null;
  }
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  const loaded = loadBundledContent();
  if (!loaded.ok) {
    console.error(`Content invalid: ${loaded.error.message}`);
    process.exit(1);
  }
  const content = loaded.value;
  const questions = readJson<EvalQuestion[]>('questions.tl.json');
  const phaseCases = readJson<PhaseCase[]>('phase_cases.json');

  const runner = createEvalRunner({ content, now: () => new Date() });

  const retrieval: RetrievalReport = runner.runRetrieval(questions);
  const phase = runner.runPhase(phaseCases);

  const liveQuestions = questions.filter((q) => q.expect.route === 'live_data');
  const liveHit = liveQuestions.filter((q) => route(normalize(q.text, content.synonyms), content.rules).primary === 'live_data').length;
  const liveDataReply = liveQuestions.length === 0 ? 0 : liveHit / liveQuestions.length;

  let answers: AnswerReport | null = null;
  const modelPath = modelPathFromArgs(process.argv.slice(2));
  if (!modelPath) {
    console.log('Answers: skipped — pass --model <path.gguf> to run generation on this machine.');
  } else if (!existsSync(modelPath)) {
    console.log(`Answers: skipped — model file not found at ${modelPath}`);
  } else {
    const model = await loadNodeModel(modelPath);
    if (!model) {
      console.log('Answers: skipped — llama.rn is not usable in Node (no native backend).');
    } else {
      console.log(`Answers: running generation on ${modelPath} ...`);
      answers = await runner.runAnswers(questions, model);
    }
  }

  const summary: EvalSummary = {
    generatedAt: toManilaIso(new Date()),
    retrieval: {
      hitAt2: retrieval.hitAt2,
      correctRefusal: retrieval.correctRefusal,
      emergencyTrigger: retrieval.emergencyTrigger,
      liveDataReply,
    },
    answers: { faithfulness: null, numberCheckPass: answers?.numberCheckPass ?? 0 },
    phase: { casesPassed: phase.passed, casesTotal: phase.total, wrongDirection: phase.wrongDirection },
    device: {},
  };

  const outDir = resolve(evalDir, 'results');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'latest.json');
  writeFileSync(outPath, `${JSON.stringify({ summary, retrieval, answers, phase }, null, 2)}\n`);

  console.log(`Retrieval  hit@2 ${pct(retrieval.hitAt2)}  refusal ${pct(retrieval.correctRefusal)}  emergency ${pct(retrieval.emergencyTrigger)}  route ${pct(retrieval.routeAccuracy)}  phaseCue ${pct(retrieval.phaseCueAccuracy)}`);
  console.log(`Live-data  ${pct(liveDataReply)} of ${liveQuestions.length}`);
  console.log(`Phase      ${phase.passed}/${phase.total} passed  wrongDirection ${phase.wrongDirection}`);
  if (answers) {
    console.log(`Answers    numberCheck ${pct(answers.numberCheckPass)}  hint emitted ${answers.phaseHint.emitted} (accepted ${answers.phaseHint.accepted}, dropped ${answers.phaseHint.dropped})  p50 ${answers.latencyMs.p50}ms  p90 ${answers.latencyMs.p90}ms`);
  }
  if (retrieval.failures.length > 0) {
    console.log(`Retrieval failures (${retrieval.failures.length}): ${retrieval.failures.map((f) => f.id).join(', ')}`);
  }
  if (phase.failures.length > 0) console.log(`Phase failures: ${phase.failures.join(', ')}`);
  console.log(`Wrote ${outPath}`);
}

void main();
