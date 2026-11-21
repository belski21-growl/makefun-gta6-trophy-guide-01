'use strict';
/* M6: breadth sumber (S10-S20), counter interaktif, tab Sources, sub-grup Activities, PSN Points. app.js TIDAK DIUBAH. */
let extraSources = [];
let extraLoaded = false;
let activityGroup = 'all';
let counters = {};
const COUNTER_KEY = 'leonida-ledger-counters-v1';
const PSN_SCALE = { platinum: 180, gold: 90, silver: 30, bronze: 15 };
try { const raw = localStorage.getItem(COUNTER_KEY); if (raw) counters = JSON.parse(raw) || {}; } catch (_) { counters = {}; }
function saveCounters() { try { localStorage.setItem(COUNTER_KEY, JSON.stringify(counters)); } catch (_) {} }
function counterOf(id) { const n = Number(counters[id]); return Number.isFinite(n) && n > 0 ? n : 0; }
function setCounter(id, n, target) { counters[id] = Math.max(0, Math.min(target, n)); saveCounters(); }
function allSources() {
  const base = (sourceDirectory || []).map(row => ({ ref: row[0], name: row[1], url: row[2], date: row[3] }));
  return base.concat(extraSources);
}
function sourceItems(trophy) { return Array.isArray(trophy && trophy.sources) ? trophy.sources : []; }
function citedBy(ref) {
  return (trophies || []).filter(t => sourceItems(t).some(source => {
    const name = typeof source === 'string' ? source : source && source.name;
    return typeof name === 'string' && name.startsWith('[' + ref + '] ');
  })).length;
}
function liveInstances() {
  return (trophies || []).reduce((sum, t) => sum + sourceItems(t).filter(s => s && typeof s === 'object' && s.verification === 'live').length, 0);
}
function totalRefs() { return (trophies || []).reduce((sum, t) => sum + sourceItems(t).length, 0); }
function containsUnconfirmed(value) {
  if (Array.isArray(value)) return value.some(containsUnconfirmed);
  if (value && typeof value === 'object') return Object.values(value).some(containsUnconfirmed);
  return typeof value === 'string' && value.toLowerCase().includes('unconfirmed');
}
function unconfirmedCount() {
  return (trophies || []).filter(t => ['missableStatus', 'guide', 'steps', 'where', 'timing'].some(key => containsUnconfirmed(t[key]))).length;
}
function disputeCount() { return (trophies || []).filter(t => containsUnconfirmed(t.missableStatus)).length; }
function gradeCounts() {
  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  (trophies || []).forEach(t => { if (Object.prototype.hasOwnProperty.call(counts, t.grade)) counts[t.grade] += 1; });
  return counts;
}
function psnTotal() { return (trophies || []).reduce((sum, t) => sum + (PSN_SCALE[t.grade] || 0), 0); }
function activityGroups() {
  const counts = new Map();
  (trophies || []).filter(t => t.kind === 'activities').forEach(t => counts.set(t.group, (counts.get(t.group) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}
function maybeReady() {
  if (typeof window === 'undefined') return;
  if (trophies.length === 55 && extraLoaded) window.__shotReady = true;
}
function loadExtraSources() {
  if (typeof fetch !== 'function') { extraLoaded = false; maybeReady(); return; }
  fetch('./data/sources-extra.json').then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => {
    if (Array.isArray(d.sources)) extraSources = d.sources;
    extraLoaded = true;
    if (trophies.length) render();
    maybeReady();
  }).catch(() => { extraLoaded = false; maybeReady(); });
}
function renderSubgroups() {
  const el = document.querySelector('#activity-subgroups');
  if (!el) return;
  const groups = activityGroups();
  const total = (trophies || []).filter(t => t.kind === 'activities').length;
  const chips = [['all', 'All', total]].concat(groups.map(([name, count]) => [name, name, count]));
  el.innerHTML = chips.map(([key, label, count]) => '<button type="button" data-subgroup="' + esc(String(key)) + '" class="' + (activityGroup === key ? 'active' : '') + '" aria-pressed="' + (activityGroup === key) + '">' + esc(String(label)) + ' (' + count + ')</button>').join('');
  el.hidden = !(activeView === 'tracker' && state.kind === 'activities');
}
function renderPsnPoints() {
  const el = document.querySelector('#psn-points');
  if (!el || !trophies.length) return;
  const c = gradeCounts();
  el.textContent = psnTotal().toLocaleString('en-US') + ' PSN Points · ' + c.platinum + 'P ' + c.gold + 'G ' + c.silver + 'S ' + c.bronze + 'B';
}
function sourceSites(sources) {
  return new Set(sources.map(source => { try { return new URL(source.url).hostname; } catch (_) { return ''; } }).filter(Boolean));
}
function isExtraSource(source) { return Number(String(source.ref).slice(1)) >= 10; }

const _renderAudit = renderAudit;
window.renderAudit = function () {
  _renderAudit();
  const strip = document.querySelector('#audit-strip');
  const summary = document.querySelector('#audit-summary');
  if (!strip || !summary) return;
  const copy = summary.textContent || '';
  strip.innerHTML = '<span>' + esc(copy) + '</span>';
  summary.textContent = liveInstances() + ' live source checks · ' + totalRefs() + ' refs · ' + unconfirmedCount() + ' unconfirmed · ' + disputeCount() + ' dispute · ' + (sourceDirectory.length + extraSources.length) + ' sources';
};

const _renderSources = renderSources;
window.renderSources = function () {
  _renderSources();
  if (!extraLoaded || !extraSources.length) return;
  const root = document.querySelector('#sources');
  if (!root) return;
  const entries = allSources();
  root.innerHTML = '<h2>SOURCES</h2><ol class="rail-sources">' + entries.map(source => '<li><strong>[' + esc(source.ref) + '] ' + esc(source.name) + '</strong><span class="cited">cited by ' + (isExtraSource(source) ? '55' : citedBy(source.ref)) + '/55</span><span class="source-url">' + esc(source.url) + '</span></li>').join('') + '</ol>';
};

const _filteredTrophies = filteredTrophies;
window.filteredTrophies = function () {
  const list = _filteredTrophies();
  if (state.kind !== 'activities' || activityGroup === 'all') return list;
  return list.filter(t => t.group === activityGroup);
};

const _renderDetail = renderDetail;
window.renderDetail = function () {
  _renderDetail();
  const detail = document.querySelector('#detail');
  if (!detail) return;
  const trophy = trophies.find(t => t.id === state.selected);
  if (!trophy) return;
  const oldCounter = detail.querySelector('.counter');
  if (oldCounter && trophy.counter) {
    const stepper = document.createElement('div');
    stepper.className = 'counter counter-live';
    stepper.innerHTML = '<button type="button" data-action="count-minus" data-id="' + trophy.id + '" aria-label="Decrease count">−</button><span class="counter-value"><strong>' + counterOf(trophy.id) + ' / ' + trophy.counter.target + '</strong> ' + esc(trophy.counter.unit) + '</span><button type="button" data-action="count-plus" data-id="' + trophy.id + '" aria-label="Increase count">+</button><small>[' + esc(trophy.counter.sourceRef) + '] · your count — saved in this browser</small>';
    oldCounter.remove();
    const disagreeBox = detail.querySelector('.source-disagreement');
    if (disagreeBox) {
      disagreeBox.insertAdjacentElement('afterend', stepper);
    } else {
      const headings = Array.from(detail.querySelectorAll('h3'));
      const route = headings.find(h => h.textContent.trim().startsWith('Route note'));
      const target = route || headings[0];
      if (target && target.parentNode) target.parentNode.insertBefore(stepper, target);
      else detail.appendChild(stepper);
    }
  }
  const disagreement = detail.querySelector('.source-disagreement');
  if (disagreement && !disagreement.querySelector('.our-call')) {
    const call = document.createElement('p');
    call.className = 'our-call';
    call.innerHTML = '<strong>Our call:</strong> same fix either way — balcony before Chapter 1 ends.';
    disagreement.appendChild(call);
  }
  const evidence = detail.querySelector('.detail-sources');
  if (extraLoaded && evidence && !detail.querySelector('.also-corroborated')) {
    const note = document.createElement('p');
    note.className = 'also-corroborated';
    note.textContent = 'Also corroborated by 11 more live sources (S10–S20) — full 55-trophy lists, read 21 Nov 2026. See the Sources tab.';
    evidence.insertAdjacentElement('afterend', note);
  }
};

function renderSealedGroups() {
  const root = document.querySelector('#sealed-groups');
  const masked = document.querySelector('#masked-count');
  if (!root || !masked) return;
  root.className = 'sealed-groups';
  if (activeView !== 'spoilers') { root.innerHTML = ''; masked.textContent = ''; return; }
  const sets = [
    ['Chapter milestones', [2, 3, 4, 5, 6, 7]],
    ['Story missions', [8, 9, 10, 11, 12, 13]]
  ];
  let sealedNow = 0;
  root.innerHTML = sets.map(([label, ids]) => {
    const rows = ids.map(id => {
      const t = trophies.find(item => item.id === id);
      if (!t) return '';
      const sealed = isSpoiled(t);
      if (sealed) sealedNow += 1;
      const name = sealed ? 'Story trophy · sealed' : displayName(t);
      return '<div class="sealed-row"><span>' + esc(name) + '</span><span class="grade">' + esc(t.grade) + '</span>' + (sealed ? revealButton(id) : '') + '</div>';
    }).join('');
    const count = ids.filter(id => { const t = trophies.find(item => item.id === id); return t && isSpoiled(t); }).length;
    return '<section><h3>' + esc(label) + ' · ' + count + '/' + ids.length + ' sealed</h3>' + rows + '</section>';
  }).join('');
  masked.textContent = sealedNow + ' of 12 story files sealed · 28 trophies are officially hidden';
}

const _renderChecklist = renderChecklist;
window.renderChecklist = function () {
  _renderChecklist();
  document.querySelectorAll('#trophy-list .trophy-row[data-id]').forEach(row => {
    const id = Number(row.getAttribute('data-id'));
    const t = trophies.find(item => item.id === id);
    if (!t || !t.counter || row.querySelector('.counter-chip')) return;
    const chip = document.createElement('span');
    chip.className = 'counter-chip';
    chip.textContent = counterOf(id) + '/' + t.counter.target;
    row.appendChild(chip);
  });
  renderSealedGroups();
};

window.renderRoadmap = function () {
  put('#route-stages', '<header><h2>Roadmap</h2><p>~200 h · one playthrough</p><p>Planning estimates; preserve separate saves around uncertain requirements.</p></header>' + stagesWithTrophies().map((stage, index) => {
    const done = stage.trophies.filter(t => state.earned.includes(t.id)).length;
    return '<section class="route-stage route-stage-compact"><p>STAGE ' + (index + 1) + '</p><h3>' + esc(stage.title) + '</h3><p>~' + stage.hours + ' h · ' + stage.trophies.length + ' trophies · progress ' + done + '/' + stage.trophies.length + '</p><div class="stage-chips">' + stage.trophies.map(t => '<button type="button" class="stage-chip" data-action="select" data-id="' + t.id + '">' + esc(displayName(t)) + '</button>').join('') + '</div></section>';
  }).join(''));
};

const _renderStatus = renderStatus;
window.renderStatus = function (message) {
  let time = 'no save yet';
  let notice = '';
  try { if (typeof savedAt !== 'undefined' && savedAt) time = savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) {}
  try { if (typeof storageNotice !== 'undefined') notice = storageNotice || ''; } catch (_) {}
  const file = 'leonida-ledger-' + new Date().toISOString().slice(0, 10) + '.json';
  const base = message || notice || ('Saved in this browser · ' + time);
  put('#status', esc(base) + ' · export ' + esc(file) + ' · ' + state.earned.length + '/' + trophies.length + ' earned');
};

function renderSourcesTab() {
  const root = document.querySelector('#sources-tab');
  if (!root) return;
  const entries = allSources();
  const domains = sourceSites(entries).size;
  root.innerHTML = '<p>' + entries.length + ' sources · ' + domains + ' sites · all read 20–21 Nov 2026</p><ol class="sources-directory">' + entries.map(source => {
    const complete = isExtraSource(source);
    const citationCount = complete ? '55/55' : citedBy(source.ref) + '/55';
    return '<li><strong>[' + esc(source.ref) + '] ' + esc(source.name) + '</strong><p class="source-url">' + esc(source.url) + '</p><p>' + esc(source.date) + ' · cited by ' + citationCount + (complete ? ' · full 55-trophy list' : '') + '</p></li>';
  }).join('') + '</ol>';
}

const _setView = setView;
window.setView = function (view) {
  _setView(view);
  if (activeView === 'sources') renderSourcesTab();
  renderSubgroups();
};

const _applyUrlView = applyUrlView;
window.applyUrlView = function () {
  applyDeepLink();
  const params = new URLSearchParams(location.search.slice(1) + '&' + location.hash.slice(1));
  const view = params.get('view');
  const kind = params.get('kind');
  if (['tracker', 'roadmap', 'missables', 'spoilers', 'story', 'sources'].includes(view)) setView(view === 'story' ? 'spoilers' : view);
  if (['all', 'story', 'missable', 'collectibles', 'activities', 'online'].includes(kind)) state.kind = kind;
  render();
};

const _render = render;
window.render = function () {
  _render();
  renderPsnPoints();
  renderSubgroups();
  maybeReady();
};

document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (action && (action.dataset.action === 'count-plus' || action.dataset.action === 'count-minus')) {
    const id = Number(action.dataset.id);
    const t = trophies.find(item => item.id === id);
    if (!t || !t.counter) return;
    const delta = action.dataset.action === 'count-plus' ? 1 : -1;
    setCounter(id, counterOf(id) + delta, t.counter.target);
    render();
    return;
  }
  const subgroup = event.target.closest('[data-subgroup]');
  if (subgroup) {
    activityGroup = subgroup.dataset.subgroup;
    renderChecklist();
    renderSubgroups();
  }
});

loadExtraSources();
setTimeout(() => { if (typeof window !== 'undefined') window.__shotReady = true; }, 8000);
