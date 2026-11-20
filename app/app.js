/* LEONIDA LEDGER: an offline checklist; evidence stays beside each claim. */
'use strict';

const trophies = [];
const state = {
  selected: 28, query: '', kind: 'all', remaining: false,
  spoilers: true, earned: []
};
const STORAGE_KEY = 'leonida-ledger-v1';
const revealed = new Set();
let activeView = 'tracker';
let savedAt = null;
let storageNotice = '';

const sourceDirectory = [
  ['S1', 'Exophase snapshot', 'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/', '18 Nov 2026'],
  ['S2', 'PowerPyx Trophy Guide & Roadmap', 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/', 'read 21 Nov 2026'],
  ['S3', 'PowerPyx All Meditation Spot Locations', 'https://www.powerpyx.com/gta-6-all-meditation-spot-locations/', 'read 21 Nov 2026'],
  ['S4', 'GTABase Trophy List', 'https://www.gtabase.com/articles/gta-6/gta-6-achievements-trophies-list-ps5-xbox-series', 'read 21 Nov 2026'],
  ['S5', 'GmTreks Meditation Guide', 'https://gmtreks.com/gta6/page/01M7QVDV9V6SV9W03RH60W1P4B', 'read 21 Nov 2026'],
  ['S6', 'GTA BOOM Trophy and Achievement List', 'https://www.gtaboom.com/every-gta-6-trophy-and-achievement-at-launch-and-how-to-unlock-them-fc5f', 'read 21 Nov 2026'],
  ['S7', 'Push Square Trophy Guide & Roadmap', 'https://www.pushsquare.com/guides/gta-6-trophy-guide-and-roadmap', 'read 21 Nov 2026'],
  ['S8', 'GameMapa Trophy List', 'https://gamemapa.com/en/gta-6/guides/gta-6-trophy-achievement-list/', 'read 21 Nov 2026'],
  ['S9', 'eGamers Trophy List', 'https://egamers.io/gta-6-trophy-list-all-55-trophies-and-achievements-plus-the-hardest-ones/', 'read 21 Nov 2026']
];

const routeStages = [
  { title: 'Protect the opening window', hours: 8, accepts: t => t.id === 28 },
  { title: 'Finish the five story chapters', hours: 42, accepts: t => t.kind === 'story' },
  { title: 'Review sensitive attempts', hours: 20, accepts: t => t.missable },
  { title: 'Complete the collection circuit', hours: 40, accepts: t => t.kind === 'collectibles' },
  { title: 'Explore activities and challenges', hours: 75, accepts: t => t.kind === 'activities' && t.grade !== 'platinum' },
  { title: 'Resolve remaining objectives and platinum', hours: 15, accepts: () => true }
];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function element(selector) { return document.querySelector(selector); }
function put(selector, html) {
  const node = element(selector);
  if (node) node.innerHTML = html;
}
function isSpoiled(trophy) {
  return trophy.kind === 'story' && state.spoilers && !state.earned.includes(trophy.id) && !revealed.has(trophy.id);
}
function displayName(trophy) { return isSpoiled(trophy) ? 'Story trophy · sealed' : trophy.name; }
function filteredTrophies() {
  const query = state.query.trim().toLocaleLowerCase();
  return trophies.filter(trophy => {
    if (state.kind === 'missable' ? !trophy.missable : state.kind !== 'all' && trophy.kind !== state.kind) return false;
    if (state.remaining && state.earned.includes(trophy.id)) return false;
    if (!query) return true;
    if (isSpoiled(trophy)) return false;
    return `${trophy.name} ${trophy.description}`.toLocaleLowerCase().includes(query);
  });
}

function renderChecklist() {
  const list = filteredTrophies();
  if (!list.length) {
    put('#trophy-list', `<p class="empty-state">${state.kind === 'online' ? 'No online trophy' : 'No matching trophies'}</p>`);
    return;
  }
  const firstSealed = activeView === 'spoilers' ? list.find(isSpoiled) : null;
  const spoilerLead = firstSealed ? `<section class="spoiler-controls" style="position:sticky;top:0;z-index:2;background:var(--panel,#172523);padding:12px"><h2>Story &amp; spoilers</h2><p>Story names are sealed. Reveal one row when you are ready.</p>${revealButton(firstSealed.id)}</section>` : '';
  put('#trophy-list', spoilerLead + list.map(trophy => {
    const earned = state.earned.includes(trophy.id);
    return `<article class="trophy-row ${earned ? 'earned' : ''} ${state.selected === trophy.id ? 'selected' : ''}" data-id="${trophy.id}">
      <button type="button" data-action="earn" data-id="${trophy.id}" aria-label="${earned ? 'Mark incomplete' : 'Mark earned'}: ${esc(displayName(trophy))}" aria-pressed="${earned}">${earned ? '✓' : '○'}</button>
      <button type="button" class="trophy-select" data-action="select" data-id="${trophy.id}"><span class="grade ${esc(trophy.grade)}">${esc(trophy.grade)}</span><strong>${esc(displayName(trophy))}</strong><span>${isSpoiled(trophy) ? 'Story details sealed' : esc(trophy.description)}</span></button>
      ${activeView === 'spoilers' && isSpoiled(trophy) ? revealButton(trophy.id) : ''}
    </article>`;
  }).join(''));
}

function revealButton(id) {
  return `<button type="button" class="reveal-button" data-action="reveal" data-id="${id}" style="display:inline-block;min-height:48px;min-width:112px;padding:12px 20px;font-size:18px;font-weight:700">Reveal</button>`;
}
function renderDetail() {
  const trophy = trophies.find(item => item.id === state.selected);
  if (!trophy) { put('#detail', '<p>Select a trophy to inspect its evidence.</p>'); return; }
  const earned = state.earned.includes(trophy.id);
  if (isSpoiled(trophy)) {
    put('#detail', `<section class="detail-card sealed"><p>STORY &amp; SPOILERS</p><h2>Story trophy · sealed</h2><p>The name, description and guide remain sealed until you reveal or earn this trophy.</p>${revealButton(trophy.id)}<button type="button" data-action="earn" data-id="${trophy.id}">Mark earned</button></section>`);
    return;
  }
  const disagreement = trophy.id === 28 ? `<aside class="source-disagreement"><h3>SOURCES DISAGREE — both versions shown</h3><p><strong>Version A —</strong> PowerPyx's spot guide labels the balcony session missable [S3].</p><p><strong>Version B —</strong> The PowerPyx roadmap and GTABase call the trophy itself only possibly missable because whether the balcony session is required remains unconfirmed [S2][S4].</p></aside>` : '';
  const procedure = String(trophy.steps || '').split('\n').filter(Boolean).map(line => `<p>${esc(line)}</p>`).join('');
  const evidence = (trophy.sources || []).map(source => `<li><strong>${esc(source.name)}</strong><p class="source-url">${esc(source.url)}</p><p>${esc(source.note)}</p><small>${esc(source.verification)}</small></li>`).join('');
  put('#detail', `<section class="detail-card"><p>${esc(trophy.grade)} · ${esc(trophy.kind)} · #${trophy.id}</p><h2>${esc(trophy.name)}</h2><p>${esc(trophy.description)}</p>
    <button type="button" data-action="earn" data-id="${trophy.id}" aria-pressed="${earned}">${earned ? 'Mark incomplete' : 'Mark earned'}</button>
    <p class="missable-status">${esc(trophy.missableStatus)}</p>${disagreement}
    <h3>Route note</h3><p>${esc(trophy.roadmap)}</p><h3>Guide</h3><p>${esc(trophy.guide)}</p>
    <h3>Procedure</h3>${procedure}<h3>Where</h3><p>${esc(trophy.where)}</p><h3>Timing</h3><p>${esc(trophy.timing)}</p>
    ${trophy.counter ? `<p class="counter">${esc(trophy.counter.target)} ${esc(trophy.counter.unit)} [${esc(trophy.counter.sourceRef)}]</p>` : ''}
    <h3>Evidence</h3><ul class="detail-sources">${evidence}</ul></section>`);
}

function stagesWithTrophies() {
  const allocated = new Set();
  return routeStages.map(stage => ({ ...stage, trophies: trophies.filter(trophy => {
    if (allocated.has(trophy.id) || !stage.accepts(trophy)) return false;
    allocated.add(trophy.id);
    return true;
  }) }));
}
function renderRoadmap() {
  put('#route-stages', `<header><h2>Roadmap</h2><p>~200 h · one playthrough</p><p>Planning estimates; preserve separate saves around uncertain requirements.</p></header>${stagesWithTrophies().map((stage, index) => {
    const done = stage.trophies.filter(t => state.earned.includes(t.id)).length;
    return `<section class="route-stage"><p>STAGE ${index + 1}</p><h3>${esc(stage.title)}</h3><p>~${stage.hours} h · ${stage.trophies.length} trophies · progress ${done}/${stage.trophies.length}</p><ul>${stage.trophies.map(t => `<li><button type="button" data-action="select" data-id="${t.id}">${esc(displayName(t))}</button></li>`).join('')}</ul></section>`;
  }).join('')}`);
}

function renderAudit() {
  const cited = trophies.filter(t => Array.isArray(t.sources) && t.sources.length > 0).length;
  const backed = trophies.filter(t => (t.sources || []).filter(s => s.verification === 'live').length >= 2).length;
  const disputes = trophies.filter(t => /unconfirmed/i.test(t.missableStatus || '')).length;
  const copy = `${cited}/${trophies.length} claims cited · ${backed} backed by 2+ sources · ${disputes} ${disputes === 1 ? 'dispute' : 'disputes'}`;
  put('#audit-strip', `<span>${esc(copy)}</span><span>Zero network</span>`);
  put('#audit-summary', esc(copy));
}
function renderSources() {
  const html = `<h2>SOURCES</h2><ol>${sourceDirectory.map(([ref, name, url, date]) => `<li><strong>[${ref}] ${esc(name)}</strong><p>${esc(date)}</p><p class="source-url">${esc(url)}</p></li>`).join('')}</ol>`;
  put('#sources', html);
  put('#source-list', html);
}
function renderNextUp() {
  const next = trophies.filter(t => !state.earned.includes(t.id)).slice(0, 3);
  put('#next-up', `<h2>NEXT UP</h2>${next.map(t => `<button type="button" data-action="select" data-id="${t.id}">${esc(displayName(t))}</button>`).join('')}`);
}
function renderStatus(message) {
  const time = savedAt ? savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'not saved yet';
  put('#status', `${esc(message || storageNotice || `Saved in this browser · ${time}`)} · ${state.earned.length}/${trophies.length} earned`);
}
function render() {
  renderChecklist(); renderDetail(); renderRoadmap(); renderAudit(); renderSources(); renderNextUp(); renderStatus();
}

function validEarned(values) {
  if (!Array.isArray(values)) throw new Error('Progress must contain an earned array.');
  const ids = new Set(trophies.map(t => t.id));
  return [...new Set(values.filter(id => Number.isInteger(id) && ids.has(id)))].sort((a, b) => a - b);
}
function persistProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ earned: state.earned.slice() }));
    savedAt = new Date();
    storageNotice = '';
    renderStatus();
    return true;
  } catch (_) {
    storageNotice = 'Browser storage unavailable; export to keep your progress';
    renderStatus();
    return false;
  }
}
function restoreProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.earned = raw ? validEarned(JSON.parse(raw).earned) : [];
    if (raw) savedAt = new Date();
    return true;
  } catch (_) {
    state.earned = [];
    storageNotice = 'Saved progress could not be read';
    renderStatus();
    return false;
  }
}
function toggleEarned(id) {
  id = Number(id);
  if (!trophies.some(t => t.id === id)) return;
  if (state.earned.includes(id)) {
    state.earned = state.earned.filter(value => value !== id);
    revealed.delete(id);
  } else state.earned = [...state.earned, id].sort((a, b) => a - b);
  persistProgress(); render();
}
function importProgress(input) {
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    const earned = validEarned(parsed && parsed.earned);
    state.earned = earned;
    revealed.clear();
    persistProgress(); render();
    return true;
  } catch (_) { renderStatus('Import failed: choose a Ledger JSON progress export'); return false; }
}
function exportProgress(download = false) {
  const json = JSON.stringify({ earned: state.earned.slice() }, null, 2);
  if (download && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `leonida-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return json;
}
function applyDeepLink(value) {
  const text = value == null && typeof location !== 'undefined' ? `${location.search || ''}${location.hash || ''}` : String(value || '');
  const match = text.match(/(?:[?#&]trophy=|#(?:trophy[-=/])?)(\d+)(?:\D|$)/);
  if (!match) return false;
  const id = Number(match[1]);
  if (!trophies.some(t => t.id === id)) return false;
  state.selected = id;
  renderDetail();
  return true;
}

function setView(view) {
  activeView = view === 'story' ? 'spoilers' : view;
  state.kind = activeView === 'missables' ? 'missable' : activeView === 'spoilers' ? 'story' : 'all';
  if (activeView === 'spoilers') {
    const first = trophies.find(isSpoiled) || trophies.find(t => t.kind === 'story');
    if (first) state.selected = first.id;
  }
  const route = element('#route-stages');
  const checklist = element('#trophy-list');
  const detail = element('#detail');
  if (route) route.hidden = activeView !== 'roadmap';
  if (checklist) { checklist.hidden = activeView === 'roadmap'; checklist.scrollTop = 0; }
  if (detail) detail.hidden = activeView === 'roadmap';
  if (document.querySelectorAll) {
    document.querySelectorAll('[data-view-panel]').forEach(panel => { panel.hidden = panel.getAttribute('data-view-panel') !== activeView; });
    document.querySelectorAll('[data-view]').forEach(tab => { tab.setAttribute('aria-selected', String(tab.getAttribute('data-view') === view)); });
  }
  render();
}
function bindControls() {
  if (!document.addEventListener) return;
  document.addEventListener('click', event => {
    const target = event.target.closest ? event.target.closest('[data-action], [data-view], [data-kind], #export-progress') : null;
    if (!target) return;
    const id = Number(target.getAttribute('data-id'));
    const action = target.getAttribute('data-action');
    if (action === 'earn') toggleEarned(id);
    else if (action === 'select' && trophies.some(t => t.id === id)) { state.selected = id; render(); }
    else if (action === 'reveal') { revealed.add(id); render(); }
    else if (action === 'export' || target.id === 'export-progress') exportProgress(true);
    else if (target.hasAttribute('data-view')) setView(target.getAttribute('data-view'));
    else if (target.hasAttribute('data-kind')) { state.kind = target.getAttribute('data-kind'); renderChecklist(); }
  });
  document.addEventListener('input', event => {
    if (event.target.matches('#search, #trophy-search, [data-search]')) { state.query = event.target.value; renderChecklist(); }
  });
  document.addEventListener('change', async event => {
    const target = event.target;
    if (target.matches('#remaining, [data-remaining]')) state.remaining = target.checked;
    else if (target.matches('#spoilers, [data-spoilers]')) { state.spoilers = target.checked; revealed.clear(); }
    else if (target.matches('#kind, [data-kind-select]')) state.kind = target.value;
    else if (target.matches('#import-progress, [data-import]') && target.files && target.files[0]) {
      try { importProgress(await target.files[0].text()); } catch (_) { renderStatus('Import file could not be read'); }
    }
    render();
  });
}
function applyUrlView() {
  applyDeepLink();
  const params = new URLSearchParams(location.search.slice(1) + '&' + location.hash.slice(1));
  const view = params.get('view');
  const kind = params.get('kind');
  if (['tracker', 'roadmap', 'missables', 'spoilers', 'story'].includes(view)) setView(view === 'story' ? 'spoilers' : view);
  if (['all', 'story', 'missable', 'collectibles', 'activities', 'online'].includes(kind)) state.kind = kind;
  render();
}
async function boot() {
  try {
    const response = await fetch('./data/trophies.json');
    if (!response.ok) throw new Error('Local trophy data could not be loaded');
    const data = await response.json();
    if (!Array.isArray(data.trophies)) throw new Error('Local trophy data is invalid');
    trophies.push(...data.trophies);
    restoreProgress();
    bindControls();
    setView('tracker');
    applyUrlView();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('hashchange', applyUrlView);
    }
  } catch (error) { renderStatus(error.message); }
}
if (typeof fetch === 'function' && typeof document !== 'undefined') boot();
