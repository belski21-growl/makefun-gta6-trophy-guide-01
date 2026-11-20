'use strict';

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'leonida-ledger-v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const VIEWS = {tracker:'Trophy tracker', roadmap:'Platinum route', missables:'Missable trophies', spoilers:'Story & spoilers'};
const GROUPS = {
  completion:'Completion', stunts:'Stunts and races', games:'Minigames and challenges',
  strangers:'Stranger strands', crime:'Crime and combat', world:'World encounters', economy:'Economy and property'
};
const LABELS = {all:'All', story:'Story', missable:'Missable', collectibles:'Collectibles', stunts:'Stunts & races',
  games:'Minigames', strangers:'Strangers', crime:'Crime & combat', world:'World', economy:'Economy', completion:'Completion', online:'Online'};
const state = {earned:[], spoilers:true, kind:'all', query:'', remaining:false, selected:28, view:'tracker', counters:{}, savedAt:null};
const revealed = new Set();
let trophies = [];
let roadmapEvidence;
let points;
let storageAvailable = true;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isEarned = t => state.earned.includes(t.id);
function isSpoiled(t) { return state.spoilers && t.kind === 'story' && !isEarned(t); }
const titleOf = t => isSpoiled(t) ? 'Story trophy · sealed' : t.name;
const descriptionOf = t => isSpoiled(t) ? 'Story details hidden by the spoiler shield.' : t.description;
const byId = (a,b) => a.id-b.id;
const byRoadmap = (a,b) => roadmapOrder(a)-roadmapOrder(b) || byId(a,b);
const counterOf = t => state.counters[t.id] || 0;
function notify(message) { $('#status').textContent = message; }

function persistProgress() {
  try {
    const savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, earned:state.earned, spoilers:state.spoilers, counters:state.counters, savedAt}));
    state.savedAt = savedAt;
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    notify('Browser storage is unavailable. Export your earned trophies before leaving.');
  }
}
function restoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    if (saved.version !== 1 || !Array.isArray(saved.earned) || !saved.earned.every(id => trophies.some(t => t.id === id))) throw new Error();
    state.earned = [...new Set(saved.earned)];
    state.spoilers = saved.spoilers !== false;
    for (const t of trophies.filter(t => t.counter)) {
      const n = saved.counters?.[t.id];
      if (Number.isInteger(n) && n >= 0 && n <= t.counter.target) state.counters[t.id] = n;
    }
    if (typeof saved.savedAt === 'string' && Number.isFinite(Date.parse(saved.savedAt))) state.savedAt = saved.savedAt;
  } catch {
    notify('Saved progress could not be read. Import a backup to restore your checklist.');
  }
}
function toggleEarned(id) {
  if (!trophies.some(t => t.id === id)) return;
  state.earned = state.earned.includes(id) ? state.earned.filter(value => value !== id) : [...state.earned,id];
  revealed.delete(id);
  persistProgress();
  render();
}
function matchesKind(t, kind) {
  if (kind === 'missable') return t.missable;
  if (GROUPS[kind]) return t.group === GROUPS[kind];
  return kind === 'all' || t.kind === kind;
}
function filteredTrophies() {
  const query = state.query.trim().toLowerCase();
  return trophies.filter(t => matchesKind(t,state.kind) && (!state.remaining || !isEarned(t))
    && (!query || [titleOf(t),descriptionOf(t),t.grade].join(' ').toLowerCase().includes(query)));
}
function renderAudit() {
  const n = trophies.length;
  const official = trophies.filter(t => t.name && t.description && GRADES.includes(t.grade)).length;
  const guides = trophies.filter(t => t.guide?.trim()).length;
  const cited = trophies.filter(t => t.sources?.some(s => s.verification === 'live')).length;
  const flags = trophies.filter(t => t.missable).length;
  const dated = trophies.flatMap(t => t.sources).some(s => s.verification === 'live' && s.note.includes('20 Nov 2026'));
  $('#audit-counts').innerHTML = [
    '<b>'+official+'/'+n+'</b> trophies', '<b>'+guides+'/'+n+'</b> guides', '<b>'+cited+'/'+n+'</b> cited',
    '<b>'+flags+'</b> missable flags', '<b>28 hidden</b> (official count, GTABase [S4]; per-trophy flags unavailable in snapshot)',
    dated ? 'Sources read 20 Nov 2026' : ''
  ].filter(Boolean).map(label => '<span>'+label+'</span>').join('');
  if (points) $('#points').textContent = 'PSN points · reference scale: '+points.formula;
}
function renderProgress() {
  const n = trophies.length;
  const count = state.earned.length;
  $('#total').innerHTML = count+' <small>/ '+n+' earned</small>';
  $('#percent').textContent = Math.round(count/n*100)+'%';
  $('#progress').value = count;
  $('#progress-caption').textContent = count+' of '+n+' trophies earned';
  $('#grade-counts').innerHTML = GRADES.map(grade => {
    const group = trophies.filter(t => t.grade === grade);
    return '<span class="'+grade+'">'+grade[0].toUpperCase()+' <b>'+group.filter(isEarned).length+'/'+group.length+'</b></span>';
  }).join('');
  $('#save-trace').textContent = !storageAvailable ? 'Browser storage unavailable' : state.savedAt
    ? 'Saved in this browser · '+new Date(state.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
    : state.earned.length ? 'Saved in this browser · time unavailable' : 'No local changes yet';
}
function renderFilters() {
  $('#filters').innerHTML = Object.entries(LABELS).map(([kind,label]) =>
    '<button class="filter" data-kind="'+kind+'" aria-pressed="'+(state.kind===kind)+'">'+label+' <small>'+trophies.filter(t => matchesKind(t,kind)).length+'</small></button>').join('');
  $('#spoilers').checked = state.spoilers;
}
function badge(t) {
  return '<span class="grade '+t.grade+'" title="'+t.grade+'" aria-label="'+t.grade+'">'+t.grade[0].toUpperCase()+'</span>';
}
function flag(t) {
  return t.missable ? '<span class="flag">'+(t.id === 28 ? 'Possibly missable' : 'Watch')+'</span>' : '';
}
function renderChecklist() {
  const visible = filteredTrophies().sort(byRoadmap);
  $('#result-count').textContent = visible.length+' / '+trophies.length+' shown';
  $('#trophy-list').innerHTML = visible.map(t =>
    '<article class="trophy-row'+(isEarned(t) ? ' earned' : '')+(state.selected===t.id ? ' selected' : '')+'">'+
    '<input type="checkbox" data-earned="'+t.id+'" aria-label="Earned: '+esc(titleOf(t))+'" '+(isEarned(t)?'checked':'')+'>'+
    '<button class="trophy-open" data-detail="'+t.id+'" aria-pressed="'+(state.selected===t.id)+'">'+
    '<span class="row-title">'+badge(t)+'<strong>'+esc(titleOf(t))+'</strong>'+flag(t)+'</span>'+
    '<span class="row-description">'+esc(descriptionOf(t))+'</span>'+
    '<span class="row-meta">#'+String(t.id).padStart(2,'0')+' · '+esc(t.group)+(t.counter?' · '+counterOf(t)+'/'+t.counter.target:'')+'</span></button></article>'
  ).join('') || '<p class="empty">'+(state.kind==='online' ? 'No online trophy is listed.' : 'No trophies match these filters.')+'</p>';
}
function sourceCards(t) {
  return t.sources.map(s => {
    const date = s.note.match(/\b\d{1,2} [A-Z][a-z]{2} 20\d{2}\b/)?.[0];
    const verified = s.verification === 'live' ? 'Live source · saved HTTP 200 · read ' : 'Kit snapshot · dated ';
    return '<div class="source-card"><strong>'+esc(s.name)+'</strong><span class="source-url">'+esc(s.url)+'</span>'+
      '<span class="source-label">'+esc(verified+(date || 'date unavailable'))+'</span><p>'+esc(s.note)+'</p></div>';
  }).join('');
}
function missableBox(t) {
  return '<section class="warning"><h4>'+ (t.id===28 ? 'Possibly missable' : 'Precautionary flag')+'</h4>'+
    '<strong>'+(t.id===28 ? 'Point of no return: End of Chapter 1 [S3]' : 'Permanent cutoff: Not confirmed')+'</strong>'+
    '<p>'+esc(t.timing)+'</p></section>';
}
function renderDetail() {
  const t = trophies.find(t => t.id === state.selected) || trophies[0];
  const sealed = isSpoiled(t);
  const list = filteredTrophies().sort(byRoadmap);
  const neighbors = list.some(item => item.id === t.id) ? list : [...trophies].sort(byRoadmap);
  const i = neighbors.findIndex(item => item.id === t.id);
  const page = (item,label) => '<button data-detail="'+(item?.id || '')+'" '+(item?'':'disabled')+'>'+label+'</button>';
  const sources = sealed ? '' : sourceCards(t);
  const steps = t.steps.trim().split(/\n+/).map(line => line.replace(/^\d+\.\s*/, ''));
  const count = counterOf(t);
  const counter = t.counter ? '<div class="counter"><strong>Your count</strong><button data-count="-1" aria-label="Decrease count" '+(count===0?'disabled':'')+'>−</button>'+
    '<span><b>'+count+'</b> / '+t.counter.target+' '+esc(t.counter.unit)+' ['+esc(t.counter.sourceRef)+']</span>'+
    '<button data-count="1" aria-label="Increase count" '+(count===t.counter.target?'disabled':'')+'>+</button>'+
    '<progress aria-label="Counter progress" value="'+count+'" max="'+t.counter.target+'"></progress></div>' : '';
  $('#detail').innerHTML = '<div class="detail-head"><div><div class="kicker">#'+String(t.id).padStart(2,'0')+' · '+esc(t.grade)+'</div>'+
    '<h3>'+esc(titleOf(t))+'</h3></div><button class="mark" data-earned="'+t.id+'">'+(isEarned(t)?'Mark incomplete':'Mark earned')+'</button></div>'+
    '<div class="official"><h4>Official description</h4><p>'+esc(descriptionOf(t))+'</p></div>'+
    (sealed ? '<p class="empty">Guide and citations are sealed until earned. Individual reveals are available in Story &amp; spoilers.</p>' :
      '<div class="detail-meta">'+flag(t)+'<span>'+esc(t.group)+'</span></div>'+counter+
      (t.missable ? missableBox(t) : '')+
      '<section class="steps"><h4>How to earn it · '+steps.length+' '+(steps.length===1?'step':'steps')+'</h4><ol>'+
      steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></section>'+
      '<details class="guide-note"><summary>Guide note</summary><p>'+esc(t.guide)+'</p></details>'+
      '<section class="inline-sources"><h4>Sources</h4>'+sources+'</section>')+
    '<div class="pager">'+page(neighbors[i-1],'← Previous')+page(neighbors[i+1],'Next →')+'</div>';
  $('#sources').innerHTML = sources || '<p class="empty">Sources sealed with the guide.</p>';
  $('#source-count').textContent = sealed ? 'Sealed' : t.sources.length+' for this guide';
}
function roadmapOrder(t) {
  if (t.id === 28) return 0;
  if (t.roadmap === 'Watch before advancing') return 1;
  if (t.kind === 'story') return 2;
  if (t.kind === 'collectibles') return 3;
  return t.grade === 'platinum' ? 5 : 4;
}
function renderNextUp() {
  const next = trophies.filter(t => !isEarned(t)).sort(byRoadmap).slice(0,3);
  $('#next-up').innerHTML = next.map(t => '<button class="next-item" data-jump="'+t.id+'">'+badge(t)+'<span><b>'+esc(titleOf(t))+
    '</b><small>'+(t.id===28?'Before Chapter 1 ends':t.missable?'Check attempt conditions':esc(t.group))+'</small></span></button>').join('') ||
    '<p class="empty">All trophies earned.</p>';
}
function renderMissables() {
  $('#missable-list').innerHTML = trophies.filter(t => t.missable).sort(byId).map(t =>
    '<article><h3>'+badge(t)+' '+esc(titleOf(t))+'</h3>'+missableBox(t)+'<button data-jump="'+t.id+'">Open guide →</button></article>').join('');
}
function renderSpoilers() {
  const chapters = new Map();
  for (const t of trophies.filter(t => t.kind === 'story')) {
    const chapter = t.description.match(/^Complete (Chapter \d+)\.$/)?.[1] || 'Chapter not listed in snapshot';
    if (!chapters.has(chapter)) chapters.set(chapter,[]);
    chapters.get(chapter).push(t);
  }
  $('#spoiler-list').innerHTML = '<p class="spoiler-count"><strong>28 hidden</strong> (official count, GTABase [S4]). Individual hidden flags are unavailable in the snapshot.</p>'+
    [...chapters].sort(([a],[b]) => a.localeCompare(b)).map(([chapter,items]) => '<section><h3>'+esc(chapter)+'</h3>'+
      items.map(t => {
        const sealed = isSpoiled(t) && !revealed.has(t.id);
        return '<div class="story-row"><div><small>#'+t.id+' · '+esc(t.grade)+'</small><strong>'+esc(sealed?titleOf(t):t.name)+'</strong>'+
          '<p>'+esc(sealed?descriptionOf(t):t.description)+'</p></div>'+
          (isSpoiled(t) ? '<button data-reveal="'+t.id+'" aria-expanded="'+!sealed+'">'+(sealed?'Reveal':'Seal')+'</button>' :
            '<button data-jump="'+t.id+'">Open guide</button>')+'</div>';
      }).join('')+'</section>').join('');
}
function renderRoadmap() {
  const hide = state.spoilers;
  const story = hide ? 'Finish the story across five chapters. Turn off spoiler protection to see the mission checklist.' : 'Track Gone Fishing, the chapter milestones and the finale. Check off Breakfast Run, The Cartel Heist, Child’s Play, Headliners, VCIA Takedown and Operation Savage Glory as they come up.';
  const stages = [
    {title:'Story milestones', copy:story, step:0, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.kind === 'story'},
    {title:'Early meditation and optional tasks', copy:'Take the Chapter 1 balcony meditation opportunity and track every remaining spot as you explore. Start optional missions, scan new vehicles and study animals along the way.', step:0, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.id === 28},
    {title:'Collectibles and exploration', copy:'Carry your discoveries into post-story free roam. Use the in-game completion checklist to see which exploration tasks still count toward 100%.', step:1, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.kind === 'collectibles' && t.id !== 28},
    {title:'Activities and the 100% checklist', copy:'Open Progress → Stats → 100% Completion after the story. The checklist asks for 70 of 80 challenges. Track the activity trophies against their own goals.', step:1, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.id === 14 || ['Stunts and races','Minigames and challenges'].includes(t.group)},
    {title:'Strangers & Freaks', copy:'Return to any unfinished stranger strands in free roam. Complete the strand trophy and check the individual rewards.', step:2, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.group === 'Stranger strands'},
    {title:'Remaining trophies and platinum', copy:'Use the watchlist for setup-sensitive attempts. Clear remaining crime, economy and world encounter trophies, then check the platinum.', step:2, source:'PowerPyx [S2] · GTABase [S4]', includes:t => t.grade === 'platinum' || ['Crime and combat','Economy and property','World encounters'].includes(t.group)}
  ];
  const cards = stages.map((stage,i) => {
    const assigned = trophies.filter(stage.includes);
    const earned = assigned.filter(t => state.earned.includes(t.id)).length;
    const estimate = roadmapEvidence.stages[stage.step].estimate;
    return `<article class="stage"><span class="stage-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(stage.title)}</h3><p>${esc(stage.copy)}</p><small>${earned}/${assigned.length} earned · ${assigned.length} trophies · Step ${stage.step+1} estimate ${esc(estimate)} (shared) · ${esc(stage.source)}</small></div></article>`;
  });
  $('#route-stages').innerHTML = `<div class="route-intro"><h3>~${roadmapEvidence.estimatedHours} h · one playthrough</h3><p>${esc(roadmapEvidence.difficulty)} difficulty · ${roadmapEvidence.chapters} chapters · No mission replay · Free roam after the story</p><p>PowerPyx [S2] · GTABase [S4]. Each pair shares a published step estimate from PowerPyx. Counts show the trophies tracked in each stage.</p></div>` + cards.join('');
  $('#watch-list').innerHTML = trophies.filter(t => t.missable).sort(byRoadmap).map(t =>
    `<button class="watch-item" data-jump="${t.id}">⚑ ${esc(titleOf(t))}<span>${esc(descriptionOf(t))}</span></button>`).join('');
}

function render() {
  renderProgress(); renderFilters(); renderChecklist(); renderDetail(); renderRoadmap();
  renderNextUp(); renderMissables(); renderSpoilers();
  for (const [view,id] of Object.entries({tracker:'tracker-view',roadmap:'roadmap-view',missables:'missables-view',spoilers:'spoiler-view'})) {
    $('#'+id).hidden = state.view !== view;
  }
  $('#view-heading').textContent = VIEWS[state.view];
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('active',active);
    button.setAttribute('aria-current',active?'page':'false');
  });
}
function exportProgress() {
  const data = {format:'leonida-ledger/progress',version:1,earned:[...state.earned].sort((a,b)=>a-b),spoilers:state.spoilers};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'], {type:'application/json'}));
  const date = new Date();
  const stamp = [date.getFullYear(),date.getMonth()+1,date.getDate()].map(n=>String(n).padStart(2,'0')).join('-');
  const anchor = document.createElement('a');
  anchor.setAttribute('href',url);
  anchor.setAttribute('download','leonida-ledger-progress-'+stamp+'.json');
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Exported '+state.earned.length+' earned trophies and your spoiler preference. Counters stay in this browser.');
}
async function importProgress(file) {
  if (!file) return;
  try {
    if (file.size>65536) throw new Error('File too large (maximum 64 KiB).');
    const data=JSON.parse(await file.text());
    if (data.format!=='leonida-ledger/progress' || data.version!==1 || !Array.isArray(data.earned) || typeof data.spoilers!=='boolean' || !data.earned.every(id=>Number.isInteger(id) && trophies.some(t=>t.id===id))) throw new Error('Choose a valid Leonida Ledger progress export.');
    const next=[...new Set(data.earned)];
    if (!window.confirm(`Replace current progress (${state.earned.length} earned) with this backup (${next.length} earned)?`)) return;
    state.earned=next; state.spoilers=data.spoilers; revealed.clear(); persistProgress(); render();
    if (storageAvailable) notify(`Imported ${next.length} earned trophies. Your previous checklist was replaced.`);
  } catch(error) { notify(`Import stopped: ${error.message || 'Invalid JSON file.'} Current progress is unchanged.`); }
  finally { $('#import-file').value=''; }
}

function wireControls() {
  document.addEventListener('click',event => {
    const d = event.target.dataset;
    if (!d) return;
    if (d.kind) {
      state.kind = d.kind; render(); $('[data-kind="'+d.kind+'"]').focus();
    } else if (d.detail || d.jump) {
      state.selected = Number(d.detail || d.jump);
      if (d.jump) { state.view = 'tracker'; render(); }
      else { renderChecklist(); renderDetail(); }
      $('#detail').focus();
      $('#detail').scrollIntoView({block:'nearest'});
    } else if (d.earned && event.target === $('button[data-earned="'+d.earned+'"]')) {
      toggleEarned(Number(d.earned));
      $('button[data-earned="'+d.earned+'"]')?.focus();
    } else if (d.view) {
      state.view = d.view; render();
    } else if (d.reveal) {
      const id = Number(d.reveal);
      if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
      renderSpoilers();
      $('[data-reveal="'+id+'"]').focus();
    } else if (d.count) {
      const t = trophies.find(t=>t.id===state.selected);
      if (!t?.counter || isSpoiled(t)) return;
      state.counters[t.id] = Math.min(t.counter.target,Math.max(0,counterOf(t)+Number(d.count)));
      persistProgress(); render();
      const next = counterOf(t) === 0 ? '1' : counterOf(t) === t.counter.target ? '-1' : d.count;
      $('[data-count="'+next+'"]')?.focus();
    }
  });
  $('#trophy-list').addEventListener('change',event => {
    const id = event.target.dataset.earned;
    if (id) { toggleEarned(Number(id)); $('input[data-earned="'+id+'"]')?.focus(); }
  });
  $('#spoilers').addEventListener('change',event => {
    state.spoilers = event.target.checked; revealed.clear(); persistProgress(); render();
  });
  $('#search').addEventListener('input',event => { state.query=event.target.value; renderChecklist(); renderDetail(); renderRoadmap(); });
  $('#remaining').addEventListener('change',event => { state.remaining=event.target.checked; renderChecklist(); renderDetail(); renderRoadmap(); });
  $('#export').addEventListener('click',exportProgress);
  $('#import').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',event=>importProgress(event.target.files[0]));
}
function applyDeepLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  const view = params.get('view');
  const kind = params.get('kind');
  const id = Number(params.get('trophy'));
  if (Object.hasOwn(VIEWS,view)) state.view = view;
  if (Object.hasOwn(LABELS,kind) || kind === 'activities') state.kind = kind;
  if (trophies.some(t=>t.id===id)) state.selected = id;
}
async function startLedger() {
  try {
    const response = await fetch('data/trophies.json');
    if (!response.ok) throw new Error('Trophy file unavailable');
    const data = await response.json();
    trophies = [...data.trophies].sort(byId);
    roadmapEvidence = data.roadmapEvidence;
    points = data.psnPoints;
    restoreProgress(); applyDeepLink(); wireControls(); renderAudit(); render();
  } catch {
    notify('The local trophy file could not be loaded. Serve app/ as the site root and reload.');
  }
}
startLedger();
