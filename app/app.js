'use strict';
const STORAGE_KEY = 'leonida-ledger-v1';
const $ = (selector) => document.querySelector(selector);
const kinds = ['all', 'story', 'missable', 'collectibles', 'activities', 'online'];
const labels = {all:'All trophies',story:'Story',missable:'Missable*',collectibles:'Collectibles',activities:'Activities',online:'Online'};
const state = {earned:[], spoilers:true, kind:'all', query:'', remaining:false, selected:30, view:'tracker'};
let trophies = [];
let storageAvailable = true;
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message) { $('#status').textContent = message; }
function isEarned(trophy) { return state.earned.includes(trophy.id); }
function isSpoiled(trophy) { return state.spoilers && trophy.kind === 'story' && !isEarned(trophy); }
function titleOf(trophy) { return isSpoiled(trophy) ? 'Story trophy · sealed' : trophy.name; }
function descriptionOf(trophy) { return isSpoiled(trophy) ? 'Earn this trophy to reveal its story milestone.' : trophy.description; }
function persistProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,earned:state.earned,spoilers:state.spoilers})); }
  catch { storageAvailable = false; notify('Browser storage is unavailable. Export your progress before leaving.'); }
}
function restoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    if (saved.version !== 1 || !Array.isArray(saved.earned) || !saved.earned.every(id => Number.isInteger(id) && trophies.some(t => t.id === id))) throw new Error();
    state.earned = [...new Set(saved.earned)];
    state.spoilers = saved.spoilers !== false;
  } catch {
    try { localStorage.setItem(STORAGE_KEY+'-probe','1'); localStorage.removeItem(STORAGE_KEY+'-probe'); }
    catch { storageAvailable=false; }
    notify(storageAvailable ? 'Saved progress could not be read. Import a backup, or export a new one.' : 'Browser storage is unavailable. Export your progress before leaving.');
  }
}
function toggleEarned(id) {
  state.earned = state.earned.includes(id) ? state.earned.filter(value => value !== id) : [...state.earned,id];
  persistProgress(); render();
}
function filteredTrophies() {
  const query = state.query.trim().toLowerCase();
  return trophies.filter(t => (state.kind === 'all' || t.kind === state.kind || (state.kind === 'missable' && t.missable)) && (!state.remaining || !isEarned(t)) && (!query || `${titleOf(t)} ${descriptionOf(t)} ${t.grade}`.toLowerCase().includes(query)));
}
function renderProgress() {
  const count = state.earned.length;
  $('#total').innerHTML = `${count} <small>/ 55 earned</small>`;
  $('#percent').textContent = `${Math.round(count / 55 * 100)}%`;
  $('#progress').value = count;
  $('#progress-caption').textContent = count === 55 ? 'A Leonida legend. Every trophy earned.' : count ? `${55-count} more stories to tell.` : 'The journey starts here.';
  $('#grade-counts').innerHTML = ['platinum','gold','silver','bronze'].map(grade => `<div class="grade-stat ${grade}"><span>◇ ${trophies.filter(t => t.grade === grade && isEarned(t)).length}<small> / ${trophies.filter(t => t.grade === grade).length}</small></span><small>${grade[0].toUpperCase()+grade.slice(1)}</small></div>`).join('');
}
function renderFilters() {
  $('#filters').innerHTML = kinds.map(kind => `<button class="filter ${state.kind===kind?'active':''}" data-kind="${kind}" aria-pressed="${state.kind===kind}">${labels[kind]}<small>${kind==='all'?55:trophies.filter(t => t.kind===kind || (kind==='missable' && t.missable)).length}</small></button>`).join('');
  $('#spoilers').checked = state.spoilers;
}
function renderChecklist() {
  const visible = filteredTrophies();
  $('#result-count').textContent = `${visible.length} ${visible.length === 1 ? 'trophy' : 'trophies'} shown`;
  $('#trophy-list').innerHTML = visible.length ? visible.map(t => `<article class="trophy-row ${state.selected===t.id?'selected':''} ${isEarned(t)?'earned':''}"><input type="checkbox" data-earned="${t.id}" aria-label="${isEarned(t)?'Mark incomplete:':'Mark earned:'} ${esc(titleOf(t))}" ${isEarned(t)?'checked':''}><button class="trophy-open" data-detail="${t.id}" aria-pressed="${state.selected===t.id}"><span class="trophy-name">${esc(titleOf(t))}</span><span class="trophy-description">${esc(descriptionOf(t))}</span><span class="trophy-meta"><span class="${t.grade}">${t.grade}</span><span>${isSpoiled(t)?'SPOILER PROTECTED':esc(t.kind)}</span>${t.missable?'<span class="watch-tag">⚑ WATCHLIST*</span>':''}</span></button><span class="row-medal ${t.grade}" aria-hidden="true">◇</span><span class="chevron" aria-hidden="true">›</span></article>`).join('') : `<div class="empty">${state.kind==='online'?'No online trophy is explicitly identified in the supplied descriptions.':'No trophies match these filters. Try another kind or clear your search.'}</div>`;
}
function renderDetail() {
  const t = trophies.find(t => t.id === state.selected) || trophies[0];
  const sealed = isSpoiled(t);
  $('#detail').innerHTML = `<div class="detail-top"><span>FIELD NOTES / ${String(t.id).padStart(2,'0')}</span><span class="${t.grade}">◇ ${t.grade}</span></div><h3>${esc(titleOf(t))}</h3><p class="official">${esc(descriptionOf(t))}</p>${sealed ? '<h4>STORY SPOILER PROTECTION</h4><p>Its name, description and guide stay sealed until earned. Turn off “Hide story spoilers” to read ahead.</p>' : `<div class="source-block"><h4>SOURCE / DESCRIPTION-BASED</h4>${t.sources.map(s => `<p class="source-note">${esc(s.name)}</p><span class="source-url">${esc(s.url)}</span>`).join('')}<p class="source-note">External cross-check blocked · No walkthrough verified.</p></div><h4>THE APPROACH</h4><p>${esc(t.steps)}</p><h4>WHERE TO LOOK</h4><p class="where">${esc(t.where)}</p><h4>${t.missable?'⚑ WATCH BEFORE ATTEMPTING':'TIMING & AVAILABILITY'}</h4><p class="timing ${t.missable?'warning':''}">${esc(t.timing)}</p>`}<button class="mark-button" data-earned="${t.id}">${isEarned(t)?'✓ Earned · mark incomplete':'+ Mark as earned'}</button>${t.missable?'<p class="unverified">* Precautionary flag. Permanent missability is unconfirmed.</p>':''}`;
}
function renderRoadmap() {
  const hide = state.spoilers;
  const story = hide ? 'Story mission names and chapter details are sealed. Turn off spoiler protection to read ahead.' : 'Gone Fishing → Chapter 1 → Chapter 2 → Chapter 3 → Chapter 4 → final mission. Also finish Breakfast Run, The Cartel Heist, Child’s Play, Headliners, VCIA Takedown and Operation Savage Glory; their chapter positions are not supplied.';
  const stages = [
    ['Keep a save. Know the watchlist.','Before consequential choices, keep a separate save. Review partner, wanted-level, single-use and undetected conditions before attempting them.','No permanent lockouts confirmed · 5 precautionary flags'],
    ['Follow the story milestones.',story,'12 story trophies · No verified chapter assignments for named missions'],
    ['Build your exploration ledger.','Finish 3 Collectible Card sets; use WAiNK It at 100 locations; discover 100 vehicles. Meditate at every spot and explore all Leonida. Their totals and coordinates are not supplied.','3 sets / 100 locations / 100 vehicles'],
    ['Finish activities. Audit the platinum.','Complete 250 Stunts, win 20 different races, finish 8 stranger strands and 50 Challenges. Earn gold in every Shooting Range challenge. Check 100% Completion, then the remaining trophies.','$250,000 laundered / $100,000 shop spending / 10 registrations']
  ];
  $('#route-stages').innerHTML = stages.map((s,i) => `<article class="stage"><span class="stage-number">0${i+1}</span><div><h3>${s[0]}</h3><p>${esc(s[1])}</p><small>${esc(s[2])}</small></div></article>`).join('');
  const visible = filteredTrophies().filter(t => t.missable);
  $('#watch-list').innerHTML = visible.length ? visible.map(t => `<button class="watch-item" data-jump="${t.id}">⚑ ${esc(t.name)}<span>${esc(t.description)}</span></button>`).join('') : '<p class="source-note">No watchlist items match the current filters. Choose Missable* to see all precautionary flags.</p>';
}
function render() {
  renderProgress(); renderFilters(); renderChecklist(); renderDetail(); renderRoadmap();
  $('#tracker-view').hidden = state.view !== 'tracker';
  $('#roadmap-view').hidden = state.view !== 'roadmap';
  $('#view-heading').textContent = state.view === 'tracker' ? 'Trophy tracker' : 'Platinum route';
  document.querySelectorAll('[data-view]').forEach(button => { button.classList.toggle('active',button.dataset.view===state.view); button.setAttribute('aria-current',button.dataset.view===state.view?'page':'false'); });
}
function exportProgress() {
  const data = {format:'leonida-ledger/progress',version:1,earned:[...state.earned].sort((a,b)=>a-b),spoilers:state.spoilers};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'], {type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href=url; anchor.download='leonida-ledger-progress.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  notify(`Exported ${state.earned.length} earned trophies. Keep the file as your backup.`);
}
async function importProgress(file) {
  if (!file) return;
  try {
    if (file.size>65536) throw new Error('File too large (maximum 64 KiB).');
    const data=JSON.parse(await file.text());
    if (data.format!=='leonida-ledger/progress' || data.version!==1 || !Array.isArray(data.earned) || typeof data.spoilers!=='boolean' || !data.earned.every(id=>Number.isInteger(id) && trophies.some(t=>t.id===id))) throw new Error('Choose a valid Leonida Ledger progress export.');
    const next=[...new Set(data.earned)];
    if (!window.confirm(`Replace current progress (${state.earned.length} earned) with this backup (${next.length} earned)?`)) return;
    state.earned=next; state.spoilers=data.spoilers; persistProgress(); render();
    if (storageAvailable) notify(`Imported ${next.length} earned trophies. Your previous checklist was replaced.`);
  } catch(error) { notify(`Import stopped: ${error.message || 'Invalid JSON file.'} Current progress is unchanged.`); }
  finally { $('#import-file').value=''; }
}
function wireControls() {
  document.addEventListener('click',event => {
    const control=event.target.closest('button'); if (!control) return;
    if (control.dataset.kind) { state.kind=control.dataset.kind; render(); document.querySelector(`[data-kind="${state.kind}"]`).focus(); }
    if (control.dataset.detail) { state.selected=Number(control.dataset.detail); renderChecklist(); renderDetail(); }
    if (control.dataset.earned) toggleEarned(Number(control.dataset.earned));
    if (control.dataset.view) { state.view=control.dataset.view; render(); }
    if (control.dataset.jump) { state.selected=Number(control.dataset.jump); state.view='tracker'; render(); $('#detail').scrollIntoView({block:'nearest'}); }
  });
  $('#trophy-list').addEventListener('change',event => {
    const id=event.target.dataset.earned;
    if(id) { toggleEarned(Number(id)); const next=document.querySelector(`input[data-earned="${id}"]`); if(next) next.focus(); }
  });
  $('#spoilers').addEventListener('change',event => { state.spoilers=event.target.checked; persistProgress(); render(); });
  $('#search').addEventListener('input',event => { state.query=event.target.value; renderChecklist(); renderRoadmap(); });
  $('#remaining').addEventListener('change',event => { state.remaining=event.target.checked; renderChecklist(); renderRoadmap(); });
  $('#export').addEventListener('click',exportProgress);
  $('#import').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',event => importProgress(event.target.files[0]));
}
function applyDeepLink() {
  const params=new URLSearchParams(location.hash.slice(1));
  if (['tracker','roadmap'].includes(params.get('view'))) state.view=params.get('view');
  if (kinds.includes(params.get('kind'))) state.kind=params.get('kind');
  const id=Number(params.get('trophy'));
  if (trophies.some(t=>t.id===id)) state.selected=id;
  // A link never changes saved earnings or spoiler preferences.
}
async function startLedger() {
  try {
    const response=await fetch('data/trophies.json');
    if(!response.ok) throw new Error('Trophy file unavailable');
    const data=await response.json(); trophies=data.trophies;
    restoreProgress(); applyDeepLink(); wireControls(); render();
    if (location.hash) {
      const row=document.querySelector(`[data-detail="${state.selected}"]`);
      if(row && state.view==='tracker') row.closest('.trophy-row').scrollIntoView({block:'nearest'});
      window.scrollTo(0,0);
    }
  } catch { notify('The local trophy file could not be loaded. Serve app/ as the site root and reload.'); }
}
startLedger();
