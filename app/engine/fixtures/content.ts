// Placeholder fixture data for the mock engine and tests. Not official content.
import type {
  ChecklistItem,
  Hotline,
  IntentRules,
  Passage,
  PhaseRules,
  Place,
  PlacesFile,
  Source,
  WarningEntry,
} from '../../types/index.ts';

const AT_DATE = '2026-10-09';
const AT_ISO = '2026-10-09T00:00:00+08:00';

export const FIXTURE_SOURCES: Source[] = [
  {
    id: 'src-ndrrmc-sample',
    agency: 'NDRRMC',
    title: 'SAMPLE – gabay sa paghahanda (placeholder)',
    date: AT_DATE,
    url: 'https://example.invalid/sources/ndrrmc-sample',
    retrieved_at: AT_DATE,
  },
  {
    id: 'src-pagasa-sample',
    agency: 'PAGASA',
    title: 'SAMPLE – gabay sa babala (placeholder)',
    date: AT_DATE,
    url: 'https://example.invalid/sources/pagasa-sample',
    retrieved_at: AT_DATE,
  },
  {
    id: 'src-doh-sample',
    agency: 'DOH',
    title: 'SAMPLE – gabay sa kalusugan (placeholder)',
    date: AT_DATE,
    url: 'https://example.invalid/sources/doh-sample',
    retrieved_at: AT_DATE,
  },
  {
    id: 'src-psa-sample',
    agency: 'PSA',
    title: 'SAMPLE – listahan ng lugar (placeholder)',
    date: AT_DATE,
    url: 'https://example.invalid/sources/psa-sample',
    retrieved_at: AT_DATE,
  },
];

function anyWarnings(): Passage['warnings'] {
  return { tcws: [], rainfall: [], surge: [], gale: false, barangay_order: false };
}

export const FIXTURE_PASSAGES: Passage[] = [
  {
    id: 'before-gobag-01',
    lang: 'tl',
    title: 'Ihanda ang go bag bago ang bagyo',
    topic: 'go_bag',
    phase: ['before'],
    warnings: anyWarnings(),
    profile_tags: [],
    hazards: [],
    critical: false,
    text:
      'Ang go bag ay ang maliit na bag na dadalhin agad kapag kailangang lumikas. Isama ang pangunahing ' +
      'gamit ng buong pamilya: inuming tubig, pagkain, gamot, flashlight, baterya, maliit na radyo, ' +
      'mahahalagang dokumento, at pera. Ihanda ito bago pa dumating ang bagyo at itago sa lugar na madaling ' +
      'abutin. Tiyaking alam ng lahat ng miyembro ng pamilya kung saan ito nakalagay, at suriin ito bago ang ' +
      'tag-ulan. (placeholder: isulat mula sa opisyal na pinagmulan)',
    summary: 'Ihanda ang go bag bago dumating ang bagyo at itago sa madaling abutin.',
    source_id: 'src-ndrrmc-sample',
    locator: '(fill in)',
    reviewed_by: 'SAMPLE Reviewer A',
    reviewed_at: AT_DATE,
    version: 1,
  },
  {
    id: 'before-home-01',
    lang: 'tl',
    title: 'Patibayin ang bahay bago ang bagyo',
    topic: 'home_prep',
    phase: ['before'],
    warnings: anyWarnings(),
    profile_tags: [],
    hazards: ['wind'],
    critical: false,
    text:
      'Bago dumating ang malakas na hangin, tingnan ang bubong at mga bintana. Itali o itago ang mga gamit ' +
      'sa labas na maaaring liparin ng hangin. Putulin ang mga sanga ng punong malapit sa bahay. Siguraduhing ' +
      'sarado ang mga pinto at bintana at patibayin ang mga bahagi ng bahay na maaaring mahina. Ihanda ang ' +
      'mga materyales na maaaring kailanganin sa agarang pagkukumpuni. (placeholder: isulat mula sa opisyal ' +
      'na pinagmulan)',
    summary: 'Patibayin ang bahay at itago ang mga gamit sa labas bago ang malakas na hangin.',
    source_id: 'src-ndrrmc-sample',
    locator: '(fill in)',
    reviewed_by: 'SAMPLE Reviewer A',
    reviewed_at: AT_DATE,
    version: 1,
  },
  {
    id: 'during-flood-river-01',
    lang: 'tl',
    title: 'Kung malapit sa ilog o sapa',
    topic: 'evacuation',
    phase: ['during'],
    warnings: anyWarnings(),
    profile_tags: ['near_river', 'low_lying'],
    hazards: ['flood'],
    critical: true,
    text:
      'Kung malapit ang bahay sa ilog o sapa, bantayan ang pagtaas ng tubig. Kapag tumataas na ang tubig o ' +
      'nagsimula nang bahain ang kalsada, lumikas agad sa mataas at ligtas na lugar. Dalhin ang go bag at ' +
      'ang mga mahahalagang dokumento. Iwasan ang pagtawid sa baha at sa tulay na may malakas na agos. ' +
      'Sundin agad ang utos ng barangay at ng mga awtoridad. (placeholder: isulat mula sa opisyal na ' +
      'pinagmulan)',
    summary: 'Kung malapit sa ilog, maghanda nang lumikas at sumunod agad sa utos ng barangay.',
    source_id: 'src-pagasa-sample',
    locator: '(fill in)',
    reviewed_by: 'SAMPLE Reviewer B',
    reviewed_at: AT_DATE,
    version: 1,
  },
  {
    id: 'during-signals-01',
    lang: 'tl',
    title: 'Ano ang ibig sabihin ng babala sa hangin',
    topic: 'signals',
    phase: ['before', 'during'],
    warnings: anyWarnings(),
    profile_tags: [],
    hazards: ['wind'],
    critical: false,
    text:
      'Ang babala sa hangin ay nagsasabi kung gaano kalakas ang inaasahang hangin sa inyong lugar at kung ' +
      'gaano katagal bago ito dumating. Kapag tumaas ang babala, mas malakas ang hangin at mas kaunting ' +
      'oras ang natitira upang maghanda. Makinig sa radyo at sa mga abiso ng barangay. Itago ang mga gamit ' +
      'sa labas at manatili sa loob ng bahay habang malakas ang hangin. (placeholder: isulat mula sa opisyal ' +
      'na pinagmulan)',
    summary: 'Mas mataas na babala sa hangin, mas malakas ang hangin at mas maikli ang oras maghanda.',
    source_id: 'src-pagasa-sample',
    locator: '(fill in)',
    reviewed_by: 'SAMPLE Reviewer B',
    reviewed_at: AT_DATE,
    version: 1,
  },
  {
    id: 'after-cleanup-01',
    lang: 'tl',
    title: 'Mag-ingat sa paglilinis pagkatapos ng baha',
    topic: 'cleanup',
    phase: ['after'],
    warnings: anyWarnings(),
    profile_tags: [],
    hazards: ['water', 'health'],
    critical: false,
    text:
      'Pagkatapos ng baha, mag-ingat sa maruming tubig at putik. Magsuot ng bota at guwantes kung maglilinis. ' +
      'Hugasan at desimpektahin ang mga bagay na nabasa ng baha bago gamitin. Huwag uminom ng tubig mula sa ' +
      'gripo hanggang sabihin ng kinauukulan na ligtas ito. Pumunta agad sa health center kung may sakit o ' +
      'sugat. (placeholder: isulat mula sa opisyal na pinagmulan)',
    summary: 'Mag-ingat sa maruming tubig at hugasan ang mga bagay na nabasa ng baha bago gamitin.',
    source_id: 'src-doh-sample',
    locator: '(fill in)',
    reviewed_by: 'SAMPLE Reviewer B',
    reviewed_at: AT_DATE,
    version: 1,
  },
];

for (const passage of FIXTURE_PASSAGES) {
  if (!passage.title.startsWith('SAMPLE: ')) passage.title = `SAMPLE: ${passage.title}`;
  if (!passage.summary.startsWith('SAMPLE: ')) passage.summary = `SAMPLE: ${passage.summary}`;
}

export const FIXTURE_CHECKLIST: ChecklistItem[] = [
  {
    id: 'now-listen-radio',
    text: 'Makinig sa radyo at sa mga abiso ng barangay',
    group: 'now',
    phase: ['before', 'during', 'after'],
    priority: 1,
    critical: true,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'gobag-water',
    text: 'Inuming tubig para sa buong pamilya sa go bag',
    group: 'go_bag',
    phase: ['before', 'during'],
    priority: 1,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'gobag-food',
    text: 'Pagkain na hindi agad nasisira',
    group: 'go_bag',
    phase: ['before'],
    priority: 1,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'gobag-meds',
    text: 'Gamot para sa may maintenance na sakit',
    group: 'go_bag',
    phase: ['before'],
    priority: 2,
    critical: false,
    requires_any: ['maintenance_meds'],
    source_id: 'src-doh-sample',
  },
  {
    id: 'home-secure-roof',
    text: 'Itali o itago ang mga gamit sa labas',
    group: 'home',
    phase: ['before', 'during'],
    priority: 1,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'home-clear-drain',
    text: 'Linisin ang kanal at butas ng tubig',
    group: 'home',
    phase: ['before'],
    priority: 2,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'home-docs',
    text: 'Itago sa plastik ang mga dokumento',
    group: 'home',
    phase: ['before'],
    priority: 2,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'evacuate-go-now',
    text: 'Lumikas agad kapag inutusan ng barangay',
    group: 'evacuate',
    phase: ['before', 'during'],
    priority: 1,
    critical: true,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'evacuate-route',
    text: 'Huwag tumawid sa baha o malakas na agos',
    group: 'evacuate',
    phase: ['during'],
    priority: 1,
    critical: true,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'evacuate-go-bag',
    text: 'Dalhin ang go bag at mga dokumento kapag lumikas',
    group: 'evacuate',
    phase: ['during'],
    priority: 2,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'after-check-home',
    text: 'Suriin ang bahay bago pumasok muli',
    group: 'after',
    phase: ['after'],
    priority: 1,
    critical: false,
    source_id: 'src-ndrrmc-sample',
  },
  {
    id: 'after-boil-water',
    text: 'Pakuluin muna ang tubig bago inumin',
    group: 'after',
    phase: ['after'],
    priority: 2,
    critical: false,
    source_id: 'src-doh-sample',
  },
];

for (const item of FIXTURE_CHECKLIST) {
  if (!item.text.startsWith('SAMPLE: ')) item.text = `SAMPLE: ${item.text}`;
}

function warning(
  id: string,
  kind: WarningEntry['kind'],
  level: WarningEntry['level'],
  label: string,
): WarningEntry {
  return {
    id,
    kind,
    level,
    label,
    meaning: '(fill in)',
    actions: ['(fill in)'],
    source_id: kind === 'rainfall' || kind === 'surge' ? 'src-pagasa-sample' : 'src-ndrrmc-sample',
    confirmed: false,
  };
}

export const FIXTURE_WARNINGS: WarningEntry[] = [
  warning('tcws-1', 'tcws', 1, 'Signal No. 1 (placeholder)'),
  warning('tcws-2', 'tcws', 2, 'Signal No. 2 (placeholder)'),
  warning('tcws-3', 'tcws', 3, 'Signal No. 3 (placeholder)'),
  warning('tcws-4', 'tcws', 4, 'Signal No. 4 (placeholder)'),
  warning('tcws-5', 'tcws', 5, 'Signal No. 5 (placeholder)'),
  warning('rainfall-yellow', 'rainfall', 'yellow', 'Yellow na babala sa ulan (placeholder)'),
  warning('rainfall-orange', 'rainfall', 'orange', 'Orange na babala sa ulan (placeholder)'),
  warning('rainfall-red', 'rainfall', 'red', 'Red na babala sa ulan (placeholder)'),
  warning('surge-yellow', 'surge', 'yellow', 'Yellow na babala sa storm surge (placeholder)'),
  warning('surge-orange', 'surge', 'orange', 'Orange na babala sa storm surge (placeholder)'),
  warning('surge-red', 'surge', 'red', 'Red na babala sa storm surge (placeholder)'),
  warning('gale', 'gale', 'on', 'Gale warning (placeholder)'),
  warning('barangay-order', 'barangay_order', 'on', 'Pinapalikas na kami ng barangay (placeholder)'),
];

export const FIXTURE_HOTLINES: Hotline[] = [
  {
    id: 'hotline-sample-1',
    name: '(fill in) national hotline one',
    number: '(fill in)',
    scope: 'national',
    source_id: 'src-ndrrmc-sample',
    verified_at: AT_DATE,
  },
  {
    id: 'hotline-sample-2',
    name: '(fill in) national hotline two',
    number: '(fill in)',
    scope: 'national',
    source_id: 'src-doh-sample',
    verified_at: AT_DATE,
  },
];

export const FIXTURE_INTENTS: IntentRules = {
  emergency: {
    phrases: ['lumulubog', 'may naipit', 'hindi makahinga'],
    card_id: 'emergency-default',
  },
  live_data: {
    phrases: ['nasaan na ang bagyo', 'saan na ang bagyo', 'may pasok ba'],
    reply_key: 'no_live_data',
  },
  medical_dose: {
    phrases: ['ilang tableta', 'dosis', 'ilang mg'],
    reply_key: 'medical_dose',
  },
  plan: {
    evacuation_center: ['saan kami lilikas', 'evacuation center namin'],
    meeting_place: ['saan kami magkikita'],
    contacts: ['numero ni', 'contact namin'],
    hotlines: ['hotline', 'numero ng barangay'],
  },
  phase_cues: {
    before: { strong: ['may paparating na bagyo'], weak: [] },
    during: { strong: ['nandito na ang bagyo', 'na dito'], weak: ['lumalakas na ang hangin'] },
    after: { strong: ['humupa na ang bagyo', 'wala na ang bagyo'], weak: ['tumigil na ang ulan'] },
  },
  emergency_cards: [
    {
      id: 'emergency-default',
      title: 'SAMPLE: Emergency (placeholder)',
      steps: ['(fill in)'],
      hotline_ids: ['hotline-sample-1'],
      source_id: 'src-ndrrmc-sample',
    },
  ],
};

export const FIXTURE_PHASE_RULES: PhaseRules = {
  warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
  bands: {
    near: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
    approach: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
  },
  evacuation_threshold: {
    category_min: null,
    tcws_min: null,
    placeholder: true,
    source_id: null,
    reviewed_by: null,
    reviewed_at: null,
  },
};

const FIXTURE_PLACE_ITEMS: Place[] = [
  {
    psgc: 'SAMPLE-REGION-1',
    name: 'SAMPLE Region (placeholder)',
    level: 'region',
    parent: null,
    centroid: { lat: 14.0, lon: 122.0 },
  },
  {
    psgc: 'SAMPLE-PROVINCE-1',
    name: 'SAMPLE Province (placeholder)',
    level: 'province',
    parent: 'SAMPLE-REGION-1',
    centroid: { lat: 14.0, lon: 122.0 },
  },
  {
    psgc: 'SAMPLE-PROVINCE-2',
    name: 'SAMPLE Province Two (placeholder)',
    level: 'province',
    parent: 'SAMPLE-REGION-1',
    centroid: { lat: 13.0, lon: 121.0 },
  },
  {
    psgc: 'SAMPLE-MUNICIPALITY-1',
    name: 'SAMPLE Municipality (placeholder)',
    level: 'municipality',
    parent: 'SAMPLE-PROVINCE-1',
    centroid: { lat: 14.0, lon: 122.0 },
  },
  {
    psgc: 'SAMPLE-BRGY-1',
    name: 'SAMPLE Barangay One (placeholder)',
    level: 'barangay',
    parent: 'SAMPLE-MUNICIPALITY-1',
    centroid: { lat: 14.01, lon: 122.01 },
  },
  {
    psgc: 'SAMPLE-BRGY-2',
    name: 'SAMPLE Barangay Two (placeholder)',
    level: 'barangay',
    parent: 'SAMPLE-MUNICIPALITY-1',
    centroid: { lat: 14.02, lon: 122.02 },
  },
];

export const FIXTURE_PLACES: PlacesFile = {
  schema_version: 1,
  content_version: 1,
  generated_at: AT_ISO,
  items: FIXTURE_PLACE_ITEMS,
  names_source_id: 'src-psa-sample',
  centroids_source_id: null,
};
