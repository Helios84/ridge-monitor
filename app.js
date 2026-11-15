// Developed with AI assistance (see README → Use of AI)
// RIDGE Monitor — app.js
// Status logic, rendering, hand-made SVG charts and localStorage handling.
// All health text and every threshold comes from data.js.
(function () {
  'use strict';

  const D = window.RIDGE_DATA;
  const PA = D.PROTOTYPE_ASSUMPTIONS;
  const addDays = D.util.addDays;
  const parseIso = D.util.parseIso;
  const KEY = 'ridge-monitor:v1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Status is never shown by color alone: each one has an icon and a word.
  const STATUS = {
    ok: { label: 'Usual', icon: '✓', rank: 1 },
    watch: { label: 'Watch', icon: '!', rank: 2 },
    act: { label: 'Act', icon: '✕', rank: 3 },
    nodata: { label: 'No data', icon: '—', rank: 0 }
  };

  const state = {
    entries: {},            // { 'yyyy-mm-dd': { indicatorId: value, note: '' } }
    env: 'mars',
    missionStart: null,
    today: D.util.iso(new Date()),
    region: 'brain',
    hazard: null,           // open RIDGE tile, or null
    drawer: false,          // region details drawer open?
    attAll: false,          // "Needs attention" expanded to show every item?
    sim: false,             // space weather simulation running? (never saved)
    indicator: 'sleepHours',
    range: 30,
    storageOk: true
  };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function sourceLink(id, text) {
    const s = D.SOURCES[id];
    return `<a class="${text ? 'src-full' : 'cite'}" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.org + ' — ' + s.title)}">${esc(text || id)}</a>`;
  }

  // Escape text, then turn [S5]-style markers into links to the source page.
  // "fact [S5]." is shown as "fact. [S5]" so the period stays with the sentence.
  function cite(text) {
    return esc(text)
      .replace(/\s*((?:\[S\d+[a-z]?\]\s*)+)([.,;])/g, (m, marks, punct) => punct + ' ' + marks.trim())
      .replace(/\[(S\d+[a-z]?)\]/g, (m, id) => (D.SOURCES[id] ? sourceLink(id) : m));
  }

  // Collect the source IDs mentioned in a list of texts, in order, no repeats.
  function sourceIds(texts) {
    const out = [];
    texts.forEach(t => {
      (String(t).match(/\[(S\d+[a-z]?)\]/g) || []).forEach(tok => {
        const id = tok.slice(1, -1);
        if (D.SOURCES[id] && out.indexOf(id) === -1) out.push(id);
      });
    });
    return out;
  }

  function sourcesBlock(ids, emptyText) {
    if (!ids.length) return `<p class="sources"><span class="src-label">Source:</span> ${esc(emptyText || 'none')}</p>`;
    return `<p class="sources"><span class="src-label">Source:</span> ` +
      ids.map(id => sourceLink(id, D.SOURCES[id].org + ' — ' + D.SOURCES[id].title)).join(' · ') + `</p>`;
  }

  function fmtDate(isoStr) {
    const d = parseIso(isoStr);
    return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function fmtDateLong(isoStr) {
    const d = parseIso(isoStr);
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function missionDay() {
    return Math.round((parseIso(state.today) - parseIso(state.missionStart)) / 864e5) + 1;
  }

  function currentEnv() {
    return D.ENVIRONMENTS.find(e => e.id === state.env) || D.ENVIRONMENTS[0];
  }

  function pill(status) {
    const s = STATUS[status];
    return `<span class="pill st-${status}"><span class="pill-ic" aria-hidden="true">${s.icon}</span>${s.label}</span>`;
  }

  function hazChips(letters) {
    if (!letters.length) return '<span class="haz haz-none" title="No direct RIDGE source">general</span>';
    return letters.map(L => `<span class="haz" title="${esc(L + ' — ' + D.HAZARDS[L].name)}">${L}<span class="sr-only"> (${esc(D.HAZARDS[L].name)})</span></span>`).join('');
  }

  function announce(msg) {
    const live = $('#live');
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 30);
  }

  // ---------------------------------------------------------------------------
  // Storage — localStorage only, always inside try/catch.
  // ---------------------------------------------------------------------------
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ entries: state.entries, env: state.env, missionStart: state.missionStart }));
      state.storageOk = true;
    } catch (err) {
      state.storageOk = false;
    }
  }

  function resetDemo() {
    const demo = D.generateDemoData(state.today);
    state.entries = demo.entries;
    state.missionStart = demo.missionStart;
    state.env = 'mars';
    persist();
  }

  function loadState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (err) {
      state.storageOk = false;
    }
    if (saved && saved.entries && typeof saved.entries === 'object' && saved.missionStart) {
      state.entries = saved.entries;
      state.missionStart = saved.missionStart;
      if (D.ENVIRONMENTS.some(e => e.id === saved.env)) state.env = saved.env;
    } else {
      resetDemo();
    }
  }

  // ---------------------------------------------------------------------------
  // Status logic. Missing data is always 'nodata' — it never counts as fine.
  // ---------------------------------------------------------------------------
  let cache = {};
  function invalidate() { cache = {}; }

  // The simulated dosimeter reading for today, or null when no simulation runs.
  function simDose() {
    if (!state.sim) return null;
    state.sim = false;                 // read the real baseline, not the simulated value
    const b = baseline('dosimeter');
    state.sim = true;
    return Math.round((b === null ? 1 : b) * PA.simulation.dosimeterFactor * 100) / 100;
  }

  function val(date, id) {
    if (state.sim && id === 'dosimeter' && date === state.today) return simDose();
    const e = state.entries[date];
    if (!e) return null;
    const v = e[id];
    return (v === undefined || v === null || v === '') ? null : v;
  }

  // Personal baseline: average of the first N recorded days of an indicator.
  function baseline(id) {
    const k = 'base|' + id;
    if (k in cache) return cache[k];
    const xs = [];
    const dates = Object.keys(state.entries).sort();
    for (let i = 0; i < dates.length && xs.length < PA.baselineDays; i++) {
      const v = val(dates[i], id);
      if (typeof v === 'number') xs.push(v);
    }
    const b = xs.length >= PA.baselineDays ? xs.reduce((a, c) => a + c, 0) / xs.length : null;
    cache[k] = b;
    return b;
  }

  function average(id, date, days) {
    const xs = [];
    for (let i = 0; i < days; i++) {
      const v = val(addDays(date, -i), id);
      if (typeof v === 'number') xs.push(v);
    }
    return xs.reduce((a, c) => a + c, 0) / xs.length;
  }

  function runLength(id, date) {
    let n = 0;
    while (val(addDays(date, -n), id) === true) n++;
    return n;
  }

  function fmtVal(id, v) {
    const ind = D.INDICATORS[id];
    if (v === null) return '—';
    if (ind.kind === 'flag') return v ? 'Yes' : 'No';
    return Number(v).toFixed(ind.decimals);
  }

  function unitSuffix(id) {
    const u = D.INDICATORS[id].unit;
    return u === '/5' ? '/5' : u ? ' ' + u : '';
  }

  function withUnit(id, v) {
    if (v === null || D.INDICATORS[id].kind === 'flag') return fmtVal(id, v);
    return fmtVal(id, v) + unitSuffix(id);
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Returns { status, value, reason } for one indicator on one day.
  function evaluate(id, date) {
    const k = id + '|' + date;
    if (cache[k]) return cache[k];
    const ind = D.INDICATORS[id];
    const th = PA.thresholds[id];
    const v = val(date, id);
    const u = ind.unit === '/5' ? '' : ' ' + ind.unit;
    let status = 'ok';
    let reason = '';

    if (v === null) {
      status = 'nodata';
      reason = 'Not recorded.';
    } else if (th.type === 'range') {
      const inUsual = v >= th.usual[0] && v <= th.usual[1];
      const inWatch = v >= th.watch[0] && v <= th.watch[1];
      status = inUsual ? 'ok' : inWatch ? 'watch' : 'act';
      reason = inUsual ? `Within the illustrative usual range (${th.usual[0]}–${th.usual[1]}${u}).`
        : inWatch ? `Outside the illustrative usual range (${th.usual[0]}–${th.usual[1]}${u}).`
          : `Outside the illustrative watch range (${th.watch[0]}–${th.watch[1]}${u}).`;
    } else if (th.type === 'min' || th.type === 'max') {
      const below = th.type === 'min';
      const x = th.avgDays ? average(id, date, th.avgDays) : v;
      const pastAct = below ? x < th.act : x > th.act;
      const pastWatch = below ? x < th.watch : x > th.watch;
      status = pastAct ? 'act' : pastWatch ? 'watch' : 'ok';
      const word = below ? 'below' : 'above';
      const pre = th.avgDays ? `${th.avgDays}-day average ${x.toFixed(0)}${u} is ` : '';
      const tail = status === 'ok' ? `at or ${below ? 'above' : 'below'} the illustrative watch level (${th.watch}${u}).`
        : `${word} the illustrative ${status} level (${status === 'act' ? th.act : th.watch}${u}).`;
      reason = cap(pre + tail);
    } else if (th.type === 'baselineDelta' || th.type === 'baselineRatio') {
      const b = baseline(id);
      if (b === null) {
        status = 'nodata';
        reason = `No personal baseline yet (needs ${PA.baselineDays} recorded days).`;
      } else if (th.type === 'baselineDelta') {
        const d = v - b;
        status = Math.abs(d) > th.act ? 'act' : Math.abs(d) > th.watch ? 'watch' : 'ok';
        reason = `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}${u} from your baseline (${b.toFixed(0)}${u}). Illustrative watch level: ±${th.watch}.`;
      } else {
        const r = b > 0 ? v / b : 0;
        status = r > th.act ? 'act' : r > th.watch ? 'watch' : 'ok';
        reason = `${r.toFixed(1)}× your baseline (${b.toFixed(ind.decimals)}${u}). Illustrative watch level: ${th.watch}×.`;
      }
    } else if (th.type === 'flag') {
      if (!v) {
        reason = 'Nothing reported.';
      } else {
        const run = runLength(id, date);
        status = run >= th.actAfterDays ? 'act' : 'watch';
        reason = run > 1 ? `Reported ${run} days in a row.` : 'Reported.';
      }
    }
    cache[k] = { status: status, value: v, reason: reason };
    return cache[k];
  }

  // Worst status in a group. All missing → 'nodata'. Also counts missing items.
  function summarize(ids, date) {
    let worst = 'nodata';
    let missing = 0;
    const items = ids.map(id => {
      const ev = evaluate(id, date);
      if (ev.status === 'nodata') missing++;
      if (STATUS[ev.status].rank > STATUS[worst].rank) worst = ev.status;
      return { id: id, ev: ev };
    });
    return { status: worst, missing: missing, total: ids.length, items: items };
  }

  function hazardIndicators(letter) {
    return D.INDICATOR_ORDER.filter(id => D.INDICATORS[id].hazards.indexOf(letter) !== -1);
  }

  function summaryText(sum) {
    if (!sum.total) return '';
    if (sum.status === 'nodata') return 'No data today';
    const flagged = sum.items.filter(it => it.ev.status === 'act' || it.ev.status === 'watch').map(it => D.INDICATORS[it.id].short);
    let text = flagged.length ? flagged.join(', ') : 'All recorded indicators usual';
    if (sum.missing) text += ` · ${sum.missing} of ${sum.total} not recorded`;
    return text;
  }

  function regionOf(indicatorId) {
    return D.REGION_ORDER.find(r => D.REGIONS[r].indicators.indexOf(indicatorId) !== -1) || null;
  }

  // ---------------------------------------------------------------------------
  // Rendering — header, RIDGE strip, environment context
  // ---------------------------------------------------------------------------
  function renderHeader() {
    $('#crew-name').textContent = D.CREW.id;
    $('#crew-name').title = D.CREW.note;
    const onMars = state.env === 'mars' || state.env === 'rover';
    $('#stat-day').textContent = (onMars ? 'Sol ' : 'Day ') + missionDay();
    $('#mission-day').textContent = fmtDateLong(state.today);
    const delay = PA.commDelay[currentEnv().id];
    $('#stat-link').textContent = cap(delay.text.replace(' one way', ''));
    $('#stat-link-note').textContent = delay.sourced ? 'one-way' : 'one-way, illustrative';
    const sel = $('#env');
    if (!sel.options.length) {
      sel.innerHTML = D.ENVIRONMENTS.map(e => `<option value="${e.id}">${esc(e.label)}</option>`).join('');
    }
    sel.value = state.env;
    $('#storage-warning').hidden = state.storageOk;
    renderNextTask();
  }

  // Header: the next routine task that is still open, by its illustrative time of day.
  function renderNextTask() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = D.ROUTINE.filter(t => !taskState(t, state.today).done);
    let main = 'All done';
    let sub = 'for today';
    if (open.length) {
      const timed = open.filter(t => PA.routine.times[t.id] !== undefined);
      const due = timed.filter(t => PA.routine.times[t.id] <= mins);
      const next = timed.filter(t => PA.routine.times[t.id] > mins).sort((x, y) => PA.routine.times[x.id] - PA.routine.times[y.id])[0];
      if (due.length) {
        main = due[0].label;
        sub = 'due now';
      } else if (next) {
        const d = PA.routine.times[next.id] - mins;
        main = next.label;
        sub = 'in ' + (d >= 60 ? Math.floor(d / 60) + ' h ' : '') + (d % 60) + ' min';
      } else {
        main = open[0].label;
        sub = 'this week';
      }
    }
    $('#stat-next').textContent = main;
    $('#stat-next-sub').textContent = sub + ' · illustrative schedule';
  }

  // Ring indicator: the arc is the share of this hazard's indicators that are Usual.
  function ringSvg(letter, frac) {
    const c = 125.66;
    return `<svg class="ring" viewBox="0 0 50 50" aria-hidden="true"><circle class="trk" cx="25" cy="25" r="20"/>` +
      (frac > 0 ? `<circle class="val" cx="25" cy="25" r="20" stroke-dasharray="${(c * frac).toFixed(1)} ${c}"/>` : '') +
      `<text x="25" y="31" text-anchor="middle">${letter}</text></svg>`;
  }

  function renderStrip() {
    const delay = PA.commDelay[currentEnv().id];
    $('#ridge-strip').innerHTML = D.HAZARD_ORDER.map(L => {
      const hz = D.HAZARDS[L];
      const open = state.hazard === L;
      let st, badge, sub, frac;
      if (L === 'D') {
        st = 'info';
        frac = 1;
        badge = '<span class="pill st-info"><span class="pill-ic" aria-hidden="true">i</span>Comm delay</span>';
        sub = cap(delay.text) + (delay.sourced ? '' : ' (illustrative)');
      } else {
        const sum = summarize(hazardIndicators(L), state.today);
        st = sum.status;
        frac = sum.total ? sum.items.filter(it => it.ev.status === 'ok').length / sum.total : 0;
        badge = pill(st);
        sub = summaryText(sum);
      }
      return `<div class="tile st-${st}${open ? ' open' : ''}">
        <button type="button" class="tile-btn" data-hazard="${L}" aria-expanded="${open}" aria-controls="hazard-panel">
          ${ringSvg(L, frac)}
          <span class="tile-body">
            <span class="tile-name">${esc(hz.name)}</span>
            ${badge}
            <span class="tile-sub">${esc(sub)}</span>
          </span>
        </button>
        ${sourceLink(hz.source, 'Source: ' + D.SOURCES[hz.source].org)}
      </div>`;
    }).join('');
  }

  function renderHazardPanel() {
    const panel = $('#hazard-panel');
    if (!state.hazard) { panel.hidden = true; panel.innerHTML = ''; return; }
    const L = state.hazard;
    const hz = D.HAZARDS[L];
    const regions = D.REGION_ORDER.filter(r => D.REGIONS[r].hazards.indexOf(L) !== -1);
    const inds = hazardIndicators(L);
    panel.hidden = false;
    panel.innerHTML = `
      <div class="panel-head">
        <h3><span class="tile-letter small" aria-hidden="true">${L}</span> ${esc(hz.name)}</h3>
        <button type="button" class="btn ghost" data-close-hazard>Close</button>
      </div>
      <ul class="facts">${hz.facts.map(f => `<li>${cite(f)}</li>`).join('')}</ul>
      ${regions.length ? `<p class="muted small">Body regions affected:</p>
        <div class="row wrap">${regions.map(r => `<button type="button" class="btn chip" data-region="${r}" data-scroll="1">${esc(D.REGIONS[r].name)}</button>`).join('')}</div>` : ''}
      ${inds.length ? `<p class="muted small">Check-in indicators tagged ${L}: ${inds.map(id => esc(D.INDICATORS[id].short)).join(', ')}.</p>`
        : `<p class="muted small">No check-in indicator is tagged ${L}. This hazard sets the communication delay used in the flight surgeon report.</p>`}
      ${sourcesBlock(sourceIds(hz.facts))}`;
  }

  function renderEnvContext() {
    const env = currentEnv();
    $('#env-context').innerHTML = `
      <div class="ctx"><span class="ctx-k"><span class="haz">D</span> Communication</span><span>${cite(env.comm)}</span></div>
      <div class="ctx"><span class="ctx-k"><span class="haz">G</span> Gravity</span><span>${cite(env.gravity)}</span></div>
      <div class="ctx"><span class="ctx-k"><span class="haz">R</span> Radiation</span><span>${cite(env.radiation)}</span></div>`;
  }

  // ---------------------------------------------------------------------------
  // Rendering — body figure and region panel
  // ---------------------------------------------------------------------------
  function renderBody() {
    $$('#body-figure .region').forEach(g => {
      const id = g.dataset.region;
      const sum = summarize(D.REGIONS[id].indicators, state.today);
      g.setAttribute('class', `region${id === 'radiation' ? ' region-body' : ''} st-${sum.status}${state.region === id && state.drawer ? ' selected' : ''}`);
      g.setAttribute('aria-label', `${D.REGIONS[id].name}: ${STATUS[sum.status].label}`);
      g.setAttribute('aria-pressed', state.region === id && state.drawer ? 'true' : 'false');
    });
    $('#region-list').innerHTML = D.REGION_ORDER.map(id => {
      const r = D.REGIONS[id];
      const sum = summarize(r.indicators, state.today);
      const on = state.region === id && state.drawer;
      return `<li><button type="button" class="region-btn st-${sum.status}${on ? ' selected' : ''}" data-region="${id}" aria-pressed="${on}">
        <span class="region-dot" aria-hidden="true">${STATUS[sum.status].icon}</span>
        <span class="region-name">${esc(r.name)}<span class="sr-only">: ${STATUS[sum.status].label}</span></span>
        <span class="chips">${hazChips(r.hazards)}</span>
      </button></li>`;
    }).join('');
  }

  function indicatorRow(id) {
    const ind = D.INDICATORS[id];
    const ev = evaluate(id, state.today);
    const steps = (ev.status === 'watch' || ev.status === 'act') ? ind.guidance[ev.status] : null;
    return `<li class="ind-row">
      <div class="ind-row-head">
        ${pill(ev.status)}
        <span class="ind-row-name">${esc(ind.short)}</span>
        <span class="ind-row-val">${esc(withUnit(id, ev.value))}</span>
      </div>
      <p class="reason">${esc(ev.reason)}</p>
      <p class="why">${cite(ind.why)}</p>
      ${steps ? `<p class="todo-h">What to do</p><ol class="steps">${steps.map(s => `<li>${cite(s)}</li>`).join('')}</ol>` : ''}
      ${ev.status === 'nodata' ? `<p class="todo-h">What to do</p><ol class="steps"><li>Take this measurement and add it in the <a href="#checkin-sec">daily check-in</a>.</li></ol>` : ''}
      <details class="how"><summary>How to measure</summary>
        <ol>${ind.how.map(s => `<li>${cite(s)}</li>`).join('')}</ol>
        ${ind.howNote ? `<p class="muted small">${esc(ind.howNote)}</p>` : ''}
        <p class="muted small">Illustrative prototype instructions. Follow your mission's medical procedures.</p>
      </details>
      <button type="button" class="btn ghost" data-indicator="${id}">Show trend</button>
    </li>`;
  }

  function renderRegionPanel() {
    const id = state.region;
    const r = D.REGIONS[id];
    const sum = summarize(r.indicators, state.today);
    const list = arr => `<ul class="facts">${arr.map(t => `<li>${cite(t)}</li>`).join('')}</ul>`;
    const texts = r.effects.concat(r.inSpace, r.helps, r.indicators.map(i => D.INDICATORS[i].why));
    $('#region-panel').innerHTML = `
      <div class="panel-head">
        <h3>${esc(r.name)} <span class="chips">${hazChips(r.hazards)}</span></h3>
        ${pill(sum.status)}
      </div>
      <p class="fn"><strong>What it does:</strong> ${esc(r.fn)} <span class="muted small">(general anatomy)</span></p>
      <h4>How spaceflight affects it</h4>
      ${list(r.effects)}
      <h4>Your self-check today</h4>
      <ul class="ind-rows">${r.indicators.map(indicatorRow).join('')}</ul>
      <h4>How it is measured in space</h4>
      ${list(r.inSpace)}
      <h4>What helps</h4>
      ${list(r.helps)}
      ${sourcesBlock(sourceIds(texts))}`;
  }

  // ---------------------------------------------------------------------------
  // Rendering — guidance, report, indicator cards
  // ---------------------------------------------------------------------------
  function guidanceCard(id, ev) {
    const ind = D.INDICATORS[id];
    const steps = ind.guidance[ev.status];
    const region = regionOf(id);
    return `<article class="card g-card st-${ev.status}">
      <div class="panel-head">
        <h4>${esc(ind.short)} <span class="chips">${hazChips(ind.hazards)}</span></h4>
        ${pill(ev.status)}
      </div>
      <p class="reason"><strong>${esc(withUnit(id, ev.value))}</strong> · ${esc(ev.reason)}</p>
      <p class="why">${cite(ind.why)}</p>
      <p class="todo-h">What to do</p>
      <ol class="steps">${steps.map(s => `<li>${cite(s)}</li>`).join('')}</ol>
      <div class="row wrap">
        <button type="button" class="btn ghost" data-indicator="${id}">Show trend</button>
        ${region ? `<button type="button" class="btn ghost" data-region="${region}" data-scroll="1">Open ${esc(D.REGIONS[region].name)}</button>` : ''}
      </div>
      ${sourcesBlock(sourceIds([ind.why].concat(steps)), ind.noSource || 'none')}
    </article>`;
  }

  function renderGuidance() {
    const all = D.INDICATOR_ORDER.map(id => ({ id: id, ev: evaluate(id, state.today) }));
    const act = all.filter(x => x.ev.status === 'act');
    const watch = all.filter(x => x.ev.status === 'watch');
    const none = all.filter(x => x.ev.status === 'nodata');
    let html = '';
    if (act.length) {
      html += `<h3 class="g-head">${pill('act')} Act now and contact the flight surgeon</h3>
        <div class="g-grid">${act.map(x => guidanceCard(x.id, x.ev)).join('')}</div>`;
    }
    if (watch.length) {
      html += `<h3 class="g-head">${pill('watch')} Watch: self-care and check again</h3>
        <div class="g-grid">${watch.map(x => guidanceCard(x.id, x.ev)).join('')}</div>`;
    }
    if (none.length) {
      html += `<h3 class="g-head">${pill('nodata')} No data: take these measurements</h3>
        <div class="card g-none"><p>${none.map(x => esc(D.INDICATORS[x.id].short)).join(', ')}.</p>
        <p class="muted small">Missing data is never counted as fine. <a href="#checkin-sec">Go to the daily check-in</a>.</p></div>`;
    }
    if (!act.length && !watch.length && !none.length) {
      html = `<div class="card g-none"><p>${pill('ok')} All indicators are recorded and in their usual range today.</p></div>`;
    }
    $('#guidance').innerHTML = html;

    const env = currentEnv();
    const delay = PA.commDelay[env.id];
    $('#delay-line').innerHTML = `<strong>${esc(env.label)}.</strong> Expected one-way communication delay: <strong>${esc(delay.text)}</strong>` +
      (delay.sourced ? ` ${sourceLink('S3')}. Start the steps above now. Do not wait for a reply from Earth.` : ` <span class="muted">(illustrative prototype value)</span>.`);
  }

  function buildReport() {
    const env = currentEnv();
    const delay = PA.commDelay[env.id];
    const all = D.INDICATOR_ORDER.map(id => ({ id: id, ev: evaluate(id, state.today) }));
    const line = x => `  - ${D.INDICATORS[x.id].short}: ` + (x.ev.value === null ? 'not recorded' : `${withUnit(x.id, x.ev.value)} — ${x.ev.reason}`);
    const group = (title, st) => {
      const xs = all.filter(x => x.ev.status === st);
      return xs.length ? [`${title} (${xs.length})`].concat(xs.map(line), ['']) : [];
    };
    let L = [
      'RIDGE MONITOR — CREW HEALTH SELF-CHECK REPORT',
      '*** SYNTHETIC DEMO DATA — NOT REAL ASTRONAUT DATA ***',
    ].concat(state.sim ? ['*** SIMULATION: space weather event — the dosimeter reading is simulated ***'] : [], [
      '',
      `Crew member: ${D.CREW.id} (${D.CREW.note})`,
      `Date: ${state.today} · Mission day ${missionDay()}`,
      `Environment: ${env.label}`,
      `Expected one-way comm delay: ${delay.text}` + (delay.sourced ? ' [S3]' : ' (illustrative prototype value)')
    ]);
    if (delay.oneWayMin) L.push(`Earliest possible reply: about ${delay.oneWayMin * 2} min after sending (round trip).`);
    L.push('');
    L = L.concat(group('ACT', 'act'), group('WATCH', 'watch'), group('NO DATA', 'nodata'), group('USUAL', 'ok'));

    const avgs = D.INDICATOR_ORDER.filter(id => D.INDICATORS[id].kind !== 'flag' && baseline(id) !== null).map(id => {
      const xs = [];
      for (let i = 0; i < 7; i++) { const v = val(addDays(state.today, -i), id); if (typeof v === 'number') xs.push(v); }
      if (!xs.length) return null;
      const a = xs.reduce((p, c) => p + c, 0) / xs.length;
      const dec = Math.max(D.INDICATORS[id].decimals, 1);
      return `  - ${D.INDICATORS[id].short}: ${a.toFixed(dec)}${unitSuffix(id)} (baseline ${baseline(id).toFixed(dec)}${unitSuffix(id)})`;
    }).filter(Boolean);
    if (avgs.length) L = L.concat(['7-DAY AVERAGE vs PERSONAL BASELINE'], avgs, ['']);

    const land = landingState();
    L = L.concat(['GRAVITY TRANSITION CHECK', `  ${STATUS[land.status].label} — ${land.reason}` +
      (land.yes.length ? ' Reported: ' + land.yes.map(it => it.q.replace(/\?$/, '')).join('; ') + '.' : ''), '']);

    const note = (state.entries[state.today] || {}).note;
    if (note) L = L.concat(['JOURNAL NOTE (today)', '  ' + note, '']);
    L.push('All thresholds are illustrative prototype values.');
    L.push('Prototype — not a medical device and not medical advice.');
    return L.join('\n');
  }

  // 7-day mini chart for an indicator card.
  function sparkline(id) {
    const ind = D.INDICATORS[id];
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(state.today, -i));
    const W = 84, H = 26;
    if (ind.kind === 'flag') {
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">` +
        days.map((d, i) => `<rect class="cell st-${evaluate(id, d).status}" x="${i * 12 + 1}" y="7" width="10" height="12" rx="2"/>`).join('') + `</svg>`;
    }
    const vals = days.map(d => val(d, id));
    const have = vals.filter(v => v !== null);
    if (have.length < 2) return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><line class="sbase" x1="2" x2="${W - 2}" y1="${H / 2}" y2="${H / 2}"/></svg>`;
    let lo = Math.min.apply(null, have), hi = Math.max.apply(null, have);
    if (ind.kind === 'scale') { lo = 1; hi = 5; }
    if (lo === hi) { lo -= 1; hi += 1; }
    const x = i => 4 + i * (W - 8) / 6;
    const y = v => H - 4 - (v - lo) / (hi - lo) * (H - 8);
    let path = '', pen = false;
    vals.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      pen = true;
    });
    const last = vals[6];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${path.trim()}"/>` +
      (last !== null ? `<circle class="sdot" cx="${x(6).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3.5"/>` : '') + `</svg>`;
  }

  // Direction of the last 3 days against the 4 days before. Direction only, not a judgment.
  function trendArrow(id) {
    const ind = D.INDICATORS[id];
    if (ind.kind === 'flag') return null;
    const pick = (from, to) => {
      const xs = [];
      for (let i = from; i <= to; i++) { const v = val(addDays(state.today, -i), id); if (v !== null) xs.push(v); }
      return xs.length ? xs.reduce((p, c) => p + c, 0) / xs.length : null;
    };
    const recent = pick(0, 2), prior = pick(3, 6);
    if (recent === null || prior === null) return null;
    const tol = Math.max(Math.abs(prior) * 0.03, ind.step / 2);
    const d = recent - prior;
    return d > tol ? { ch: '↑', word: 'rising' } : d < -tol ? { ch: '↓', word: 'falling' } : { ch: '→', word: 'steady' };
  }

  function renderIndicators() {
    $('#indicators').innerHTML = D.INDICATOR_ORDER.map(id => {
      const ind = D.INDICATORS[id];
      const ev = evaluate(id, state.today);
      const b = ind.kind === 'flag' ? null : baseline(id);
      const arrow = trendArrow(id);
      const tip = b !== null ? 'Baseline ' + b.toFixed(ind.decimals) + unitSuffix(id) : ind.noSource ? ind.noSource : ind.label;
      return `<button type="button" class="ind-card st-${ev.status}${state.indicator === id ? ' selected' : ''}" data-indicator="${id}" title="${esc(tip)}">
        <span class="ind-name"><span>${esc(ind.short)}</span><span class="chips">${hazChips(ind.hazards)}</span></span>
        ${pill(ev.status)}
        <span class="ind-val">${esc(fmtVal(id, ev.value))}<span class="ind-unit">${ev.value === null || ind.kind === 'flag' ? '' : esc(unitSuffix(id).trim())}</span>${arrow ? `<span class="ind-arrow" aria-hidden="true">${arrow.ch}</span><span class="sr-only"> ${arrow.word} over 7 days</span>` : ''}</span>
        ${sparkline(id)}
      </button>`;
    }).join('');
    $('#status-legend').innerHTML = ['ok', 'watch', 'act', 'nodata'].map(pill).join(' ') +
      ` <span>Usual = within your illustrative usual range · Watch = self-care and check again · Act = contact the flight surgeon · No data = not measured · Arrows = direction over 7 days</span>`;
  }

  // "Needs attention": every Act and Watch item with its main action.
  function renderAttention() {
    const all = D.INDICATOR_ORDER.map(id => ({ id: id, ev: evaluate(id, state.today) }));
    const hot = all.filter(x => x.ev.status === 'act').concat(all.filter(x => x.ev.status === 'watch'));
    const none = all.filter(x => x.ev.status === 'nodata');
    const land = landingState();
    const landHot = land.status === 'act' || land.status === 'watch';
    const acts = hot.filter(x => x.ev.status === 'act').length + (land.status === 'act' ? 1 : 0);
    const count = $('#attention-count');
    count.textContent = hot.length + (landHot ? 1 : 0);
    count.className = 'count' + (acts ? ' hot' : '');
    count.setAttribute('aria-label', hot.length + ' items need attention');
    let html = '';
    if (state.sim) {
      const ev = evaluate('dosimeter', state.today);
      const texts = ['Space weather means solar particle events and coronal mass ejections. They can harm the body and the spacecraft [S1].'].concat(D.INDICATORS.dosimeter.guidance.act);
      html += `<div class="sim-card st-act">
        <div class="att-top">${pill('act')}<span class="att-name">Space weather event</span><span class="sim-tag">Simulation</span></div>
        <p class="att-do">${cite(texts[0])}</p>
        <p class="att-do"><b>Simulated dosimeter reading:</b> ${esc(withUnit('dosimeter', ev.value))}. ${esc(ev.reason)}</p>
        <ol class="steps">${texts.slice(1).map(s => `<li>${cite(s)}</li>`).join('')}</ol>
        <div class="row wrap"><button type="button" class="btn ghost" data-sim-end>End event</button>
          <button type="button" class="btn ghost" data-region="radiation">Details</button></div>
        ${sourcesBlock(sourceIds(texts))}
      </div>`;
    }
    if (hot.length) {
      const limit = state.sim ? 1 : 3;
      const shown = state.attAll ? hot : hot.slice(0, limit);
      html += `<ul class="att-list${state.attAll ? ' all' : ''}">` + shown.map(x => {
        const ind = D.INDICATORS[x.id];
        const region = regionOf(x.id);
        const target = region ? `data-region="${region}" aria-label="Details: ${esc(D.REGIONS[region].name)}"` : `data-indicator="${x.id}" aria-label="Show trend: ${esc(ind.short)}"`;
        return `<li class="att-item st-${x.ev.status}">
          <div class="att-top">${pill(x.ev.status)}<span class="att-name">${esc(ind.short)}</span><span class="att-val">${esc(withUnit(x.id, x.ev.value))}</span>
            <button type="button" class="att-go" ${target}><span aria-hidden="true">›</span></button></div>
          <p class="att-do"><b>Do now:</b> ${cite(ind.guidance[x.ev.status][0])}</p>
        </li>`;
      }).join('') + `</ul>`;
      if (hot.length > limit) {
        html += `<button type="button" class="btn ghost att-more" data-att-toggle aria-expanded="${state.attAll}">${state.attAll ? 'Show fewer' : 'Show all (' + hot.length + ')'}</button>`;
      }
    } else {
      html += `<p class="att-none">${pill('ok')} Nothing needs attention in the recorded indicators.</p>`;
    }
    if (landHot) {
      html += `<div class="att-item st-${land.status}">
        <div class="att-top">${pill(land.status)}<span class="att-name">Gravity transition check</span>
          <a class="att-go" href="#landing-sec" aria-label="Open the gravity transition check"><span aria-hidden="true">›</span></a></div>
        <p class="att-do"><b>Do now:</b> ${cite(D.LANDING.guidance[land.status][0])}</p>
      </div>`;
    }
    html += `<div class="att-foot">`;
    if (none.length) {
      html += `<p class="att-none">${pill('nodata')} Not measured today: ${none.map(x => esc(D.INDICATORS[x.id].short)).join(', ')}. <a href="#checkin-sec">Check in</a></p>`;
    }
    html += `<a class="btn primary" href="#report-card">Report for flight surgeon</a></div>`;
    $('#attention').innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Mission routine and badges (light gamification)
  // ---------------------------------------------------------------------------
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  function recorded(date, id) { return val(date, id) !== null; }

  // One routine task on one day: which of its indicators are still missing.
  function taskState(task, date) {
    const missing = task.needs.filter(id => {
      if (!task.withinDays) return !recorded(date, id);
      for (let i = 0; i < task.withinDays; i++) if (recorded(addDays(date, -i), id)) return false;
      return true;
    });
    const noteMissing = !!task.needsNote && !((state.entries[date] || {}).note);
    return { missing: missing, noteMissing: noteMissing, done: !missing.length && !noteMissing };
  }

  function dayHasData(date) { return D.INDICATOR_ORDER.some(id => recorded(date, id)); }

  // Days in a row with a check-in. Today does not break the streak until it ends.
  function streakDays() {
    let d = dayHasData(state.today) ? state.today : addDays(state.today, -1);
    let n = 0;
    while (dayHasData(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  function countDays(test) {
    let n = 0;
    for (let i = 0; i < PA.badges.windowDays; i++) if (test(addDays(state.today, -i))) n++;
    return n;
  }

  function badgeState(id) {
    const B = PA.badges;
    const atLeast = (ind, min) => d => { const v = val(d, ind); return v !== null && v >= min; };
    if (id === 'streak') return { have: Math.min(streakDays(), B.streakDays), need: B.streakDays, rule: `Check in ${B.streakDays} days in a row` };
    if (id === 'exercise') return { have: countDays(atLeast('exerciseMin', B.exerciseMin)), need: B.exerciseDays, rule: `${B.exerciseMin} min or more of exercise on ${B.exerciseDays} of the last ${B.windowDays} days` };
    if (id === 'hydration') return { have: countDays(atLeast('hydrationCups', B.hydrationCups)), need: B.windowDays, rule: `${B.hydrationCups} cups or more on each of the last ${B.windowDays} days` };
    return { have: countDays(d => !!(state.entries[d] || {}).note), need: B.journalDays, rule: `A journal note on ${B.journalDays} of the last ${B.windowDays} days` };
  }

  function renderRoutine() {
    const pts = PA.routine.pointsPerTask;
    let done = 0;
    $('#routine-list').innerHTML = D.ROUTINE.map(task => {
      const st = taskState(task, state.today);
      if (st.done) done++;
      const todo = st.missing.map(id => D.INDICATORS[id].short).concat(st.noteMissing ? ['Journal note'] : []);
      return `<li class="task ${st.done ? 'done' : 'todo'}">
        <span class="task-ic" aria-hidden="true">${st.done ? '✓' : '○'}</span>
        <span class="task-main"><span class="task-name">${esc(task.label)} <span class="chips">${hazChips(task.hazards)}</span></span>
          <span class="task-sub">${esc(task.when)} · ${st.done ? 'Done' : 'To do: ' + esc(todo.join(', '))}</span></span>
        ${st.done ? `<span class="task-pts">+${pts}</span>` : `<a class="btn ghost" href="#fs-${slug(task.group)}">Check in</a>`}
      </li>`;
    }).join('');
    let week = 0;
    for (let i = 0; i < 7; i++) D.ROUTINE.forEach(t => { if (taskState(t, addDays(state.today, -i)).done) week += pts; });
    $('#routine-score').textContent = `${done} of ${D.ROUTINE.length} done · ${done * pts} points today · ${week} in the last 7 days`;

    const s = streakDays();
    $('#streak').innerHTML = `<span class="streak-n">${s}</span> day${s === 1 ? '' : 's'} check-in streak`;
    $('#badges').innerHTML = D.BADGES.map(b => {
      const st = badgeState(b.id);
      const earned = st.have >= st.need;
      const pct = Math.round(Math.min(st.have / st.need, 1) * 100);
      return `<li class="badge ${earned ? 'earned' : 'locked'}">
        <span class="badge-ic" aria-hidden="true">${earned ? '★' : '☆'}</span>
        <span class="badge-main">
          <span class="badge-name">${esc(b.name)} ${b.hazards.length ? `<span class="chips">${hazChips(b.hazards)}</span>` : ''}<span class="badge-state">${earned ? 'Earned' : 'In progress'}</span></span>
          <span class="task-sub">${esc(st.rule)}: ${st.have} of ${st.need}.</span>
          <span class="meter" role="img" aria-label="${st.have} of ${st.need}"><span style="width:${pct}%"></span></span>
          <span class="why">${cite(b.why)}</span>
        </span>
      </li>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Gravity transition check (landing readiness)
  // ---------------------------------------------------------------------------
  function landingAnswers() {
    return (state.entries[state.today] || {}).landing || {};
  }

  // Unanswered questions never count as fine: with no "Yes" and any gap, it is No data.
  function landingState() {
    const ans = landingAnswers();
    const items = D.LANDING.items;
    const yes = items.filter(it => ans[it.id] === true);
    const open = items.filter(it => ans[it.id] !== true && ans[it.id] !== false);
    let status = 'ok';
    if (yes.length >= PA.landing.act) status = 'act';
    else if (yes.length >= PA.landing.watch) status = 'watch';
    else if (open.length) status = 'nodata';
    const reason = status === 'nodata' ? (open.length === items.length ? 'Not checked today.' : `${open.length} of ${items.length} questions not answered.`)
      : `${yes.length} of ${items.length} signs reported` + (open.length ? `, ${open.length} not answered.` : '.');
    return { status: status, yes: yes, open: open, reason: reason };
  }

  function renderLandingForm() {
    const ans = landingAnswers();
    const surface = D.LANDING.surface.indexOf(state.env) !== -1;
    $('#landing-form').innerHTML = `
      <p class="why">${cite(D.LANDING.intro)}</p>
      <p class="landing-env ${surface ? 'on' : ''}">${surface
        ? `<strong>${esc(currentEnv().label)}:</strong> you are living in gravity after a weightless flight. Do this check before mission-critical tasks.`
        : `<strong>${esc(currentEnv().label)}:</strong> use this check after landing or any change of gravity.`}</p>
      <ul class="landing-list">` + D.LANDING.items.map(it => {
        const v = ans[it.id];
        return `<li class="landing-item">
          <label for="l-${it.id}">${esc(it.q)} <span class="chips">${hazChips(['G'])}</span></label>
          <select id="l-${it.id}" data-landing="${it.id}" aria-describedby="l-${it.id}-why">
            <option value="">Not checked</option>
            <option value="no"${v === false ? ' selected' : ''}>No</option>
            <option value="yes"${v === true ? ' selected' : ''}>Yes</option>
          </select>
          <p class="why" id="l-${it.id}-why">${cite(it.why)}</p>
          <p class="muted small"><b>How to check:</b> ${esc(it.how)}</p>
        </li>`;
      }).join('') + `</ul>
      <p class="muted small">Illustrative prototype instructions. Follow your mission's medical procedures.</p>`;
  }

  function renderLandingResult() {
    const st = landingState();
    const steps = st.status === 'nodata' ? ['Answer all four questions to get a result.'] : D.LANDING.guidance[st.status];
    const texts = [D.LANDING.intro].concat(D.LANDING.items.map(it => it.why), steps);
    $('#landing-result').className = 'card landing-result st-' + st.status;
    $('#landing-result').innerHTML = `
      <div class="panel-head"><h3>Readiness today</h3>${pill(st.status)}</div>
      <p class="reason">${esc(st.reason)}${st.yes.length ? ' Reported: ' + st.yes.map(it => esc(it.q.replace(/\?$/, ''))).join('; ') + '.' : ''}</p>
      <p class="todo-h">What to do</p>
      <ol class="steps">${steps.map(s => `<li>${cite(s)}</li>`).join('')}</ol>
      <p class="muted small">Illustrative rule: ${PA.landing.watch} sign = Watch, ${PA.landing.act} or more = Act.</p>
      ${sourcesBlock(sourceIds(texts))}`;
  }

  function saveLanding(id, raw) {
    const e = Object.assign({}, state.entries[state.today] || {});
    const ans = Object.assign({}, e.landing || {});
    ans[id] = raw === '' ? null : raw === 'yes';
    e.landing = ans;
    state.entries[state.today] = e;
    persist();
    renderLandingResult();
    renderAttention();
    $('#report-wrap').hidden = true;
    announce('Gravity transition check: ' + STATUS[landingState().status].label);
  }

  // ---------------------------------------------------------------------------
  // Trend chart — hand-made SVG, no library.
  // One series per chart. Status dots, a usual-range band and the personal
  // baseline give context; a crosshair tooltip and a table view give the values.
  // ---------------------------------------------------------------------------
  let chartCtx = null;

  function niceTicks(lo, hi, n) {
    if (lo === hi) { lo -= 1; hi += 1; }
    const raw = (hi - lo) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const start = Math.floor(lo / step + 1e-9) * step;
    const end = Math.ceil(hi / step - 1e-9) * step;
    const out = [];
    for (let x = start; x <= end + step / 2; x += step) out.push(+x.toFixed(6));
    return out;
  }

  // The illustrative "usual" zone for an indicator, as [low, high].
  function usualBand(id) {
    const th = PA.thresholds[id];
    const b = baseline(id);
    switch (th.type) {
      case 'range': return th.usual.slice();
      case 'min': return [th.watch, Infinity];
      case 'max': return [-Infinity, th.watch];
      case 'baselineDelta': return b === null ? null : [b - th.watch, b + th.watch];
      case 'baselineRatio': return b === null ? null : [-Infinity, b * th.watch];
      default: return null;
    }
  }

  function renderChart() {
    const id = state.indicator;
    const ind = D.INDICATORS[id];
    const n = state.range;
    const dates = [];
    for (let i = n - 1; i >= 0; i--) dates.push(addDays(state.today, -i));
    const pts = dates.map(d => ({ date: d, v: val(d, id), ev: evaluate(id, d) }));
    const isFlag = ind.kind === 'flag';

    $('#chart-ind').value = id;
    $$('.seg-btn').forEach(btn => {
      const on = +btn.dataset.range === n;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('#chart-title').innerHTML = esc(ind.label) + (isFlag ? '' : ` <span class="muted">(${esc(ind.unit === '/5' ? 'scale 1–5' : ind.unit)})</span>`) +
      ` <span class="chips">${hazChips(ind.hazards)}</span>`;
    $('#chart-sub').textContent = `Last ${n} days, ${fmtDate(dates[0])} to ${fmtDate(dates[n - 1])}. Synthetic demo data.`;
    $('#chart-tip').hidden = true;

    const holder = $('#chart');
    const W = Math.max(300, Math.round(holder.clientWidth || 720));
    const H = isFlag ? 104 : 260;
    const m = isFlag ? { l: 10, r: 10, t: 10, b: 30 } : { l: 44, r: 58, t: 14, b: 30 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const cw = pw / n;
    const xc = isFlag ? (i => m.l + (i + 0.5) * cw) : (i => m.l + (n === 1 ? pw / 2 : i * pw / (n - 1)));
    const stepPx = isFlag ? cw : pw / (n - 1);
    const lblStep = Math.max(1, Math.ceil(64 / stepPx));
    let body = '';
    let yOf = () => null;

    // x-axis date labels, counted back from today so today is always labeled
    dates.forEach((d, i) => {
      if ((n - 1 - i) % lblStep === 0) body += `<text class="ax" x="${xc(i).toFixed(1)}" y="${H - 9}" text-anchor="middle">${fmtDate(d)}</text>`;
    });

    if (isFlag) {
      pts.forEach((p, i) => {
        const st = p.ev.status;
        body += `<rect class="cell st-${st}" x="${(m.l + i * cw + 1).toFixed(1)}" y="${m.t + 8}" width="${Math.max(cw - 2, 1).toFixed(1)}" height="40" rx="3"/>`;
        if (cw >= 14) body += `<text class="cell-ic st-${st}" x="${xc(i).toFixed(1)}" y="${m.t + 28}" text-anchor="middle" dy=".35em">${STATUS[st].icon}</text>`;
      });
      $('#chart-note').textContent = 'Each cell is one day: ✓ nothing reported · ! reported · ✕ reported 2 or more days in a row · — not checked. The 2-day rule is an illustrative prototype value.';
    } else {
      const vals = pts.filter(p => p.v !== null).map(p => p.v);
      if (!vals.length) {
        holder.innerHTML = '<p class="empty">No data recorded in this period.</p>';
        $('#chart-note').textContent = '';
        chartCtx = null;
        renderChartTable(pts, id);
        return;
      }
      const b = baseline(id);
      const band = usualBand(id);
      let lo = Math.min.apply(null, vals);
      let hi = Math.max.apply(null, vals);
      if (ind.kind === 'scale') { lo = 1; hi = 5; }
      if (b !== null) { lo = Math.min(lo, b); hi = Math.max(hi, b); }
      if (band) {
        if (isFinite(band[0])) lo = Math.min(lo, band[0]);
        if (isFinite(band[1])) hi = Math.max(hi, band[1]);
      }
      const ticks = niceTicks(lo, hi, 4);
      const y0 = ticks[0];
      const y1 = ticks[ticks.length - 1];
      const y = v => m.t + ph - (v - y0) / (y1 - y0) * ph;
      yOf = p => (p.v === null ? null : y(p.v));

      if (band) {
        const top = y(Math.min(band[1], y1));
        const bottom = y(Math.max(band[0], y0));
        if (bottom > top) body += `<rect class="band" x="${m.l}" y="${top.toFixed(1)}" width="${pw}" height="${(bottom - top).toFixed(1)}"/>`;
      }
      ticks.forEach(t => {
        body += `<line class="grid" x1="${m.l}" x2="${m.l + pw}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>` +
          `<text class="ax" x="${m.l - 8}" y="${y(t).toFixed(1)}" text-anchor="end" dy=".32em">${+t.toFixed(2)}</text>`;
      });
      if (b !== null) {
        body += `<line class="base" x1="${m.l}" x2="${m.l + pw}" y1="${y(b).toFixed(1)}" y2="${y(b).toFixed(1)}"/>` +
          `<text class="base-lbl" x="${m.l + 6}" y="${(y(b) - 6).toFixed(1)}">Your baseline ${b.toFixed(ind.decimals)}</text>`;
      }
      let path = '';
      let pen = false;
      pts.forEach((p, i) => {
        if (p.v === null) { pen = false; return; }
        path += (pen ? 'L' : 'M') + xc(i).toFixed(1) + ' ' + y(p.v).toFixed(1) + ' ';
        pen = true;
      });
      body += `<path class="line" d="${path.trim()}"/>`;
      let lastIdx = -1;
      pts.forEach((p, i) => { if (p.v !== null) lastIdx = i; });
      pts.forEach((p, i) => {
        if (p.v === null) return;
        const alone = (i === 0 || pts[i - 1].v === null) && (i === n - 1 || pts[i + 1].v === null);
        const flagged = p.ev.status === 'watch' || p.ev.status === 'act';
        if (flagged || alone || i === lastIdx) {
          body += `<circle class="dot${flagged ? ' st-' + p.ev.status : ''}" cx="${xc(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5"/>`;
        }
      });
      if (lastIdx >= 0) {
        const p = pts[lastIdx];
        body += `<text class="end-lbl" x="${(xc(lastIdx) + 9).toFixed(1)}" y="${y(p.v).toFixed(1)}" dy=".32em">${esc(fmtVal(id, p.v))}</text>`;
      }
      const th = PA.thresholds[id];
      $('#chart-note').textContent = 'Shaded band: illustrative usual range (prototype value). ' +
        (b !== null ? `Thin line: your personal baseline, the average of your first ${PA.baselineDays} recorded days. ` : '') +
        'Colored dots mark Watch and Act days.' + (th.avgDays ? ` Status uses the ${th.avgDays}-day average.` : '') +
        (ind.noSource ? ' ' + ind.noSource : '');
    }

    // hover layer: crosshair + focus dot, driven by pointer or arrow keys
    body += `<line id="ch-cross" class="cross" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>` +
      `<circle id="ch-focus" class="focus" r="6" visibility="hidden"/>`;

    const flaggedDays = pts.filter(p => p.ev.status === 'watch' || p.ev.status === 'act').length;
    holder.innerHTML = `<svg id="chart-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" tabindex="0" role="img"
      aria-label="${esc(ind.label)}, last ${n} days. ${flaggedDays} day${flaggedDays === 1 ? '' : 's'} at Watch or Act. Use the left and right arrow keys to read each day, or open the table view.">${body}</svg>`;
    chartCtx = { pts: pts, xc: xc, yOf: yOf, W: W, m: m, pw: pw, n: n, id: id, isFlag: isFlag, cw: cw, idx: n - 1 };
    renderChartTable(pts, id);
  }

  function renderChartTable(pts, id) {
    $('#chart-table').innerHTML = `<table><caption class="sr-only">${esc(D.INDICATORS[id].label)} by day</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Value</th><th scope="col">Status</th><th scope="col">Why</th></tr></thead>
      <tbody>${pts.slice().reverse().map(p => `<tr><th scope="row">${fmtDate(p.date)}</th><td>${esc(withUnit(id, p.v))}</td><td>${pill(p.ev.status)}</td><td>${esc(p.ev.reason)}</td></tr>`).join('')}</tbody></table>`;
  }

  function showTip(i) {
    const c = chartCtx;
    if (!c) return;
    i = Math.max(0, Math.min(c.n - 1, i));
    c.idx = i;
    const p = c.pts[i];
    const x = c.xc(i);
    const cross = $('#ch-cross');
    const focus = $('#ch-focus');
    cross.setAttribute('x1', x);
    cross.setAttribute('x2', x);
    cross.setAttribute('visibility', 'visible');
    const yv = c.yOf(p);
    if (yv === null) {
      focus.setAttribute('visibility', 'hidden');
    } else {
      focus.setAttribute('cx', x);
      focus.setAttribute('cy', yv);
      focus.setAttribute('visibility', 'visible');
    }
    const tip = $('#chart-tip');
    tip.innerHTML = `<strong>${fmtDate(p.date)}</strong><span class="tip-val">${esc(withUnit(c.id, p.v))}</span>${pill(p.ev.status)}<span class="tip-why">${esc(p.ev.reason)}</span>`;
    tip.hidden = false;
    const svg = $('#chart-svg');
    const scale = svg.getBoundingClientRect().width / c.W;
    const left = x * scale;
    const flip = left > svg.getBoundingClientRect().width * 0.55;
    tip.style.left = left + 'px';
    tip.style.transform = flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
  }

  function hideTip() {
    const tip = $('#chart-tip');
    if (tip) tip.hidden = true;
    const cross = $('#ch-cross');
    const focus = $('#ch-focus');
    if (cross) cross.setAttribute('visibility', 'hidden');
    if (focus) focus.setAttribute('visibility', 'hidden');
  }

  function chartIndexAt(clientX) {
    const c = chartCtx;
    const rect = $('#chart-svg').getBoundingClientRect();
    const px = (clientX - rect.left) * (c.W / rect.width);
    return c.isFlag ? Math.floor((px - c.m.l) / c.cw) : Math.round((px - c.m.l) / (c.pw / (c.n - 1)));
  }

  // ---------------------------------------------------------------------------
  // Daily check-in form
  // ---------------------------------------------------------------------------
  // Simple line grid for the vision self-check. Our own drawing; an illustrative
  // self-check, not a clinical test.
  function gridSvg() {
    let lines = '';
    for (let i = 0; i <= 10; i++) {
      const p = 5 + i * 15;
      lines += `<line x1="${p}" y1="5" x2="${p}" y2="155"/><line x1="5" y1="${p}" x2="155" y2="${p}"/>`;
    }
    return `<svg class="vision-grid" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Square line grid with a dot in the center">${lines}<circle cx="80" cy="80" r="3.5"/></svg>`;
  }

  function fieldHtml(id) {
    const ind = D.INDICATORS[id];
    const v = val(state.today, id);
    const fid = 'f-' + id;
    let control;
    if (ind.kind === 'number') {
      control = `<span class="input-unit"><input type="number" id="${fid}" name="${id}" inputmode="decimal" min="${ind.min}" max="${ind.max}" step="${ind.step}" value="${v === null ? '' : v}" aria-describedby="${fid}-why"><span class="unit">${esc(ind.unit)}</span></span>`;
    } else if (ind.kind === 'scale') {
      control = `<select id="${fid}" name="${id}" aria-describedby="${fid}-why"><option value="">Not rated</option>` +
        ind.scale.map((t, i) => `<option value="${i + 1}"${v === i + 1 ? ' selected' : ''}>${esc(t)}</option>`).join('') + `</select>`;
    } else {
      control = `<select id="${fid}" name="${id}" aria-describedby="${fid}-why">
        <option value="">Not checked</option>
        <option value="no"${v === false ? ' selected' : ''}>No</option>
        <option value="yes"${v === true ? ' selected' : ''}>Yes</option></select>`;
    }
    return `<div class="field">
      <label for="${fid}">${esc(ind.label)} <span class="chips">${hazChips(ind.hazards)}</span></label>
      ${control}
      <p class="why" id="${fid}-why">${cite(ind.why)}</p>
      <details class="how"><summary>How to measure</summary>
        <ol>${ind.how.map(s => `<li>${cite(s)}</li>`).join('')}</ol>
        ${id === 'vision' ? gridSvg() : ''}
        ${ind.howNote ? `<p class="muted small">${esc(ind.howNote)}</p>` : ''}
        <p class="muted small">Illustrative prototype instructions. Follow your mission's medical procedures.</p>
      </details>
    </div>`;
  }

  function renderForm() {
    const groups = [];
    D.INDICATOR_ORDER.forEach(id => {
      const g = D.INDICATORS[id].group;
      let slot = groups.find(x => x.name === g);
      if (!slot) { slot = { name: g, ids: [] }; groups.push(slot); }
      slot.ids.push(id);
    });
    const note = (state.entries[state.today] || {}).note || '';
    const noteField = `<div class="field wide">
      <label for="f-note">Journal note <span class="chips">${hazChips(['I'])}</span></label>
      <textarea id="f-note" name="note" rows="3" maxlength="500" aria-describedby="f-note-why">${esc(note)}</textarea>
      <p class="why" id="f-note-why">${cite('A few words about your day. NASA uses journaling to understand mental and emotional state in isolation [S2]. The note stays in this browser and is added to the flight surgeon report.')}</p>
    </div>`;
    $('#checkin').innerHTML = `<p class="form-date">Check-in for <strong>${fmtDateLong(state.today)}</strong> · ${esc(D.CREW.id)}</p>` +
      groups.map(g => `<fieldset id="fs-${slug(g.name)}"><legend>${esc(g.name)}</legend><div class="fields">${g.ids.map(fieldHtml).join('')}${g.name === 'Sleep and mind' ? noteField : ''}</div></fieldset>`).join('') +
      `<div class="row"><button type="submit" class="btn primary">Save check-in</button><span id="form-status" class="muted" role="status"></span></div>`;
  }

  function saveForm(form) {
    const e = Object.assign({}, state.entries[state.today] || {});
    D.INDICATOR_ORDER.forEach(id => {
      const raw = form.elements[id].value;
      if (D.INDICATORS[id].kind === 'flag') e[id] = raw === '' ? null : raw === 'yes';
      else e[id] = raw === '' ? null : Number(raw);
    });
    e.note = form.elements.note.value.trim().slice(0, 500);
    state.entries[state.today] = e;
    persist();
    invalidate();
    renderAll();
    const msg = state.storageOk ? `Check-in saved for ${fmtDate(state.today)}.` : 'Check-in updated, but browser storage is not available.';
    $('#form-status').textContent = msg;
    announce(msg);
  }

  // ---------------------------------------------------------------------------
  // Top-level render and events
  // ---------------------------------------------------------------------------
  function renderAll() {
    renderHeader();
    renderStrip();
    renderHazardPanel();
    renderEnvContext();
    renderBody();
    renderRegionPanel();
    renderGuidance();
    renderAttention();
    renderRoutine();
    renderIndicators();
    renderChart();
    renderLandingForm();
    renderLandingResult();
    $('#report-wrap').hidden = true;
  }

  // Space weather simulation: shows a dosimeter spike for today without saving it.
  function setSim(on) {
    state.sim = on;
    invalidate();
    document.body.classList.toggle('sim-on', on);
    $('#sim-banner').hidden = !on;
    const btn = $('#btn-sim');
    btn.textContent = on ? 'End event' : 'Simulate space weather event';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    renderAll();
    announce(on ? 'Simulation started: space weather event.' : 'Simulation ended.');
  }

  function setDrawer(open) {
    state.drawer = open;
    const drawer = $('#region-drawer');
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    $('#drawer-backdrop').hidden = !open;
    renderBody();
    if (open) drawer.focus({ preventScroll: true });
  }

  // Selecting a region opens its details in the drawer on the right.
  function selectRegion(id) {
    if (!D.REGIONS[id]) return;
    state.region = id;
    renderRegionPanel();
    setDrawer(true);
    $('#region-panel').scrollTop = 0;
  }

  function selectIndicator(id) {
    if (!D.INDICATORS[id]) return;
    state.indicator = id;
    if (state.drawer) setDrawer(false);
    renderIndicators();
    renderChart();
    $('#trends-sec').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindEvents() {
    document.addEventListener('click', ev => {
      const t = ev.target;
      const hz = t.closest('[data-hazard]');
      if (hz) {
        state.hazard = state.hazard === hz.dataset.hazard ? null : hz.dataset.hazard;
        renderStrip();
        renderHazardPanel();
        return;
      }
      if (t.closest('[data-close-drawer]')) { setDrawer(false); return; }
      if (t.closest('#btn-sim')) { setSim(!state.sim); return; }
      if (t.closest('[data-sim-end]')) { setSim(false); return; }
      if (t.closest('[data-att-toggle]')) { state.attAll = !state.attAll; renderAttention(); return; }
      if (t.closest('[data-close-hazard]')) {
        state.hazard = null;
        renderStrip();
        renderHazardPanel();
        return;
      }
      const indBtn = t.closest('[data-indicator]');
      if (indBtn) { selectIndicator(indBtn.dataset.indicator); return; }
      const reg = t.closest('[data-region]');
      if (reg) { selectRegion(reg.dataset.region); return; }
      const seg = t.closest('.seg-btn');
      if (seg) { state.range = +seg.dataset.range; renderChart(); }
    });

    // SVG regions act as buttons: Enter and Space select them
    $('#body-figure').addEventListener('keydown', ev => {
      const g = ev.target.closest('.region');
      if (g && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        selectRegion(g.dataset.region);
      }
    });

    $('#env').addEventListener('change', ev => {
      state.env = ev.target.value;
      persist();
      renderHeader();
      renderStrip();
      renderEnvContext();
      renderGuidance();
      renderAttention();
      renderLandingForm();
      $('#report-wrap').hidden = true;
      announce('Environment set to ' + currentEnv().label);
    });

    $('#chart-ind').innerHTML = D.INDICATOR_ORDER.map(id => `<option value="${id}">${esc(D.INDICATORS[id].short)}</option>`).join('');
    $('#chart-ind').addEventListener('change', ev => {
      state.indicator = ev.target.value;
      renderIndicators();
      renderChart();
    });

    const wrap = $('#chart-wrap');
    wrap.addEventListener('pointermove', ev => { if (chartCtx && ev.target.closest('#chart-svg')) showTip(chartIndexAt(ev.clientX)); });
    wrap.addEventListener('pointerleave', hideTip);
    wrap.addEventListener('focusin', ev => { if (chartCtx && ev.target.id === 'chart-svg') showTip(chartCtx.idx); });
    wrap.addEventListener('focusout', hideTip);
    wrap.addEventListener('keydown', ev => {
      if (!chartCtx || ev.target.id !== 'chart-svg') return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); showTip(chartCtx.idx - 1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); showTip(chartCtx.idx + 1); }
      else if (ev.key === 'Home') { ev.preventDefault(); showTip(0); }
      else if (ev.key === 'End') { ev.preventDefault(); showTip(chartCtx.n - 1); }
      else if (ev.key === 'Escape') hideTip();
    });

    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && state.drawer) setDrawer(false); });
    setInterval(renderNextTask, 60000);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderChart, 150);
    });

    $('#landing-form').addEventListener('change', ev => {
      const sel = ev.target.closest('[data-landing]');
      if (sel) saveLanding(sel.dataset.landing, sel.value);
    });

    $('#checkin').addEventListener('submit', ev => {
      ev.preventDefault();
      saveForm(ev.target);
    });

    $('#btn-report').addEventListener('click', () => {
      $('#report-text').value = buildReport();
      $('#report-wrap').hidden = false;
      $('#copy-status').textContent = '';
      $('#report-text').focus();
    });

    $('#btn-copy').addEventListener('click', () => {
      const ta = $('#report-text');
      const done = ok => { $('#copy-status').textContent = ok ? 'Copied.' : 'Select the text and copy it manually.'; };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value).then(() => done(true), () => { ta.select(); done(false); });
        } else {
          ta.select();
          done(document.execCommand('copy'));
        }
      } catch (err) {
        ta.select();
        done(false);
      }
    });

    $('#btn-reset').addEventListener('click', () => {
      if (!window.confirm('Reset all check-ins to the synthetic demo data?')) return;
      resetDemo();
      state.sim = false;
      document.body.classList.remove('sim-on');
      $('#sim-banner').hidden = true;
      $('#btn-sim').textContent = 'Simulate space weather event';
      $('#btn-sim').setAttribute('aria-pressed', 'false');
      invalidate();
      state.hazard = null;
      setDrawer(false);
      pickStartRegion();
      renderAll();
      renderForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      announce('Demo data reset.');
    });
  }

  // Open the body panel on the region that needs the most attention.
  function pickStartRegion() {
    let best = 'brain';
    let rank = -1;
    D.REGION_ORDER.forEach(id => {
      const r = STATUS[summarize(D.REGIONS[id].indicators, state.today).status].rank;
      if (r > rank) { rank = r; best = id; }
    });
    state.region = best;
  }

  // Offline mode. Opened as a local file, the app needs no network at all.
  // Served from a web address, a service worker (sw.js) keeps the app's own
  // files on the device. Distance from Earth is why this matters [S3].
  function setOffline(ready, text) {
    const chip = $('#offline-chip');
    chip.classList.toggle('ready', ready);
    $('.offline-ic', chip).textContent = ready ? '✓' : '!';
    $('#offline-text').textContent = text;
  }

  function initOffline() {
    if (location.protocol === 'file:') { setOffline(true, 'works offline'); return; }
    // The web app manifest only applies when the app is served from a web address.
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.json';
    document.head.appendChild(link);
    if (!('serviceWorker' in navigator)) { setOffline(false, 'needs a connection'); return; }
    navigator.serviceWorker.register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => setOffline(true, navigator.onLine ? 'works offline' : 'offline now, running from device'))
      .catch(() => setOffline(false, 'needs a connection'));
    window.addEventListener('offline', () => { if ($('#offline-chip').classList.contains('ready')) setOffline(true, 'offline now, running from device'); });
    window.addEventListener('online', () => { if ($('#offline-chip').classList.contains('ready')) setOffline(true, 'works offline'); });
  }

  function init() {
    initOffline();
    loadState();
    pickStartRegion();
    bindEvents();
    renderAll();
    renderForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
