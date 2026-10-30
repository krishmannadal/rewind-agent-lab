import { digestJSON } from './sha256.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const names = { experiment: 'Experiment', search: 'Repair search', suite: 'Evaluation suite', history: 'Run history', docs: 'Methodology' };
let configuration = null, current = null, searchResult = null, activeTrace = 'baseline', mode = 'reference', apiKey = '', model = 'gemini-3.8-flash', busy = false, toastTimer, errorTimer;
let history = [];
try { const saved = JSON.parse(localStorage.getItem('rewind-history-v1') || '[]'); if (Array.isArray(saved)) history = saved.filter(x => x?.comparison?.baseline?.config && x?.comparison?.repaired?.trace).slice(0, 20); } catch { /* Storage is optional. */ }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 4500); }
function error(message) { $('#global-error').textContent = `${message} (Click to dismiss)`; $('#global-error').hidden = false; clearTimeout(errorTimer); errorTimer = setTimeout(() => $('#global-error').hidden = true, 15000); }
function policyName(id) { return configuration?.policies.find(x => x.id === id)?.name ?? id; }
function scenarioName(id) { return configuration?.scenarios.find(x => x.id === id)?.name ?? id; }
function readConfig() { return { scenario: $('#scenario-select').value, seed: Number($('#seed-input').value), fault: $('#fault-toggle').checked, policies: $$('#policy-options input:checked').map(x => x.value) }; }
function applyConfig(config) { $('#scenario-select').value = config.scenario; $('#seed-input').value = config.seed; $('#fault-toggle').checked = config.fault ?? true; $$('#policy-options input').forEach(x => x.checked = config.policies.includes(x.value)); updateScenario(); updateSuiteNotice(); }
function updateScenario() { const s = configuration?.scenarios.find(s => s.id === $('#scenario-select').value); if (!s) return; $('#scenario-description').textContent = s.fault; $('#scenario-category').textContent = s.category.toUpperCase(); $('#scenario-category').className = `mini-badge ${s.color}`; }
function updateSuiteNotice() { const c = readConfig(); $('#suite-seed').textContent = c.seed; $('#suite-policies').textContent = c.policies.length ? `Policies: ${c.policies.map(policyName).join(', ')}.` : 'No policies selected.'; }
async function api(route, input, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.live) headers['x-rewind-key'] = apiKey;
  let response;
  try { response = await fetch(route, { method: 'POST', headers, body: JSON.stringify(input), signal: AbortSignal.timeout(options.live ? 190000 : 30000) }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'The experiment timed out. Please retry; no successful result was recorded.' : 'Cannot reach the execution server. Check your connection and try again.'); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}
async function task(button, label, work) {
  if (busy) return toast('An experiment is already running.');
  if (!configuration) return error('The execution server is unavailable. Reload the page once it is running.');
  busy = true; const old = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = label; button.classList.add('busy-dot'); }
  try { await work(); } catch (e) { error(e.message); } finally { busy = false; if (button) { button.disabled = false; button.innerHTML = old; button.classList.remove('busy-dot'); } }
}
function persist() { try { localStorage.setItem('rewind-history-v1', JSON.stringify(history)); } catch { toast('Browser storage is full or unavailable. Export evidence to keep this result.'); } $$('.history-count').forEach(x => x.textContent = history.length); }
function saveComparison(comparison, imported = false) { const item = { date: new Date().toISOString(), comparison, imported }; history = [item, ...history].slice(0, 20); persist(); }
function openView(view = 'experiment') { location.hash = `lab/${view}`; }
function showView(view) {
  if (!names[view]) view = 'experiment';
  $('#landing').hidden = true; $('#workspace').hidden = false; document.body.classList.add('is-lab');
  $$('.view').forEach(x => x.hidden = x.id !== `view-${view}`);
  $$('.sidebar [data-view]').forEach(x => { x.classList.toggle('active', x.dataset.view === view); if (x.dataset.view === view) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  $('#breadcrumb-title').textContent = names[view]; document.title = `${names[view]} — REWIND`;
  if (view === 'history') renderHistory();
  if (view === 'suite') updateSuiteNotice();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function route() { const h = location.hash.slice(1); if (h.startsWith('lab')) showView(h.split('/')[1] || 'experiment'); else { $('#workspace').hidden = true; $('#landing').hidden = false; document.body.classList.remove('is-lab'); document.title = 'REWIND — Understand the failure. Prove the repair.'; if (['home', 'how', 'research'].includes(h)) requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView()); } }
function renderMetrics() {
  const c = current, reg = c.control.regression;
  const cards = [
    { label: 'BASELINE', value: c.baseline.pass ? 'Pass' : 'Fail', cls: c.baseline.pass ? 'pass' : 'fail', note: `${c.baseline.toolCalls} tool call${c.baseline.toolCalls === 1 ? '' : 's'} · ${c.baseline.mode === 'reference' ? 'reference' : 'live Gemini'}` },
    { label: 'REPAIRED', value: c.repaired.pass ? 'Pass' : 'Fail', cls: c.repaired.pass ? 'pass' : 'fail', note: `${c.delta.extraToolCalls >= 0 ? '+' : ''}${c.delta.extraToolCalls} extra call${Math.abs(c.delta.extraToolCalls) === 1 ? '' : 's'} · ${c.repaired.config.policies.length} polic${c.repaired.config.policies.length === 1 ? 'y' : 'ies'}` },
    { label: 'CLEAN CONTROL', value: reg ? 'Regression' : c.control.repaired.pass ? 'Pass' : 'Fail', cls: reg || !c.control.repaired.pass ? 'fail' : 'pass', note: reg ? 'A previously passing task broke' : 'Matched task without the fault' },
  ];
  $('#metrics').innerHTML = cards.map(x => `<div class="metric-card"><span class="field-label">${x.label}</span><strong class="${x.cls}">${x.value}</strong><small>${esc(x.note)}</small></div>`).join('');
  $('#export-button').disabled = false;
  const div = c.divergence;
  let headline, text;
  if (reg) { headline = 'This policy breaks a clean task.'; text = 'A safer-looking failure outcome does not count as a valid repair when it removes useful capability.'; }
  else if (!c.baseline.pass && c.repaired.pass) { headline = 'The intervention repaired this task.'; text = `First trace divergence: step ${div?.step ?? '—'}. The matched clean control ${c.control.repaired.pass ? 'still passes' : 'fails'}. Check the full suite before generalizing.`; }
  else if (c.baseline.pass && c.repaired.pass) { headline = c.repaired.config.fault ? 'Both runs pass this task.' : 'The fault is disabled.'; text = 'Compare tool costs and inspect the trace. A passing baseline does not establish that a repair was needed.'; }
  else { headline = c.repaired.config.policies.length ? 'This intervention does not repair the task.' : 'A baseline failure, ready to investigate.'; text = 'Inspect the failing contract checks, select a relevant policy, or search for the smallest repair.'; }
  $('#comparison-insight').hidden = false; $('#comparison-insight').innerHTML = `<span>↳</span><div><strong>${esc(headline)}</strong>${esc(text)}</div>`;
}
function renderTrace() {
  if (!current) return;
  const run = activeTrace === 'control' ? current.control.repaired : current[activeTrace];
  $$('#workspace [data-trace]').forEach(x => x.classList.toggle('active', x.dataset.trace === activeTrace));
  $('#trace-caption').textContent = `${run.id} / ${run.mode === 'reference' ? 'REFERENCE' : 'LIVE GEMINI'} / ${run.trace.length} STEPS`;
  const icons = { task: '↳', plan: '≡', tool: '⌘', guard: '◇', decision: '→', evaluation: '✓', model: '◈' };
  $('#trace-content').innerHTML = run.trace.map((t, i) => `<div class="trace-node ${esc(t.status)}" style="--i:${i}"><span class="node-dot">${icons[t.type] ?? '·'}</span><details ${t.type === 'decision' || t.status === 'error' ? 'open' : ''}><summary><span><span class="node-type">${esc(t.type.toUpperCase())}</span>${esc(t.title)}</span><span class="node-chevron">›</span></summary><pre>${esc(JSON.stringify(t.data, null, 2))}</pre></details></div>`).join('') + `<div class="trace-checks"><h3>CONTRACT CHECKS</h3>${run.checks.map(c => `<div class="check-item ${c.pass ? '' : 'failed'}"><span>${c.pass ? '✓' : '×'}</span><div><code>${esc(c.field)}</code> · expected <code>${esc(JSON.stringify(c.expected))}</code> · received <code>${esc(JSON.stringify(c.actual))}</code></div></div>`).join('')}</div><div class="trace-run-meta">ENVIRONMENT: ${esc(run.provenance.fixture)} · SEED ${run.config.seed}<br>TRACE ID: ${esc(run.fingerprint)} · SANDBOX WRITES: ${run.writes.length}<br>${run.mode === 'reference' ? 'Deterministic reference agent. No LLM calls.' : `${esc(run.model)} · ${run.modelCalls} provider call(s). No private reasoning is collected.`}</div>`;
}
async function runComparison() {
  await task($('#run-button'), mode === 'gemini' ? 'Running 4 live decisions…' : 'Executing comparison…', async () => {
    if (mode === 'gemini' && apiKey.length < 10) throw new Error('Add a Gemini key in Model settings, or use Reference mode.');
    const config = { ...readConfig(), mode, model };
    const prior = $('#trace-content').innerHTML;
    $('#trace-content').innerHTML = '<div class="loading-trace">Executing fresh sandbox environments…</div>';
    try { current = await api('/api/compare', config, { live: mode === 'gemini' }); activeTrace = 'baseline'; renderMetrics(); renderTrace(); saveComparison(current); $('#metrics').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}); toast('Comparison complete. Open any trace step to inspect the evidence.'); }
    catch (e) { $('#trace-content').innerHTML = prior; throw e; }
  });
}
function renderSearch() {
  const r = searchResult, b = r.best;
  const best = b ? `<div class="search-best"><div class="best-heading"><div class="eyebrow"><span class="live-dot"></span> MINIMAL FEASIBLE REPAIR</div><span class="mono">${r.evaluated} SUBSETS EVALUATED</span></div><h2>${b.policies.length === 0 ? 'No policy change needed.' : b.policies.length === 1 ? policyName(b.policies[0]) : `${b.policies.length} policies. All constraints met.`}</h2><div class="policy-chips">${b.policies.map(p => `<span class="policy-chip">${esc(policyName(p))}</span>`).join('') || '<span class="policy-chip">Baseline already satisfies target</span>'}</div><div class="best-stats"><div><strong>${b.suite.faultPass}/${b.suite.faultTotal}</strong><span>FAULT CASES PASS</span></div><div><strong>${b.suite.regressions}</strong><span>CONTROL REGRESSIONS</span></div><div><strong>${b.extraToolCalls >= 0 ? '+' : ''}${b.extraToolCalls}</strong><span>SELECTED-CASE CALLS</span></div></div><button class="button" data-action="apply-repair">Apply & inspect repair <span>↗</span></button><p>Smallest by policy count, then by total suite tool calls. ${r.wholeSuite ? 'All 12 fault cases must pass.' : `Target: ${esc(scenarioName(r.config.scenario))}.`} Clean tasks must retain their baseline success.</p></div>` : `<div class="search-best"><div class="eyebrow">NO FEASIBLE REPAIR</div><h2>The constraints cannot all be met.</h2><p>Increase the selected-case call budget, or narrow the repair target. No candidate satisfied every selected constraint.</p></div>`;
  const rows = [...r.candidates].sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.suite.faultPass - a.suite.faultPass || a.policies.length - b.policies.length);
  $('#search-results').innerHTML = best + `<p class="results-caption">Reference agent · Seed ${r.config.seed} · ${r.pareto.length} non-dominated candidates · Synthetic task suite<br>These are measured fixture outcomes, not claims about general LLM reliability.</p><div class="panel"><div class="panel-heading"><h2>All policy combinations</h2><span class="mono">32 / 32</span></div><div class="table-wrap"><table><thead><tr><th>POLICIES</th><th>FAULTS</th><th>REGRESSIONS</th><th>EXTRA CALLS</th><th>ELIGIBLE</th></tr></thead><tbody>${rows.map(c => `<tr><td class="policy-cell">${c.policies.length ? c.policies.map(p => esc(policyName(p))).join(' + ') : 'No policies'}</td><td>${c.suite.faultPass}/12</td><td class="${c.suite.regressions ? 'fail-text' : 'pass-text'}">${c.suite.regressions}</td><td>${c.extraToolCalls >= 0 ? '+' : ''}${c.extraToolCalls}</td><td class="${c.eligible ? 'pass-text' : 'muted'}">${c.eligible ? '✓ Yes' : '—'}</td></tr>`).join('')}</tbody></table></div></div><div class="ablation-section" style="margin-top:1.5rem;"><button class="button button-outline" data-action="load-ablation">Compute Policy Ablation Matrix ↗</button><div id="ablation-table-wrap" hidden></div></div>`;
}
async function search() {
  await task($('#search-button'), 'Evaluating policy space…', async () => {
    searchResult = await api('/api/search', { scenario: $('#search-scenario').value, seed: Number($('#search-seed').value), budget: Number($('#budget').value), wholeSuite: $('#whole-suite').checked }); renderSearch(); if(innerWidth<701)$('#search-results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}); toast('All 32 policy subsets evaluated against matched controls.');
  });
}
async function evaluate() {
  await task($('#suite-button'), 'Running 24 cases…', async () => {
    const cfg = readConfig(), r = await api('/api/suite', cfg);
    const metrics = [{label:'FAULT CASES',value:`${r.faultPass}/${r.faultTotal}`,cls:r.faultPass===r.faultTotal?'pass':'neutral',note:'Task recovery under the fault'},{label:'CLEAN CONTROLS',value:`${r.controlPass}/${r.controlTotal}`,cls:r.controlPass===r.controlTotal?'pass':'fail',note:'Utility without a fault'},{label:'REGRESSIONS',value:r.regressions,cls:r.regressions?'fail':'pass',note:'Previously passing clean tasks lost'},{label:'TOOL CALLS',value:r.toolCalls,cls:'',note:'Across all 24 executions'}];
    $('#suite-results').innerHTML = `<div class="metric-grid four">${metrics.map(m=>`<div class="metric-card"><span class="field-label">${m.label}</span><strong class="${m.cls}">${m.value}</strong><small>${m.note}</small></div>`).join('')}</div><p class="results-caption">Policies: ${cfg.policies.length?esc(cfg.policies.map(policyName).join(', ')):'none'} · Base seed ${cfg.seed} · Reference agent only</p>` + configuration.scenarios.map(s=>`<div class="panel suite-family"><div class="panel-heading"><h2>${esc(s.name)}</h2><span>${esc(s.category)}</span></div><div class="table-wrap"><table><thead><tr><th>SEED</th><th>FAULT CASE</th><th>CLEAN CONTROL</th><th>TOOL CALLS (FAULT / CLEAN)</th></tr></thead><tbody>${r.cases.filter(c=>c.scenario===s.id&&c.fault).map(f=>{const c=r.cases.find(c=>c.scenario===s.id&&c.seed===f.seed&&!c.fault);return `<tr><td>${f.seed}</td><td><span class="suite-run-chip ${f.pass?'':'fail'}">${f.pass?'✓ PASS':'× FAIL'}</span></td><td><span class="suite-run-chip ${c.pass?'':'fail'}">${c.pass?'✓ PASS':'× FAIL'}</span></td><td>${f.toolCalls} / ${c.toolCalls}</td></tr>`}).join('')}</tbody></table></div></div>`).join(''); toast('Evaluation complete. All 24 cases executed.');
  });
}
function renderHistory() {
  persist();
  $('#history-list').innerHTML = history.length ? history.map((h,i)=>{const c=h.comparison;return `<article class="history-card"><span class="history-icon">↶</span><div class="history-details"><h3>${esc(c.baseline.scenario)}</h3><p>${esc(new Date(h.date).toLocaleString())} · SEED ${c.baseline.config.seed} · ${esc(c.baseline.mode.toUpperCase())}${h.imported?' · IMPORTED':''}<br>${c.repaired.config.policies.length?esc(c.repaired.config.policies.map(policyName).join(' + ')):'No repair policies'}</p></div><div class="history-outcome"><span class="${c.baseline.pass?'pass-text':'fail-text'}">${c.baseline.pass?'Pass':'Fail'}</span> → <span class="${c.repaired.pass?'pass-text':'fail-text'}">${c.repaired.pass?'Pass':'Fail'}</span></div><button class="button button-outline" data-history="${i}">Inspect ↗</button></article>`}).join('') : '<div class="panel empty-state"><div class="empty-symbol">◷</div><h3>Your first experiment starts the story.</h3><p>Comparisons you run will appear here.<br>History stays in this browser; export to preserve evidence.</p><button class="text-link" data-action="open-lab">Start an experiment ↗</button></div>';
}
const sha256 = digestJSON;
async function exportEvidence() {
  if (!current) return toast('Run a comparison before exporting.');
  const payload = { format:'rewind.evidence.v1', exportedAt:new Date().toISOString(), comparison:current, note:'Synthetic fixtures. Digest is not a signature. API keys are never included.' };
  const envelope = { payload, sha256:await sha256(payload) }, blob = new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`rewind-${current.baseline.config.scenario}-${current.baseline.config.seed}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Evidence bundle exported with a SHA-256 digest.');
}
function validateImportedComparison(c) {
  if (!c?.baseline || !c?.repaired || !c?.control?.repaired || !c?.control?.baseline || !c?.delta) throw new Error('This file is not a complete REWIND comparison.');
  for (const r of [c.baseline,c.repaired,c.control.baseline,c.control.repaired]) {
    if (!configuration.scenarios.some(s=>s.id===r.config?.scenario)||!Number.isInteger(r.config.seed)||r.config.seed<0||r.config.seed>999999||!Array.isArray(r.config.policies)||r.config.policies.some(p=>!configuration.policies.some(x=>x.id===p))) throw new Error('Evidence contains an invalid experiment configuration.');
    if (!Array.isArray(r.trace)||r.trace.length>50||!r.trace.every(t=>typeof t.title==='string'&&typeof t.type==='string')||!Array.isArray(r.checks)||r.checks.length>10||!Array.isArray(r.writes)||typeof r.pass!=='boolean'||!['reference','gemini'].includes(r.mode)||typeof r.fingerprint!=='string'||typeof r.provenance?.fixture!=='string') throw new Error('Evidence contains a malformed execution trace.');
  }
}
async function importEvidence(file) {
  if (!file) return;
  await task(null,'',async()=>{
    if (file.size>2*1024*1024) throw new Error('Evidence imports are limited to 2 MB.');
    let data; try{data=JSON.parse(await file.text())}catch{throw new Error('Choose a valid JSON evidence bundle.');}
    if(data.payload?.format!=='rewind.evidence.v1'||typeof data.sha256!=='string') throw new Error('This is not a REWIND evidence bundle.');
    if(await sha256(data.payload)!==data.sha256) throw new Error('The evidence digest does not match. The bundle may have changed.');
    validateImportedComparison(data.payload.comparison);
    const c=data.payload.comparison;
    if(c.baseline.mode==='reference'&&c.repaired.mode==='reference') {const reproduced=await api('/api/compare',c.repaired.config); if(reproduced.baseline.fingerprint!==c.baseline.fingerprint||reproduced.repaired.fingerprint!==c.repaired.fingerprint) throw new Error('The reference execution could not be reproduced. Check engine version and bundle integrity.');}
    current=c;saveComparison(c,true);applyConfig(c.repaired.config);activeTrace='baseline';renderMetrics();renderTrace();openView('experiment');toast(c.baseline.mode==='reference'?'Evidence imported; reference traces reproduced.':'Live evidence imported. Digest verified; provider inference was not replayed.');
  });
}
function openSettings() { $('#mode-select').value=mode; $('#api-key').value=apiKey; $('#model-input').value=model; $('#live-settings').hidden=mode!=='gemini'; $('#settings-dialog').showModal(); }
function closeSettings() { $('#settings-dialog').close(); $('#api-key').value=''; }
function saveSettings() { const choice=$('#mode-select').value; if(choice==='gemini'&&$('#api-key').value.trim().length<10) return error('Enter a Gemini API key or select Reference agent.'); mode=choice;apiKey=choice==='gemini'?$('#api-key').value.trim():'';model=$('#model-input').value.trim()||'gemini-3.8-flash'; $('#mode-label').textContent=mode==='reference'?'Reference agent':'Live Gemini'; $('#mode-notice').innerHTML=mode==='reference'?'<span class="notice-icon">↳</span><div><strong>Reference mode</strong><span> A transparent, deliberately fallible rule-based agent. Reproducible runs; no model API calls.</span></div><button data-action="model-settings">Test a live model ↗</button>':'<span class="notice-icon">◈</span><div><strong>Live Gemini mode</strong><span> Four real model decisions per comparison. Your key stays in page memory. Search and suite use the reference agent.</span></div><button data-action="model-settings">Model settings ↗</button>';closeSettings();toast(mode==='reference'?'Reference agent selected.':'Live Gemini selected. Provider charges may apply.'); }
async function discoverModels(button) {
  const key=$('#api-key').value.trim();if(key.length<10)return error('Enter your Gemini key first.');
  await task(button,'Loading…',async()=>{const res=await fetch('/api/models',{method:'POST',headers:{'Content-Type':'application/json','x-rewind-key':key},body:'{}',signal:AbortSignal.timeout(25000)});const r=await res.json();if(!res.ok)throw new Error(r.error??'Model discovery failed.');$('#model-list').innerHTML=r.models.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');$('#model-feedback').textContent=`${r.models.length} available models loaded. Choose a model in the field above.`;toast('Available Gemini models loaded.');});
}
async function copyText(text,message) {
  try { if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const input=document.createElement('textarea');input.value=text;input.setAttribute('readonly','');input.style.position='fixed';input.style.left='-9999px';document.body.appendChild(input);input.select();const success=document.execCommand('copy');input.remove();if(!success)throw new Error('Clipboard unavailable'); }
    toast(message);
  } catch { error('Clipboard access is unavailable in this browser. Use HTTPS or localhost to enable it.'); }
}
const actions = {
  'load-ablation': async () => {
    const wrap = $('#ablation-table-wrap');
    if (!wrap) return;
    wrap.hidden = false;
    wrap.innerHTML = '<p class="muted" style="margin-top:0.75rem;">Computing policy ablation across isolated and combined baselines...</p>';
    try {
      const abl = await api('/api/ablation', { scenario: $('#search-scenario').value, seed: Number($('#search-seed').value), budget: Number($('#budget').value) });
      wrap.innerHTML = `<div class="panel" style="margin-top:1rem;"><div class="panel-heading"><h2>Policy Ablation Analysis</h2><span class="mono">Utility Score & Regression Matrix</span></div><div class="table-wrap"><table><thead><tr><th>PRESET</th><th>POLICIES</th><th>FAULTS</th><th>REGRESSIONS</th><th>EXTRA CALLS</th><th>UTILITY</th><th>FEASIBLE</th></tr></thead><tbody>${abl.matrix.map(r => `<tr><td><strong>${esc(r.label)}</strong></td><td>${r.policies.length ? r.policies.map(p => esc(policyName(p))).join(' + ') : 'None'}</td><td>${r.suiteFaultPass}/${r.suiteFaultTotal}</td><td class="${r.suiteRegressions ? 'fail-text' : 'pass-text'}">${r.suiteRegressions}</td><td>+${r.extraToolCalls}</td><td><strong>${r.utilityScore}</strong></td><td class="${r.feasible ? 'pass-text' : 'muted'}">${r.feasible ? '✓ Feasible' : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
    } catch (err) {
      wrap.innerHTML = `<p class="fail-text" style="margin-top:0.75rem;">Failed to load ablation: ${esc(err.message)}</p>`;
    }
  },
  'open-lab':()=>openView('experiment'), 'open-search':()=>openView('search'), docs:()=>openView('docs'), run:runComparison, search, suite:evaluate,
  'find-repair':()=>{const c=readConfig();$('#search-scenario').value=c.scenario;$('#search-seed').value=c.seed;openView('search');search();},
  'clear-policies':()=>{$$('#policy-options input').forEach(x=>x.checked=false);updateSuiteNotice();},
  'random-seed':()=>{$('#seed-input').value=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;updateSuiteNotice();},
  'apply-repair':()=>{if(!searchResult?.best)return;mode='reference';apiKey='';$('#mode-label').textContent='Reference agent';applyConfig({...searchResult.config,policies:searchResult.best.policies});$('#mode-notice').innerHTML='<span class="notice-icon">↳</span><div><strong>Reference mode</strong><span> Search result applied. The next comparison executes the same seeded fixture with the selected policy set.</span></div><button data-action="model-settings">Model settings ↗</button>';openView('experiment');runComparison();},
  export:exportEvidence, import:()=>$('#import-file').click(),
  'clear-history':()=>{if(!history.length)return toast('History is already empty.');if(confirm('Clear the saved comparisons in this browser? Export any evidence you want to keep first.')){history=[];persist();renderHistory();toast('Browser history cleared.');}},
  'model-settings':openSettings,'close-settings':closeSettings,'save-settings':saveSettings,'load-models':discoverModels,
  share:()=>{const c=readConfig(),u=new URL(location.href);u.search='';u.searchParams.set('scenario',c.scenario);u.searchParams.set('seed',c.seed);u.searchParams.set('fault',c.fault?'1':'0');if(c.policies.length)u.searchParams.set('policies',c.policies.join(','));u.hash='lab/experiment';copyText(u.href,'Experiment link copied. It contains configuration only; no API key or results.');},
  'copy-mcp':()=>copyText(new URL('/mcp',location.href).href,'MCP endpoint URL copied.'),
};
document.addEventListener('click',event=>{const action=event.target.closest('[data-action]');if(action){event.preventDefault();const fn=actions[action.dataset.action];if(fn)Promise.resolve(fn(action)).catch(e=>error(e.message));return;}const view=event.target.closest('[data-view]');if(view){openView(view.dataset.view);return;}const trace=event.target.closest('[data-trace]');if(trace){activeTrace=trace.dataset.trace;renderTrace();return;}const item=event.target.closest('[data-history]');if(item){current=history[Number(item.dataset.history)].comparison;applyConfig(current.repaired.config);activeTrace='baseline';renderMetrics();renderTrace();openView('experiment');}});
$('#global-error').addEventListener('click',()=>$('#global-error').hidden=true);
$('#scenario-select').addEventListener('change',updateScenario);
$('#seed-input').addEventListener('change',updateSuiteNotice);
$('#policy-options').addEventListener('change',updateSuiteNotice);
$('#budget').addEventListener('input',()=>$('#budget-value').value=`+${$('#budget').value}`);
$('#mode-select').addEventListener('change',()=>$('#live-settings').hidden=$('#mode-select').value!=='gemini');
$('#import-file').addEventListener('change',async e=>{try{await importEvidence(e.target.files[0]);}finally{e.target.value='';}});
window.addEventListener('hashchange',route);
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,select,textarea')||$('#settings-dialog').open)return;if(!$('#workspace').hidden&&e.key.toLowerCase()==='e')openView('experiment');if(!$('#workspace').hidden&&e.key.toLowerCase()==='r')openView('search');});
function motion() {
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce&&'IntersectionObserver'in window){document.body.classList.add('motion-ready');const observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');observer.unobserve(x.target);}}),{threshold:.08});$$('.reveal').forEach(x=>observer.observe(x));}
  const grid=$('.policy-grid');for(let i=0;i<32;i++){const cell=document.createElement('span');cell.textContent=i===9?'✓':String(i).padStart(2,'0');cell.className=i===9?'optimal':i>=16?'rejected':'';grid.appendChild(cell);}
  let ticking=false;window.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{const height=document.documentElement.scrollHeight-innerHeight;$('.scroll-progress').style.transform=`scaleX(${height>0?scrollY/height:0})`;if(!reduce&&!$('#landing').hidden&&scrollY<900)$('.execution-art').style.transform=`translateY(${Math.min(25,scrollY*.035)-2}px)`;ticking=false;});},{passive:true});
}
async function init() {
  motion();route();persist();
  try{
    const response=await fetch('/api/config',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Configuration unavailable');configuration=await response.json();
    $('#api-status').classList.add('connected');$('#api-status').innerHTML='<i></i> Engine online';
    const options=configuration.scenarios.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');$('#scenario-select').innerHTML=options;$('#search-scenario').innerHTML=options;
    $('#policy-options').innerHTML=configuration.policies.map(p=>`<label class="policy-option ${p.id==='abstain'?'policy-abstain':''}"><input type="checkbox" value="${esc(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc(p.description)}</small></span></label>`).join('');
    const params=new URLSearchParams(location.search), scenario=params.get('scenario'), seed=params.get('seed'), policies=(params.get('policies')||'').split(',').filter(p=>configuration.policies.some(x=>x.id===p));
    applyConfig({scenario:configuration.scenarios.some(s=>s.id===scenario)?scenario:'stale',seed:seed!==null&&/^\d{1,6}$/.test(seed)?Number(seed):42,fault:params.get('fault')!=='0',policies});
  }catch{$('#api-status').innerHTML='<i></i> Engine offline';error('The execution server is unavailable. If running locally, start the project with npm start and open http://localhost:3000.');}
}
init();
