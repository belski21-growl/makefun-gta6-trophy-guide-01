import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// Only these three content inputs are opened. Repository caps use metadata only.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fallbackSnapshot = '/home/hatch/workspace/makefun/kits/gta6-trophy-guide-01-fresh29/gta6-trophy-guide-01-kit/starter/app/data/trophies.json';
const readJSON = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const data = readJSON(path.join(root, 'app/data/trophies.json'));
const snapshot = readJSON(process.env.GTA_TROPHY_SNAPSHOT || fallbackSnapshot);
const code = fs.readFileSync(path.join(root, 'app/app.js'), 'utf8');
const trophies = data.trophies;
const officials = snapshot.trophies;
const requireLive = process.argv.includes('--require-live-sources');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function ensure(condition, message = 'Requirement not satisfied') {
  if (!condition) throw new Error(message);
}
const byId = id => trophies.find(trophy => trophy.id === id);
const refOf = source => source.name.match(/^\[(S\d+)\] /)?.[1];
const refsIn = text => [...String(text).matchAll(/\[(S\d+)\]/g)].map(match => match[1]);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sourceURLs = [
  'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/',
  'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/',
  'https://www.powerpyx.com/gta-6-all-meditation-spot-locations/',
  'https://www.gtabase.com/articles/gta-6/gta-6-achievements-trophies-list-ps5-xbox-series',
  'https://gmtreks.com/gta6/page/01M7QVDV9V6SV9W03RH60W1P4B',
  'https://www.gtaboom.com/every-gta-6-trophy-and-achievement-at-launch-and-how-to-unlock-them-fc5f',
  'https://www.pushsquare.com/guides/gta-6-trophy-guide-and-roadmap',
  'https://gamemapa.com/en/gta-6/guides/gta-6-trophy-achievement-list/',
  'https://egamers.io/gta-6-trophy-list-all-55-trophies-and-achievements-plus-the-hardest-ones/'
];

function makeHarness() {
  const nodes = new Map();
  const store = new Map();
  const listeners = {};
  const downloads = [];
  const element = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', hidden: false, scrollTop: 0 });
    return nodes.get(selector);
  };
  for (const selector of ['#trophy-list', '#detail', '#route-stages', '#status']) element(selector);
  const context = vm.createContext({
    document: {
      querySelector: element,
      querySelectorAll: () => [],
      addEventListener(type, listener) { listeners[type] = listener; },
      createElement(tag) {
        ensure(tag === 'a', 'Unexpected download element');
        return { href: '', download: '', click() { downloads.push({ href: this.href, filename: this.download }); } };
      }
    },
    localStorage: {
      getItem: key => store.has(String(key)) ? store.get(String(key)) : null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: key => store.delete(String(key))
    },
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; } },
    URL: {
      createObjectURL(blob) { ensure(blob.type === 'application/json'); return 'blob:ledger-export'; },
      revokeObjectURL(url) { ensure(url === 'blob:ledger-export'); }
    },
    location: { search: '', hash: '' },
    __listeners: listeners,
    __downloads: downloads,
    __seed: JSON.parse(JSON.stringify(trophies))
  });
  const run = expression => vm.runInContext(expression, context, { timeout: 2000 });
  run(code);
  run('trophies.push(...__seed); delete globalThis.__seed; bindControls(); render();');
  const json = expression => JSON.parse(run(`JSON.stringify((${expression}))`));
  return { run, json, element, store };
}

function inventory(directory) {
  const totals = { entries: 0, bytes: 0, symlinks: 0 };
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      // Git's object store is not part of the application payload.
      if (folder === directory && entry.name === '.git') continue;
      const filename = path.join(folder, entry.name);
      const stat = fs.lstatSync(filename);
      totals.entries++;
      if (stat.isSymbolicLink()) totals.symlinks++;
      else if (stat.isDirectory()) walk(filename);
      else if (stat.isFile()) totals.bytes += stat.size;
    }
  }
  walk(directory);
  return totals;
}

const audit = trophies.reduce((totals, trophy) => {
  const sources = trophy.sources || [];
  const live = sources.filter(source => source.verification === 'live').length;
  totals.live += live;
  totals.snapshot += sources.filter(source => source.verification === 'snapshot').length;
  totals.total += sources.length;
  if (live >= 2) totals.liveCoverage++;
  return totals;
}, { live: 0, snapshot: 0, total: 0, liveCoverage: 0 });

let passed = 0;
let failed = 0;
function check(name, test) {
  try { test(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}

// 55 official-record checks; snapshot absence of hidden is the null sentinel.
for (let id = 1; id <= 55; id++) {
  check(`official record ${id}`, () => {
    const actual = byId(id);
    const official = officials.find(trophy => trophy.id === id);
    ensure(actual && official, 'Official ID missing');
    ensure(['name', 'description', 'grade'].every(key => actual[key] === official[key]) &&
      actual.hidden === (official.hidden ?? null), 'Official fields differ from snapshot');
  });
}

// This registry is deliberately 43 checks. Related assertions stay in one check.
const tests = [
  ['55 unique records', () => {
    ensure(trophies.length === 55 && new Set(trophies.map(t => t.id)).size === 55);
  }],
  ['counter targets', () => {
    ensure(same(trophies.filter(t => t.counter).map(t => [t.id, t.counter.target]),
      [[15, 250], [17, 42], [18, 14], [25, 8], [28, 18], [30, 3], [32, 50], [35, 100]]));
  }],
  ['meditation cutoff and units', () => {
    const trophy = byId(28);
    ensure(trophy.kind === 'collectibles' && trophy.missable === true);
    ensure(same(Object.keys(trophy.counter).sort(), ['sourceRef', 'target', 'unit']));
    ensure(trophy.counter.target === 18 && trophy.counter.unit === 'meditations' && trophy.counter.sourceRef === 'S3');
    ensure(trophy.timing.includes('before Chapter 1 ends') && trophy.timing.includes('requirement is unconfirmed'));
  }],
  ['activities have at least five subgroups', () => {
    const groups = trophies.filter(t => t.kind === 'activities').map(t => t.group);
    ensure(groups.every(nonempty) && new Set(groups).size >= 5);
  }],
  ['grade totals', () => {
    ensure(same(['platinum', 'gold', 'silver', 'bronze'].map(grade => trophies.filter(t => t.grade === grade).length), [1, 2, 6, 46]));
  }],
  ['official IDs retain their exact records', () => {
    ensure(same(trophies.map(t => t.id), Array.from({ length: 55 }, (_, index) => index + 1)));
    ensure(officials.length === 55 && trophies.every(t => officials.some(o => o.id === t.id && o.name === t.name && o.description === t.description && o.grade === t.grade && (o.hidden ?? null) === t.hidden)));
  }],
  ['audit source totals and coverage', () => {
    ensure(same(audit, { live: 166, snapshot: 55, total: 221, liveCoverage: 55 }));
  }],
  ['detail fields and all numbered references explicit', () => {
    for (const trophy of trophies) {
      const label = `Record ${trophy.id}`;
      ensure(['guide', 'steps', 'where', 'timing', 'roadmap'].every(key => nonempty(trophy[key])), `${label}: missing detail field`);
      ensure(Array.isArray(trophy.sources) && trophy.sources.length > 0, `${label}: missing sources`);
      const refs = trophy.sources.map(refOf);
      const urls = trophy.sources.map(source => source.url);
      ensure(refs.every(ref => /^S[1-9]$/.test(ref)) && new Set(refs).size === refs.length, `${label}: invalid or repeated source reference`);
      ensure(new Set(urls).size === urls.length, `${label}: repeated source URL`);
      ensure(trophy.sources.every(source => /^https:\/\//.test(source.url) && nonempty(source.note) &&
        ['snapshot', 'live', 'coordinator-probe'].includes(source.verification) &&
        (source.verification !== 'live' || source.note.includes('read 21 Nov 2026')) &&
        !/external cross-check blocked/i.test(source.note)), `${label}: source protocol, verification or read note invalid`);
      // An uncited generic instruction is permitted; a numbered reference may
      // never point outside the evidence attached to this particular record.
      ensure(['steps', 'where', 'timing'].every(key => refsIn(trophy[key]).every(ref => refs.includes(ref))), `${label}: dangling numbered reference`);
    }
  }],
  ['audit watchlist IDs', () => {
    ensure(same(trophies.filter(t => t.missable === true).map(t => t.id), [28, 33, 34, 36, 39, 48]));
    ensure(trophies.every(t => typeof t.missable === 'boolean'));
  }],
  ['audit reference point scale', () => {
    const points = data.psnPoints;
    ensure(points && ['platinum', 'gold', 'silver', 'bronze'].every((grade, index) => points.perGrade[grade] === [180, 90, 30, 15][index]));
    ensure(Object.keys(points.perGrade).length === 4);
    ensure(points.formula === '180 × platinum + 90 × gold + 30 × silver + 15 × bronze');
    ensure(points.status.includes('not independently verified'));
  }],
  ['audit roadmap evidence', () => {
    const evidence = data.roadmapEvidence;
    ensure(evidence && same(evidence.sourceRefs, ['S2', 'S4']) && evidence.difficulty === '4/10' && evidence.estimatedHours === 200 && evidence.chapters === 5 && evidence.missionReplay === false && evidence.postStoryFreeRoam === true);
    ensure(Array.isArray(evidence.sources) && evidence.sources.length >= 2);
  }],
  ['detail counter units and evidence', () => {
    const counters = [
      [15, 'stunts', 'S1'], [17, 'shooting range gold medals', 'S1'],
      [18, 'Top Fun locations won', 'S1'], [25, 'strands', 'S1'],
      [28, 'meditations', 'S3'], [30, 'card sets', 'S1'],
      [32, 'challenges', 'S1'], [35, 'vehicles', 'S1']
    ];
    ensure(counters.every(([id, unit, sourceRef]) => {
      const trophy = byId(id);
      return same(Object.keys(trophy.counter).sort(), ['sourceRef', 'target', 'unit']) && trophy.counter.unit === unit && trophy.counter.sourceRef === sourceRef && trophy.sources.some(source => refOf(source) === sourceRef);
    }));
    ensure(trophies.filter(t => !counters.some(([id]) => id === t.id)).every(t => t.counter === null));
  }],
  ['detail missability preserves uncertainty', () => {
    const expected = id => {
      if (id === 28) return 'Possibly missable: the balcony window is known; its necessity for the trophy is unconfirmed.';
      if ([33, 34, 36, 39].includes(id)) return 'Setup-sensitive attempt; permanent lockout unverified.';
      if (id === 48) return 'Unknown trigger; keep a save before consequential choices.';
      if (id >= 2 && id <= 13) return 'Story completion milestone; no separate cutoff documented.';
      if ([37, 38, 45, 46, 47, 49, 50].includes(id)) return 'Unlock details and missability unresolved.';
      return 'No cutoff documented; repeatability not verified.';
    };
    ensure(trophies.every(t => t.missableStatus === expected(t.id)));
  }],
  ['meditation numbered procedure and citations', () => {
    const trophy = byId(28);
    const lines = trophy.steps.split('\n');
    const required = ['Chapter 1 after Down to Earth', 'separate Chapter 1 save', '18 meditation actions across 10 spots', 'Ascent on Mount Kalaga after the other 17 meditations'];
    ensure(lines.length === 4 && lines.every((line, index) => line.startsWith(`${index + 1}. `) && line.includes('[S3]') && line.includes(required[index])));
    ensure(/possibly missable.*unconfirmed/i.test(trophy.missableStatus));
  }],
  ['initial count', () => { ensure(run('filteredTrophies().length') === 55); }],
  ['story protected', () => {
    ensure(run('isSpoiled(trophies[1])') === true && !element('#trophy-list').innerHTML.includes('Gone Fishing'));
  }],
  ['story detail sealed', () => {
    run('state.selected=2; renderDetail();');
    const html = element('#detail').innerHTML;
    ensure(!html.includes('Gone Fishing') && html.includes('sealed'));
  }],
  ['story search cannot leak', () => {
    try { run("state.query='Gone Fishing';"); ensure(run('filteredTrophies().length') === 0); }
    finally { run("state.query='';"); }
  }],
  ['earned reveals story', () => {
    run('toggleEarned(2);');
    ensure(run('isSpoiled(trophies[1])') === false && element('#detail').innerHTML.includes('Gone Fishing'));
  }],
  ['progress persisted', () => {
    ensure(same(JSON.parse(store.get('leonida-ledger-v1')), { earned: [2] }));
  }],
  ['restore progress', () => {
    run('state.earned=[]; restoreProgress();');
    ensure(same(json('state.earned'), [2]));
  }],
  ['mark incomplete seals again', () => {
    run('toggleEarned(2);'); ensure(run('isSpoiled(trophies[1])') === true);
  }],
  ['unprotected reveals', () => {
    try { run('state.spoilers=false; renderDetail();'); ensure(element('#detail').innerHTML.includes('Gone Fishing')); }
    finally { run('state.spoilers=true;'); }
  }],
  ['kind totals', () => {
    try {
      for (const [kind, total] of [['missable', 6], ['story', 12], ['collectibles', 5], ['activities', 33], ['online', 0]]) {
        run(`state.kind=${JSON.stringify(kind)};`);
        ensure(run('filteredTrophies().length') === total, `Unexpected count for ${kind}`);
      }
    } finally { run("state.kind='all';"); }
  }],
  ['unearned excludes earned', () => {
    try { run('toggleEarned(30); state.remaining=true;'); ensure(run('filteredTrophies().length') === 54); }
    finally { run('state.remaining=false;'); }
  }],
  ['search official words', () => {
    try { run("state.query='Collectible Card';"); ensure(run('filteredTrophies().length') === 1); }
    finally { run("state.query='';"); }
  }],
  ['empty online state', () => {
    try { run("state.kind='online'; renderChecklist();"); ensure(element('#trophy-list').innerHTML.includes('No online trophy')); }
    finally { run("state.kind='all';"); }
  }],
  ['sources visible as plain text', () => {
    run('state.selected=28; renderDetail();');
    const html = element('#detail').innerHTML;
    ensure(html.includes('https://www.powerpyx.com/gta-6-all-meditation-spot-locations/') && !html.includes('<a '));
  }],
  ['HTML escaping', () => {
    const unsafe = '<script>"&\'payload</script>';
    ensure(run(`esc(${JSON.stringify(unsafe)})`) === '&lt;script&gt;&quot;&amp;&#39;payload&lt;/script&gt;');
    run(`globalThis.__oldName=trophies[27].name; trophies[27].name=${JSON.stringify(unsafe)}; renderDetail();`);
    try { ensure(!element('#detail').innerHTML.includes('<script>') && element('#detail').innerHTML.includes('&quot;&amp;&#39;payload')); }
    finally { run('trophies[27].name=__oldName; delete globalThis.__oldName; renderDetail();'); }
  }],
  ['roadmap spoiler masking', () => {
    run('renderRoadmap();');
    const html = element('#route-stages').innerHTML;
    ensure(!html.includes('Gone Fishing') && html.includes('sealed'));
    ensure(json('trophies.filter(isSpoiled).map(t=>t.name)').every(name => !html.includes(run(`esc(${JSON.stringify(name)})`))));
  }],
  ['deep links', () => {
    run("state.selected=2; applyDeepLink('?trophy=28');");
    ensure(run('state.selected') === 28);
    run("applyDeepLink('#trophy=30');"); ensure(run('state.selected') === 30);
    run("applyDeepLink('#28');"); ensure(run('state.selected') === 28);
    run("applyDeepLink('?trophy=999');"); ensure(run('state.selected') === 28);
  }],
  ['import export round trip', () => {
    const before = json('state.earned');
    const exported = run('exportProgress()');
    ensure(same(JSON.parse(exported), { earned: before }));
    ensure(run('exportProgress(true)') === exported);
    const download = json('__downloads[__downloads.length-1]');
    ensure(/^leonida-ledger-\d{4}-\d{2}-\d{2}\.json$/.test(download.filename) && download.href === 'blob:ledger-export');
    run('state.earned=[];');
    ensure(run(`importProgress(${JSON.stringify(exported)})`) === true && same(json('state.earned'), before));
  }],
  ['app caps', () => {
    const caps = inventory(root);
    ensure(caps.entries <= 993 && caps.bytes <= 48 * 1024 * 1024 && caps.symlinks === 0,
      `entries=${caps.entries}, bytes=${caps.bytes}, symlinks=${caps.symlinks}`);
  }],
  ['both disputed source versions shown', () => {
    run('state.selected=28; renderDetail();');
    const html = element('#detail').innerHTML;
    ensure(html.includes('SOURCES DISAGREE — both versions shown') && html.includes('Version A —') && html.includes('Version B —'));
    ensure(html.includes("PowerPyx's spot guide labels the balcony session missable [S3]."));
    ensure(html.includes('The PowerPyx roadmap and GTABase call the trophy itself only possibly missable because whether the balcony session is required remains unconfirmed [S2][S4].'));
  }],
  ['all nine sources and read dates visible', () => {
    run('renderSources();');
    const html = element('#sources').innerHTML;
    const required = ['Exophase snapshot', 'PowerPyx Trophy Guide &amp; Roadmap', 'PowerPyx All Meditation Spot Locations', 'GTABase Trophy List', 'GmTreks Meditation Guide', 'GTA BOOM Trophy and Achievement List', 'Push Square Trophy Guide &amp; Roadmap', 'GameMapa Trophy List', 'eGamers Trophy List'];
    ensure(required.every((name, index) => html.includes(`[S${index + 1}] ${name}`)));
    ensure(html.includes('18 Nov 2026') && (html.match(/read 21 Nov 2026/g) || []).length === 8);
    ensure((html.match(/https:\/\//g) || []).length === 9);
    ensure(sourceURLs.every(url => html.includes(run(`esc(${JSON.stringify(url)})`))));
  }],
  ['audit strip calculated at runtime', () => {
    run('renderAudit();');
    ensure(element('#audit-strip').innerHTML.includes('55/55 claims cited · 55 backed by 2+ sources · 1 dispute'));
    run('globalThis.__auditBackup=trophies[27]; trophies[27]={...trophies[27],sources:[],missableStatus:""}; renderAudit();');
    try { ensure(element('#audit-strip').innerHTML.includes('54/55 claims cited · 54 backed by 2+ sources · 0 disputes')); }
    finally { run('trophies[27]=__auditBackup; delete globalThis.__auditBackup; renderAudit();'); }
  }],
  ['spoiler Reveal controls prominent', () => {
    run("setView('spoilers');");
    try {
      const html = element('#trophy-list').innerHTML;
      ensure(html.includes('>Reveal</button>') && html.includes('min-height:48px') && html.includes('font-size:18px'));
      ensure(html.indexOf('>Reveal</button>') < html.indexOf('<article'));
      ensure(element('#detail').innerHTML.includes('>Reveal</button>'));
      run(`__listeners.click({target:{closest(){return {
        getAttribute(key){return key==='data-action'?'reveal':key==='data-id'?'2':null;},
        hasAttribute(){return false;}
      };}}});`);
      ensure(run('isSpoiled(trophies[1])') === false && element('#detail').innerHTML.includes('Gone Fishing'));
      ensure(!json('state.earned').includes(2), 'Reveal must not mark a trophy earned');
    } finally { run("revealed.clear(); setView('tracker'); state.selected=28;"); }
  }],
  ['six roadmap estimates total two hundred hours', () => {
    const stages = json('stagesWithTrophies().map(s=>({hours:s.hours,count:s.trophies.length}))');
    ensure(stages.length === 6 && stages.every(s => Number.isFinite(s.hours) && s.hours > 0) && stages.reduce((sum, s) => sum + s.hours, 0) === 200);
    ensure(stages[1].count > 1 && new Set(stages.map(s => s.hours)).size === 6);
    run('renderRoadmap();');
    const html = element('#route-stages').innerHTML;
    ensure(html.includes('~200 h · one playthrough') && (html.match(/progress \d+\/\d+/g) || []).length === 6);
  }],
  ['roadmap allocation covers every trophy once', () => {
    const ids = json('stagesWithTrophies().flatMap(s=>s.trophies.map(t=>t.id))');
    ensure(ids.length === 55 && new Set(ids).size === 55 && same(ids.slice().sort((a, b) => a - b), trophies.map(t => t.id)));
  }],
  ['invalid imports preserve existing progress', () => {
    const before = json('state.earned');
    ensure(run("importProgress('{invalid')") === false && same(json('state.earned'), before));
    ensure(run("importProgress('{\"earned\":null}')") === false && same(json('state.earned'), before));
  }],
  ['default application state', () => {
    ensure(same(initialState, { selected: 28, query: '', kind: 'all', remaining: false, spoilers: true, earned: [] }));
  }],
  ['kind distribution and restricted source forty six', () => {
    ensure(same(['activities', 'story', 'collectibles', 'missable', 'online'].map(kind => trophies.filter(t => t.kind === kind).length), [33, 12, 5, 5, 0]));
    ensure(same(byId(46).sources.map(refOf).sort(), ['S1', 'S2', 'S4']));
  }],
  ['unique route notes and meditation guide uncertainty', () => {
    ensure(new Set(trophies.map(t => t.roadmap)).size === 55);
    const guide = byId(28).guide;
    ensure(/PowerPyx/i.test(guide) && /GTABase/i.test(guide) && /unconfirmed/i.test(guide));
    ensure(['S2', 'S3', 'S4'].every(ref => refsIn(guide).includes(ref)));
  }]
];

let harness;
let harnessError;
try { harness = makeHarness(); } catch (error) { harnessError = error; }
const run = expression => {
  if (!harness) throw new Error(`App harness unavailable: ${harnessError?.message}`);
  return harness.run(expression);
};
const json = expression => {
  if (!harness) throw new Error('App harness unavailable');
  return harness.json(expression);
};
const element = selector => {
  if (!harness) throw new Error('App harness unavailable');
  return harness.element(selector);
};
const store = harness?.store || new Map();
const initialState = harness ? json('state') : null;
ensure(tests.length === 43, 'Validator registry must contain exactly 43 named checks');
for (const [name, test] of tests) check(name, test);
if (requireLive) check('required live sources cover all 55 records', () => ensure(audit.liveCoverage === 55));
const expected = requireLive ? 99 : 98;
if (passed + failed !== expected) throw new Error('Unexpected validator check total');
console.log(`${passed} passed / ${failed} failed`);
process.exitCode = failed ? 1 : 0;
