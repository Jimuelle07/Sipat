// Demo seed data. NOT official content: every name, place label, center, contact and bulletin here
// is invented for demos and marked "DEMO". The PSGC codes are real (from content/places.json) so the
// household sits in a real barangay; the coordinates are rough demo approximations, not surveyed
// centroids. Documented in docs/seed_data.md.
import type {
  Bulletin, ChecklistTick, ContentFileName, EvacuationCenter, FeedCache, ImportPreview, Member, Place,
  PlacesFile, Profile, Result, Source, StoreSchema, UpdateClient, UpdateError,
} from '../types/index.ts';
import { deriveHousehold } from '../core/deriveHousehold.ts';
import { toManilaIso } from '../core/time.ts';

/** On only when the build sets `EXPO_PUBLIC_DEMO_SEED=1` (Expo inlines it; Node reads the env). */
export function demoSeedEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DEMO_SEED === '1';
}

export const DEMO_SOURCE_ID = 'demo-seed';
export const DEMO_PROFILE_ID = 'demo-household';
// Real PSGC codes: Barangay Libertad, City of Tacloban, Leyte, Region VIII.
export const DEMO_BARANGAY_PSGC = '083747010';
const DEMO_CITY_PSGC = '083747000';
const DEMO_PROVINCE_PSGC = '083700000';
const EASTERN_SAMAR_PSGC = '082600000';

// Rough demo coordinates around Tacloban City, for distances and the storm card only.
const DEMO_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  [DEMO_BARANGAY_PSGC]: { lat: 11.2417, lon: 125.0036 },
  [DEMO_CITY_PSGC]: { lat: 11.2440, lon: 125.0039 },
  [DEMO_PROVINCE_PSGC]: { lat: 10.8500, lon: 124.8800 },
};

const DEMO_SOURCE: Source = {
  id: DEMO_SOURCE_ID,
  agency: 'Sipat (DEMO)',
  title: 'DEMO seed data – hindi opisyal, para sa demo lamang',
  date: '2026-10-10',
  url: 'https://example.invalid/sipat-demo',
  retrieved_at: '2026-10-10',
  notes: 'Invented for demos. Not from PAGASA, NDRRMC, an LGU or any agency.',
};

const DEMO_CENTERS: Omit<EvacuationCenter, 'updated_at'>[] = [
  {
    id: 'demo-center-school', name: 'DEMO Paaralang Sentral (evacuation center)', psgc: DEMO_BARANGAY_PSGC,
    coords: { lat: 11.2448, lon: 125.0012 }, landmark: 'DEMO – tapat ng plaza', capacity: 300, accessible: true,
    accepts_pets: false, origin: 'lgu', source_id: DEMO_SOURCE_ID, reviewed_by: 'DEMO – walang tunay na reviewer',
    reviewed_at: '2026-10-10',
  },
  {
    id: 'demo-center-gym', name: 'DEMO Covered Court ng Barangay', psgc: DEMO_BARANGAY_PSGC,
    coords: { lat: 11.2385, lon: 125.0071 }, landmark: 'DEMO – katabi ng barangay hall', capacity: 150, accessible: true,
    accepts_pets: true, origin: 'lgu', source_id: DEMO_SOURCE_ID, reviewed_by: 'DEMO – walang tunay na reviewer',
    reviewed_at: '2026-10-10',
  },
  {
    id: 'demo-center-church', name: 'DEMO Parish Hall', psgc: DEMO_CITY_PSGC,
    coords: { lat: 11.2551, lon: 124.9987 }, landmark: 'DEMO – likod ng simbahan', capacity: 120, accessible: false,
    accepts_pets: false, origin: 'lgu', source_id: DEMO_SOURCE_ID, reviewed_by: 'DEMO – walang tunay na reviewer',
    reviewed_at: '2026-10-10',
  },
];

/** Content files merged over the bundled ones: the demo source, centroids for the demo area, and centers. */
export function demoContent(raw: Partial<Record<ContentFileName, unknown>>, at: string): Partial<Record<ContentFileName, unknown>> {
  const sources = raw['sources.json'] as { items: Source[] } & Record<string, unknown>;
  const places = raw['places.json'] as PlacesFile;
  const withCentroids: Place[] = places.items.map((place) => {
    const centroid = DEMO_CENTROIDS[place.psgc];
    return centroid ? { ...place, centroid } : place;
  });
  return {
    'sources.json': { ...sources, items: [...sources.items.filter((s) => s.id !== DEMO_SOURCE_ID), DEMO_SOURCE] },
    'places.json': { ...places, items: withCentroids },
    'evacuation_centers.json': {
      schema_version: 1, content_version: 1, generated_at: at,
      items: DEMO_CENTERS.map((center) => ({ ...center, updated_at: at })),
    },
  };
}

function demoMember(id: string, fields: Omit<Member, 'id' | 'photoStatus' | 'updatedAt'>, at: string): Member {
  return { id, ...fields, photoStatus: 'pending', updatedAt: at };
}

function demoProfile(at: string): Profile {
  const people: Member[] = [
    demoMember('demo-member-maria', { name: 'Maria (DEMO)', relation: 'self', ageGroup: 'adult', needs: [], phone: '09170000001' }, at),
    demoMember('demo-member-jose', { name: 'Jose (DEMO)', relation: 'spouse', ageGroup: 'adult', needs: [] }, at),
    demoMember('demo-member-lola', {
      name: 'Lola Ising (DEMO)', relation: 'parent', ageGroup: 'senior', needs: ['maintenance_meds', 'pwd'],
      note: 'DEMO – gamot sa altapresyon, gumagamit ng tungkod',
    }, at),
    demoMember('demo-member-mika', { name: 'Mika (DEMO)', relation: 'child', ageGroup: 'child', needs: [] }, at),
    demoMember('demo-member-joy', { name: 'Baby Joy (DEMO)', relation: 'child', ageGroup: 'infant', needs: [] }, at),
  ];
  const petsCount = 1;
  return {
    id: DEMO_PROFILE_ID,
    name: 'Bahay nina Maria (DEMO)',
    ownerId: 'demo-member-maria',
    people,
    petsCount,
    ...deriveHousehold(people, petsCount),
    home: ['near_sea', 'light_materials', 'low_lying'],
    location: { psgc: DEMO_BARANGAY_PSGC },
    plan: {
      evacuationCenter: 'DEMO Paaralang Sentral (evacuation center)',
      evacuationCenterId: 'demo-center-school',
      meetingPlace: 'DEMO – harap ng barangay hall',
      contacts: [
        { name: 'Tito Ben (DEMO)', phone: '09170000002', relation: 'Tito' },
        { name: 'Ate Liza (DEMO)', phone: '09170000003', relation: 'Kapitbahay' },
      ],
    },
    updatedAt: at,
  };
}

const minutesAgo = (now: Date, minutes: number) => toManilaIso(new Date(now.getTime() - minutes * 60_000));
const hoursAhead = (now: Date, hours: number) => toManilaIso(new Date(now.getTime() + hours * 3_600_000));

/** A recent, fictional bulletin: a DEMO typhoon east of Leyte with TCWS 2 over Leyte. Timestamps follow `now`. */
export function demoFeed(now: Date): FeedCache {
  const issuedAt = minutesAgo(now, 45);
  const fetchedAt = minutesAgo(now, 5);
  const bulletin: Bulletin = {
    id: 'demo-bulletin-1',
    stormId: 'demo-storm-1',
    source: {
      agency: 'PAGASA',
      title: 'DEMO – hindi totoong Tropical Cyclone Bulletin (para sa demo lamang)',
      url: 'https://example.invalid/demo-bulletin',
    },
    issuedAt,
    scrapedAt: minutesAgo(now, 40),
    fetchedAt,
    storm: { name: 'Bagyong Demo', internationalName: 'DEMO', category: 'TY' },
    position: { lat: 11.6, lon: 127.4, at: issuedAt, text: 'DEMO – mga 260 km silangan ng Tacloban City (hindi totoo)' },
    movement: { text: 'DEMO – kumikilos pakanluran (hindi totoo)' },
    forecast: [
      { lat: 11.5, lon: 126.3, at: hoursAhead(now, 12) },
      { lat: 11.3, lon: 125.1, at: hoursAhead(now, 24) },
      { lat: 11.4, lon: 123.8, at: hoursAhead(now, 36) },
    ],
    signalAreas: [
      { level: 2, psgc: [DEMO_PROVINCE_PSGC, EASTERN_SAMAR_PSGC] },
    ],
    final: false,
    text: 'DEMO LAMANG – hindi ito totoong bulletin ng PAGASA. Bagyong Demo, typhoon, kumikilos pakanluran. '
      + 'Signal No. 2 sa Leyte at Eastern Samar (DEMO).',
  };
  return { sequence: 1, issuedAt, serverStale: false, bulletins: [bulletin], fetchedAt, checkedAt: fetchedAt };
}

/** Store entries for a first launch: the household, a few checklist ticks and the cached demo feed. */
export function demoStore(now: Date): Pick<StoreSchema, 'profiles' | 'feed'> & {
  activeProfileId: string;
  checklist: Record<string, ChecklistTick>;
} {
  const at = toManilaIso(now);
  const tick: ChecklistTick = { ticked: true, updatedAt: at };
  return {
    profiles: [demoProfile(at)],
    activeProfileId: DEMO_PROFILE_ID,
    feed: demoFeed(now),
    checklist: { 'now-listen-radio': tick, 'gobag-water': tick, 'gobag-food': tick, 'gobag-flashlight-batteries': tick },
  };
}

const disabled = <T>(): Result<T, UpdateError> => ({ ok: false, error: { code: 'disabled', message: 'Demo mode has no server' } });

/**
 * In-memory stand-in for UpdateClient in demo mode: pull to refresh re-issues the demo feed with
 * fresh timestamps. It makes no request and writes nothing to the network log.
 */
export function createDemoUpdateClient(now: () => Date): UpdateClient {
  return {
    fetchFeed: async () => ({ ok: true, value: demoFeed(now()) }),
    fetchCenters: async () => ({ ok: true, value: 'unchanged' as const }),
    check: async () => ({ ok: true, value: null }),
    download: async () => disabled<ImportPreview>(),
  };
}
