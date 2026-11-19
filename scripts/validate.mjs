import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const data = JSON.parse(read('app/data/trophies.json'));
const official = JSON.parse(readFileSync('/tmp/gta-kit/trophies-starter.json','utf8'));
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
  });
}
check('grade totals',()=>assert.deepEqual(['platinum','gold','silver','bronze'].map(g=>data.trophies.filter(t=>t.grade===g).length),[1,2,6,46]));

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
 for(const [kind,count] of [['story',12],['missable',5],['collectibles',5],['activities',33],['online',0]]){run(`state.kind='${kind}'`);assert.equal(run('filteredTrophies().length'),count);}
 run("state.kind='all'");
});
check('unearned excludes earned',()=>{run('toggleEarned(30);state.remaining=true');assert.equal(run('filteredTrophies().length'),54);run('state.remaining=false');});
check('search official words',()=>{run("state.query='Collectible Card'");assert.equal(run('filteredTrophies().length'),1);run("state.query=''");});
check('empty online state',()=>{run("state.kind='online';renderChecklist()");assert.ok(element('#trophy-list').innerHTML.includes('No online trophy'));run("state.kind='all'");});
check('sources visible as plain text',()=>{run('state.selected=30;renderDetail()');const html=element('#detail').innerHTML;assert.ok(html.includes('https://www.exophase.com/'));assert.ok(!html.includes('<a '));});
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
console.log(JSON.stringify({checks,passed:checks,trophies:55,guides:55,appEntries,appBytes,symlinks,browserChecks:0}));
