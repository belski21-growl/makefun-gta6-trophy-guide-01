import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const data = JSON.parse(read('app/data/trophies.json'));
const temporarySnapshot = '/tmp/gta-kit/trophies-starter.json';
const kitSnapshot = new URL('../../kits/gta6-trophy-guide-01-fresh27/gta6-trophy-guide-01-kit/starter/app/data/trophies.json',root);
const official = JSON.parse(readFileSync(process.env.GTA_TROPHY_SNAPSHOT || (existsSync(temporarySnapshot) ? temporarySnapshot : kitSnapshot),'utf8'));
const liveCoverage = data.trophies.filter(trophy =>
  new Set(trophy.sources.filter(source => source.verification === 'live').map(source => source.url)).size >= 2
).length;
let checks=0;
function check(name, run) { run(); checks++; }
check('55 unique records',()=>{assert.equal(data.trophies.length,55);assert.equal(new Set(data.trophies.map(t=>t.id)).size,55);});
for(const original of official.trophies) {
  const trophy=data.trophies.find(t=>t.name===original.name);
  check(`official record ${original.id}`,()=>{
    assert.ok(trophy);
    for(const field of ['name','description','grade']) assert.equal(trophy[field],original[field]);
    assert.equal(trophy.hidden??null,original.hidden??null);
    for(const field of ['guide','steps','where','timing','roadmap']) assert.ok(trophy[field].trim());
    assert.ok(['story','missable','collectibles','activities','online'].includes(trophy.kind));
    assert.equal(typeof trophy.missable,'boolean');
    assert.ok(trophy.sources.every(s=>s.name.trim()&&s.url.startsWith('https://')));
    assert.ok(trophy.group.trim());
    assert.ok(trophy.missableStatus.trim() && trophy.missableStatus !== 'not established by description');
    assert.equal(new Set(trophy.sources.map(s=>s.url)).size,trophy.sources.length);
    const refs = trophy.sources.map(s=>s.name.match(/^\[(S\d+)\] /)?.[1]);
    assert.ok(refs.every(Boolean) && new Set(refs).size === refs.length);
    for (const source of trophy.sources) {
      assert.ok(['snapshot','coordinator-probe','live'].includes(source.verification));
      assert.ok(!/external cross-check blocked/i.test(source.note));
      if(source.verification !== 'snapshot') assert.match(source.note,/read \d{1,2} [A-Z][a-z]{2} \d{4}/);
    }
    for(const [,ref] of `${trophy.steps} ${trophy.where} ${trophy.timing}`.matchAll(/\[(S\d+)\]/g)) assert.ok(refs.includes(ref));
    if(trophy.counter !== null) {
      assert.ok(Number.isInteger(trophy.counter.target) && trophy.counter.target > 0);
      assert.ok(trophy.counter.unit.trim() && refs.includes(trophy.counter.sourceRef));
    }
  });
}
check('counter targets',()=>assert.deepEqual(data.trophies.filter(t=>t.counter).map(t=>[t.id,t.counter.target]),[[15,250],[17,42],[18,14],[25,8],[28,18],[30,3],[32,50],[35,100]]));
check('meditation cutoff and units',()=>{
  const meditation=data.trophies.find(t=>t.id===28);
  assert.equal(meditation.missable,true);
  assert.match(meditation.missableStatus,/possibly missable.*unconfirmed/i);
  assert.match(meditation.timing,/before Chapter 1 ends/);
  assert.match(meditation.steps,/18 meditation actions across 10 spots/);
});
check('activities have subgroups',()=>assert.ok(new Set(data.trophies.filter(t=>t.kind==='activities').map(t=>t.group)).size>=5));
check('grade totals',()=>assert.deepEqual(['platinum','gold','silver','bronze'].map(g=>data.trophies.filter(t=>t.grade===g).length),[1,2,6,46]));

// M2a: lock the audited data used by the audit strip and detail panel.
check('official IDs retain their exact records',()=>{
  assert.deepEqual(data.trophies.map(t=>t.id),Array.from({length:55},(_,i)=>i+1));
  for(const original of official.trophies) {
    const trophy=data.trophies.find(t=>t.id===original.id);
    for(const field of ['name','description','grade']) assert.equal(trophy[field],original[field]);
    assert.equal(trophy.hidden??null,original.hidden??null);
  }
});
check('audit source totals and coverage',()=>{
  const sources=data.trophies.flatMap(t=>t.sources);
  assert.equal(sources.filter(s=>s.verification==='live').length,112);
  assert.equal(sources.filter(s=>s.verification==='snapshot').length,55);
  assert.equal(sources.length,167);
  assert.equal(liveCoverage,55);
  for(const trophy of data.trophies) {
    assert.ok(new Set(trophy.sources.filter(s=>s.verification==='live').map(s=>s.url)).size>=2);
    assert.equal(trophy.sources.filter(s=>s.verification==='snapshot').length,1);
  }
});
check('detail fields and all numbered references are explicit',()=>{
  for(const trophy of data.trophies) {
    assert.ok(Object.hasOwn(trophy,'hidden'));
    assert.ok(trophy.hidden===null || typeof trophy.hidden==='boolean');
    for(const field of ['name','description','grade','kind','missableStatus','roadmap','guide','steps','where','timing','group']) {
      assert.equal(typeof trophy[field],'string');
      assert.ok(trophy[field].trim(),`missing ${field} for #${trophy.id}`);
    }
    const refs=new Set(trophy.sources.map(s=>s.name.match(/^\[(S\d+)\] /)?.[1]));
    for(const field of ['guide','steps','where','timing','roadmap','missableStatus']) {
      for(const [,ref] of trophy[field].matchAll(/\[(S\d+)\]/g)) assert.ok(refs.has(ref),`unknown ${ref} in #${trophy.id} ${field}`);
    }
  }
});
check('audit watchlist IDs',()=>assert.deepEqual(data.trophies.filter(t=>t.missable).map(t=>t.id),[28,33,34,36,39,48]));
check('audit reference point scale has no unverified total',()=>{
  assert.deepEqual(Object.keys(data.psnPoints).sort(),['formula','perGrade','status']);
  assert.deepEqual(data.psnPoints.perGrade,{platinum:180,gold:90,silver:30,bronze:15});
  assert.equal(data.psnPoints.formula,'180 × platinum + 90 × gold + 30 × silver + 15 × bronze');
  assert.match(data.psnPoints.status,/not independently verified/);
});
check('audit roadmap evidence',()=>{
  const evidence=data.roadmapEvidence;
  assert.equal(evidence.difficulty,'4/10');
  assert.equal(evidence.estimatedHours,200);
  assert.equal(evidence.chapters,5);
  assert.equal(evidence.missionReplay,false);
  assert.equal(evidence.postStoryFreeRoam,true);
  assert.deepEqual(evidence.sourceRefs,['S2','S4']);
  for(const ref of evidence.sourceRefs) assert.ok(evidence.sources.some(s=>s.name.startsWith(`[${ref}] `)&&s.note.trim()&&s.url.startsWith('https://')));
});
check('detail counter units and evidence',()=>{
  const expected=[[15,'stunts','S1'],[17,'shooting range gold medals','S1'],[18,'Top Fun locations won','S1'],[25,'strands','S1'],[28,'meditations','S3'],[30,'card sets','S1'],[32,'challenges','S1'],[35,'vehicles','S1']];
  assert.deepEqual(data.trophies.filter(t=>t.counter!==null).map(t=>[t.id,t.counter.unit,t.counter.sourceRef]),expected);
  for(const trophy of data.trophies.filter(t=>t.counter!==null)) {
    assert.deepEqual(Object.keys(trophy.counter).sort(),['sourceRef','target','unit']);
    const source=trophy.sources.find(s=>s.name.startsWith(`[${trophy.counter.sourceRef}] `));
    assert.ok(source);
    assert.equal(source.verification,trophy.id===28?'live':'snapshot');
  }
});
check('detail missability preserves uncertainty',()=>{
  for(const trophy of data.trophies) {
    const expected=trophy.id===28
      ? 'Possibly missable: the balcony window is known; its necessity for the trophy is unconfirmed.'
      : [33,34,36,39].includes(trophy.id)
        ? 'Setup-sensitive attempt; permanent lockout unverified.'
        : trophy.id===48
          ? 'Unknown trigger; keep a save before consequential choices.'
          : trophy.kind==='story'
            ? 'Story completion milestone; no separate cutoff documented.'
            : [37,38,45,46,47,49,50].includes(trophy.id)
              ? 'Unlock details and missability unresolved.'
              : 'No cutoff documented; repeatability not verified.';
    assert.equal(trophy.missableStatus,expected,`missability for #${trophy.id}`);
  }
});
check('meditation numbered procedure and citations',()=>{
  const meditation=data.trophies.find(t=>t.id===28);
  const steps=meditation.steps.split('\n');
  assert.equal(steps.length,4);
  steps.forEach((step,i)=>{
    assert.ok(step.startsWith(`${i+1}. `));
    assert.match(step,/\[S3\]/);
  });
  assert.match(steps[0],/Chapter 1 after Down to Earth/);
  assert.match(steps[1],/separate Chapter 1 save/);
  assert.match(steps[2],/18 meditation actions across 10 spots/);
  assert.match(steps[3],/Ascent on Mount Kalaga after the other 17 meditations/);
  assert.match(meditation.timing,/requirement is unconfirmed/);
});

// Logic and rendered-template tests, not a substitute for a browser render.
const elements=new Map();
const element=selector=>{
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,value:'',checked:false,files:[],dataset:{},classList:{toggle(){}},addEventListener(){},setAttribute(){},focus(){},click(){},scrollIntoView(){}});
  return elements.get(selector);
};
const store=new Map();
let confirmAnswer=true;
const context=vm.createContext({
 document:{querySelector:element,querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('download')},
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 fetch:async path=>{assert.equal(path,'data/trophies.json');return {ok:true,json:async()=>data};},
 URL,URLSearchParams,Blob,setTimeout:callback=>callback(),
 window:{confirm:()=>confirmAnswer,scrollTo(){}},location:{hash:''},console,
});
vm.runInContext(read('app/app.js'),context);
await new Promise(resolve=>setTimeout(resolve,0));
const run = code=>vm.runInContext(code,context);
const json = code=>JSON.parse(JSON.stringify(run(code)));
check('initial count',()=>assert.equal(run('filteredTrophies().length'),55));
check('story protected',()=>{assert.equal(run('isSpoiled(trophies[1])'),true);assert.ok(!element('#trophy-list').innerHTML.includes('Gone Fishing'));});
check('story detail sealed',()=>{run('state.selected=2; renderDetail()');assert.ok(!element('#detail').innerHTML.includes('Gone Fishing'));assert.ok(element('#detail').innerHTML.includes('sealed'));});
check('story search cannot leak',()=>{run("state.query='Gone Fishing'");assert.equal(run('filteredTrophies().length'),0);run("state.query=''");});
check('earned reveals story',()=>{run('toggleEarned(2)');assert.equal(run('isSpoiled(trophies[1])'),false);assert.ok(element('#detail').innerHTML.includes('Gone Fishing'));});
check('progress persisted',()=>assert.deepEqual(JSON.parse(store.get('leonida-ledger-v1')).earned,[2]));
check('restore progress',()=>{run('state.earned=[]; restoreProgress()');assert.deepEqual(json('state.earned'),[2]);});
check('mark incomplete seals again',()=>{run('toggleEarned(2)');assert.equal(run('isSpoiled(trophies[1])'),true);});
check('unprotected reveals',()=>{run('state.spoilers=false;renderDetail()');assert.ok(element('#detail').innerHTML.includes('Gone Fishing'));run('state.spoilers=true');});
check('kind totals',()=>{
 for(const [kind,count] of [['story',12],['missable',6],['collectibles',5],['activities',33],['online',0]]){run(`state.kind='${kind}'`);assert.equal(run('filteredTrophies().length'),count);}
 run("state.kind='all'");
});
check('unearned excludes earned',()=>{run('toggleEarned(30);state.remaining=true');assert.equal(run('filteredTrophies().length'),54);run('state.remaining=false');});
check('search official words',()=>{run("state.query='Collectible Card'");assert.equal(run('filteredTrophies().length'),1);run("state.query=''");});
check('empty online state',()=>{run("state.kind='online';renderChecklist()");assert.ok(element('#trophy-list').innerHTML.includes('No online trophy'));run("state.kind='all'");});
check('sources visible as plain text',()=>{run('state.selected=28;renderDetail()');const html=element('#detail').innerHTML;assert.ok(html.includes('https://www.powerpyx.com/gta-6-all-meditation-spot-locations/'));assert.ok(!html.includes('<a '));});
check('html escaping',()=>assert.equal(run("esc('<img src=x onerror=alert(1)>')"),'&lt;img src=x onerror=alert(1)&gt;'));
check('roadmap masks story',()=>{run('state.spoilers=true;renderRoadmap()');assert.ok(!element('#route-stages').innerHTML.includes('Gone Fishing'));});
check('roadmap reveals opt-in',()=>{run('state.spoilers=false;renderRoadmap()');assert.ok(element('#route-stages').innerHTML.includes('Gone Fishing'));});
check('deep links cannot alter earned or spoilers',()=>{run("location.hash='#view=roadmap&kind=missable&trophy=34&earned=55&spoilers=true';applyDeepLink()");assert.equal(run('state.view'),'roadmap');assert.equal(run('state.kind'),'missable');assert.equal(run('state.selected'),34);assert.deepEqual(json('state.earned'),[30]);assert.equal(run('state.spoilers'),false);});
const file=value=>({size:100,text:async()=>JSON.stringify(value)});
context.importFile=file({format:'leonida-ledger/progress',version:1,earned:[2,3,3],spoilers:true});
await run('importProgress(importFile)');
check('valid import deduplicates',()=>{assert.deepEqual(json('state.earned'),[2,3]);assert.equal(run('state.spoilers'),true);});
confirmAnswer=false;
context.importFile=file({format:'leonida-ledger/progress',version:1,earned:[55],spoilers:false});
await run('importProgress(importFile)');
check('cancel import preserves state',()=>assert.deepEqual(json('state.earned'),[2,3]));
confirmAnswer=true;
for(const [label,value] of [['foreign',{earned:[1]}],['unknown ID',{format:'leonida-ledger/progress',version:1,earned:[56],spoilers:false}],['wrong version',{format:'leonida-ledger/progress',version:2,earned:[1],spoilers:false}]]) {
 context.importFile=file(value);await run('importProgress(importFile)');
 check(`reject ${label}`,()=>assert.deepEqual(json('state.earned'),[2,3]));
}
context.importFile={size:65537,text:async()=>{throw new Error('must not read');}};
await run('importProgress(importFile)');
check('oversized import rejected',()=>{assert.deepEqual(json('state.earned'),[2,3]);assert.ok(element('#status').textContent.includes('too large'));});
context.importFile={size:2,text:async()=>'{'};
await run('importProgress(importFile)');
check('malformed JSON preserves progress',()=>assert.deepEqual(json('state.earned'),[2,3]));
let exportedBlob;
context.URL={createObjectURL:blob=>{exportedBlob=blob;return 'blob:local-test';},revokeObjectURL(){}};
run('exportProgress()');
const exported=JSON.parse(await exportedBlob.text());
check('export schema and payload',()=>{assert.equal(exported.format,'leonida-ledger/progress');assert.deepEqual(exported.earned,[2,3]);assert.equal(exported.spoilers,true);});
run('state.earned=[55];state.spoilers=false');
context.importFile=file(exported);await run('importProgress(importFile)');
check('export import round trip',()=>{assert.deepEqual(json('state.earned'),[2,3]);assert.equal(run('state.spoilers'),true);});
check('unavailable storage warns',()=>{context.localStorage.setItem=()=>{throw new Error('blocked');};run('persistProgress()');assert.ok(element('#status').textContent.includes('storage is unavailable'));});
let appEntries=0,appBytes=0,symlinks=0;
function walk(path){for(const name of readdirSync(path)){const p=join(path,name);const stat=lstatSync(p);appEntries++;if(stat.isSymbolicLink())symlinks++;else if(stat.isDirectory())walk(p);else appBytes+=stat.size;}}
walk(fileURLToPath(new URL('app/',root)));
check('app caps and plain files',()=>{assert.equal(symlinks,0);assert.ok(appEntries<=993);assert.ok(appBytes<=48*1024*1024);});
if(process.argv.includes('--require-live-sources')) {
  check('two directly verified live sources per trophy',()=>assert.equal(liveCoverage,data.trophies.length));
}
console.log(JSON.stringify({checks,passed:checks,trophies:55,guides:55,liveCoverage,appEntries,appBytes,symlinks,browserChecks:0}));
