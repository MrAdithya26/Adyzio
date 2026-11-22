const $ = (id) => document.getElementById(id);
const KEYS = Object.keys(DealSettings.DEFAULTS);

function readForm() {
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
  for (const k of ['extrapeApiHeaders', 'storeTemplates']) {
    try { JSON.parse(values[k] || '{}'); } catch (e) {
      $('saved').textContent = '';
      alert(`"${k}" is not valid JSON: ${e.message}`);
      return false;
    }
  }
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

  const code = await (await fetch(chrome.runtime.getURL('apps-script/Code.gs'))).text();
  $('scriptCode').value = code;
  $('copyScript').onclick = () => navigator.clipboard.writeText(code).then(() => { $('copyScript').textContent = 'Copied ✓'; });
  $('toggleScript').onclick = () => {
    const hidden = $('scriptCode').classList.toggle('hidden');
    $('toggleScript').textContent = hidden ? 'Show script' : 'Hide script';
  };

  $('save').onclick = save;

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
