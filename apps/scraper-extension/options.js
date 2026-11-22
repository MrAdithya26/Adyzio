const $ = (id) => document.getElementById(id);
const KEYS = Object.keys(DealSettings.DEFAULTS);

// ---------- Conversion per store ----------
const METHOD_LABELS = {
  auto: 'Auto (Amazon → SiteStripe, others → ExtraPe)',
  extrape: 'ExtraPe',
  amazon: 'Amazon tag + SiteStripe',
  template: 'My link pattern',
  page: 'My converter page',
  api: 'Custom API (ExtraPe section)',
  none: "Don't convert",
};

function routeStores() {
  return DealStores.STORES.filter((x) => !['extrape', 'wishlink'].includes(x.id)).concat([{ id: 'other', name: 'Other shops' }]);
}

function renderRoutes(json) {
  let routes = {};
  try { routes = JSON.parse(json || '{}') || {}; } catch (e) { routes = {}; }
  const body = $('routesBody');
  body.innerHTML = '';
  routeStores().forEach((st) => {
    const r = routes[st.id] || { method: 'auto', value: '' };
    const tr = document.createElement('tr');
    tr.dataset.store = st.id;
    const name = document.createElement('td');
    name.textContent = st.name;
    const sel = document.createElement('select');
    DealSettings.ROUTE_METHODS
      .filter((m) => m !== 'amazon' || st.id === 'amazon')
      .forEach((m) => { const o = document.createElement('option'); o.value = m; o.textContent = METHOD_LABELS[m]; sel.append(o); });
    sel.value = r.method || 'auto';
    const val = document.createElement('input');
    val.value = r.value || '';
    const sync = () => {
      const needs = sel.value === 'template' || sel.value === 'page';
      val.disabled = !needs;
      val.placeholder = sel.value === 'template' ? '{{url}}&affid=yourid' : sel.value === 'page' ? 'https://… (page where you paste a link and press Convert)' : '';
    };
    sel.onchange = sync;
    sync();
    const c2 = document.createElement('td'); c2.append(sel);
    const c3 = document.createElement('td'); c3.append(val);
    tr.append(name, c2, c3);
    body.append(tr);
  });
}

function collectRoutes() {
  const out = {};
  document.querySelectorAll('#routesBody tr').forEach((tr) => {
    const method = tr.querySelector('select').value;
    const value = tr.querySelector('input').value.trim();
    if (method !== 'auto') out[tr.dataset.store] = value ? { method, value } : { method };
  });
  $('storeRoutes').value = JSON.stringify(out);
  return out;
}

function readForm() {
  collectRoutes();
  const out = {};
  KEYS.forEach((k) => {
    const el = $(k);
    if (!el) return;
    if (el.type === 'checkbox') out[k] = el.checked;
    else if (el.type === 'number') out[k] = Number(el.value);
    else out[k] = el.value.trim();
  });
  return out;
}

function showMode() {
  const mode = $('extrapeMode').value;
  document.querySelectorAll('[data-mode]').forEach((d) => d.classList.toggle('show', d.dataset.mode === mode));
}

function setResult(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.className = 'result ' + (ok ? 'ok' : 'err');
}

async function save() {
  const values = readForm();
  for (const k of ['extrapeApiHeaders', 'storeTemplates', 'storeRoutes']) {
    try { JSON.parse(values[k] || '{}'); } catch (e) {
      $('saved').textContent = '';
      alert(`"${k}" is not valid JSON: ${e.message}`);
      return false;
    }
  }
  const missing = Object.entries(JSON.parse(values.storeRoutes || '{}'))
    .filter(([, r]) => (r.method === 'template' || r.method === 'page') && !r.value).map(([k]) => k);
  if (missing.length) {
    alert(`Add a link pattern / converter page URL for: ${missing.join(', ')}`);
    return false;
  }
  if (!values.extrapeConverterUrl) values.extrapeConverterUrl = DealSettings.BUILT_IN_EXTRAPE_URL;
  await DealSettings.saveSettings(values);
  $('saved').textContent = 'Saved ✓';
  setTimeout(() => { $('saved').textContent = ''; }, 2500);
  return true;
}

async function init() {
  const s = await DealSettings.getSettings();
  KEYS.forEach((k) => {
    const el = $(k);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!s[k];
    else el.value = s[k] == null ? '' : s[k];
  });
  showMode();
  $('extrapeMode').onchange = showMode;
  renderRoutes(s.storeRoutes);
  $('resetExtrape').onclick = () => { $('extrapeConverterUrl').value = DealSettings.BUILT_IN_EXTRAPE_URL; save(); };
  $('openExtrape').onclick = () => chrome.tabs.create({ url: $('extrapeConverterUrl').value.trim() || DealSettings.BUILT_IN_EXTRAPE_URL });

  const code = await (await fetch(chrome.runtime.getURL('apps-script/Code.gs'))).text();
  $('scriptCode').value = code;
  const dash = await (await fetch(chrome.runtime.getURL('apps-script/Dashboard.html'))).text();
  $('copyDash').onclick = () => navigator.clipboard.writeText(dash).then(() => { $('copyDash').textContent = 'Copied ✓'; });
  $('copyScript').onclick = () => navigator.clipboard.writeText(code).then(() => { $('copyScript').textContent = 'Copied ✓'; });
  $('toggleScript').onclick = () => {
    const hidden = $('scriptCode').classList.toggle('hidden');
    $('toggleScript').textContent = hidden ? 'Show script' : 'Hide script';
  };

  $('save').onclick = save;
  $('openDash').onclick = () => {
    const u = $('scriptUrl').value.trim();
    if (!/^https:\/\/script\.google\.com\//.test(u)) { setResult('driveResult', 'Add the Apps Script Web app URL first.', false); return; }
    chrome.tabs.create({ url: u });
  };

  $('testDrive').onclick = async () => {
    if (!(await save())) return;
    const btn = $('testDrive');
    btn.disabled = true;
    setResult('driveResult', 'Checking…', true);
    const r = await chrome.runtime.sendMessage({ type: 'testDrive' });
    btn.disabled = false;
    if (r && r.ok) {
      const parts = [];
      if (r.folder) parts.push(`Images folder: "${r.folder}"`);
      if (r.sheet) parts.push(`Sheet: "${r.sheet}" → tab "${r.tab}"`);
      if (r.excelFolder) parts.push(`Excel folder: "${r.excelFolder}"`);
      if (r.keySet === false) parts.push('⚠ No access key yet: open the dashboard and choose one, then enter it here');
      if (r.version && r.version < 3) parts.push('⚠ Old script: paste the new Code.gs + Dashboard.html and deploy a new version');
      setResult('driveResult', 'Connected ✓  ' + (parts.join('  ·  ') || 'Script is running. Add your folder and sheet links.'), true);
    } else {
      setResult('driveResult', (r && r.error) || 'Failed', false);
    }
  };

  $('testBtn').onclick = async () => {
    if (!(await save())) return;
    const url = $('testUrl').value.trim();
    if (!url) return;
    $('testBtn').disabled = true;
    setResult('testResult', 'Converting…', true);
    const r = await chrome.runtime.sendMessage({ type: 'convertOne', url });
    $('testBtn').disabled = false;
    if (r && r.affiliate) setResult('testResult', `${r.affiliate}   (${r.method}${r.error ? ' – ' + r.error : ''})`, true);
    else setResult('testResult', (r && r.error) || 'Failed', false);
  };
}

init();
