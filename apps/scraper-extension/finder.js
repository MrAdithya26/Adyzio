// Link finder page: loads a product list, shows progress, exports the links file.
const $ = (id) => document.getElementById(id);
const norm = (h) => String(h || '').trim();

function parseList(wb) {
  const names = wb.SheetNames;
  const order = names.includes('Schedule') ? ['Schedule', ...names.filter((n) => n !== 'Schedule')] : names;
  for (const sheet of order) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '', raw: false });
    if (!rows.length) continue;
    const head = rows[0].map(norm);
    const pCol = head.findIndex((h) => /^(product|product title|product name|title|name)$/i.test(h));
    if (pCol < 0) continue;
    const nCol = head.findIndex((h) => /^(#|s\.?\s?no\.?|no\.?)$/i.test(h));
    const stores = [];
    head.forEach((h, c) => { const m = h.match(/^(.+?)\s+search$/i); if (m) stores.push({ name: m[1].trim(), searchCol: c }); });
    if (!stores.length) continue;
    const colOf = (re) => { const out = {}; head.forEach((h, c) => { const m = h.match(re); if (m) out[m[1].trim().toLowerCase()] = c; }); return out; };
    const prodCols = colOf(/^(.+?)\s+product link$/i), affCols = colOf(/^(.+?)\s+affiliate(?: link)?$/i);
    const items = [];
    rows.slice(1).forEach((r, k) => {
      const name = norm(r[pCol]);
      if (!name) return;
      const it = { n: nCol >= 0 && norm(r[nCol]) ? norm(r[nCol]) : String(k + 1), name, search: {}, product: {}, aff: {}, note: {}, skip: {}, skipAll: false };
      for (const s of stores) {
        const key = s.name.toLowerCase();
        const url = norm(r[s.searchCol]);
        if (/^https?:\/\//i.test(url)) it.search[s.name] = url;
        if (prodCols[key] != null && /^https?:/i.test(norm(r[prodCols[key]]))) it.product[s.name] = norm(r[prodCols[key]]);
        if (affCols[key] != null && /^https?:/i.test(norm(r[affCols[key]]))) it.aff[s.name] = norm(r[affCols[key]]);
      }
      items.push(it);
    });
    return { sheet, stores: stores.map((s) => ({ name: s.name })), items };
  }
  throw new Error('No sheet with a "Product" column and "<Store> search" columns was found.');
}

function status(f, it) {
  const names = f.stores.map((s) => s.name);
  const got = names.filter((n) => it.aff[n]).length;
  const left = names.filter((n) => !it.aff[n] && !it.skip[n]).length;
  if (!got) return left ? 'Link needed' : (names.some((n) => it.skip[n] === 'skipped') ? 'Skipped' : 'Not on any store');
  return left || names.some((n) => it.skip[n] === 'skipped') ? 'Some links' : 'All links';
}

function exportFile(f, suffix = '') {
  const s = f.stores.map((x) => x.name);
  const head = ['#', 'Product', ...s.map((n) => `${n} product link`), ...s.map((n) => `${n} affiliate`), 'Links status', 'Notes'];
  const rows = f.items.map((it) => [it.n, it.name, ...s.map((n) => it.product[n] || ''), ...s.map((n) => it.aff[n] || ''), status(f, it),
    s.map((n) => (it.skip[n] === 'not sold' ? `Not on ${n}` : it.skip[n] === 'skipped' ? `${n} skipped` : it.note[n] ? `${n}: ${it.note[n]}` : '')).filter(Boolean).join('; ')]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...rows]), 'Links');
  const d = new Date(); const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `Adyzio_Links_${(f.file || 'list').replace(/\.[^.]+$/, '').slice(0, 40)}_${stamp}${suffix}.xlsx`);
}

async function getF() { return (await chrome.storage.local.get('finder')).finder || null; }

function render(f) {
  if (!f) return;
  $('runCard').classList.remove('hidden'); $('listCard').classList.remove('hidden');
  const counts = {};
  f.items.forEach((it) => { const st = status(f, it); counts[st] = (counts[st] || 0) + 1; });
  const links = f.items.reduce((a, it) => a + Object.keys(it.aff).length, 0);
  $('summary').innerHTML = '';
  const add = (t) => { const p = document.createElement('span'); p.className = 'pill'; p.textContent = t; $('summary').append(p); };
  add(`${f.file} › ${f.sheet}`); add(`${f.items.length} products`); add(`${links} affiliate links`);
  Object.entries(counts).forEach(([k, v]) => add(`${k}: ${v}`));
  const it = f.items[f.cur.i];
  $('current').textContent = f.done || !it ? '✅ Everything is done. Download the links file.' : `Next: #${it.n} ${it.name} → ${f.stores[f.cur.s].name}`;
  $('thead').innerHTML = '';
  const hr = document.createElement('tr');
  ['#', 'Product', ...f.stores.map((s) => s.name), 'Status', ''].forEach((h) => { const th = document.createElement('th'); th.textContent = h; hr.append(th); });
  $('thead').append(hr);
  const body = $('tbody'); body.innerHTML = '';
  const only = $('onlyOpen').checked;
  f.items.forEach((x, i) => {
    const st = status(f, x);
    if (only && st !== 'Link needed' && st !== 'Some links') return;
    const tr = document.createElement('tr'); if (i === f.cur.i && !f.done) tr.className = 'cur';
    const td = (t, c) => { const e = document.createElement('td'); e.textContent = t; if (c) e.className = c; tr.append(e); return e; };
    td(x.n); td(x.name);
    f.stores.forEach((s) => {
      const n = s.name;
      if (x.aff[n]) { const e = td('✓', 'ok'); e.title = x.aff[n]; }
      else if (x.skip[n] === 'not sold') td('not sold', 'no');
      else if (x.skip[n] === 'skipped') td('skipped', 'no');
      else if (x.note[n]) { const e = td('⚠ failed', 'err'); e.title = x.note[n]; }
      else td('—', 'no');
    });
    td(st);
    const b = document.createElement('button'); b.className = 'small'; b.textContent = 'Do this one';
    b.onclick = () => chrome.runtime.sendMessage({ type: 'finderGo', index: i });
    td('').append(b);
    body.append(tr);
  });
}

$('file').onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  $('loadMsg').textContent = 'Reading…';
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const parsed = parseList(wb);
    const old = await getF();
    if (old && old.items.some((it) => Object.keys(it.aff).length || Object.keys(it.skip).length)) {
      if (!confirm('You have earlier progress. It will be downloaded as a backup file first, then replaced by this list. Continue?')) return;
      exportFile(old, '_backup');
    }
    const f = { file: file.name, ...parsed, cur: { i: 0, s: 0 }, tabId: null, done: false };
    await chrome.storage.local.set({ finder: f });
    const pre = f.items.reduce((a, it) => a + Object.keys(it.aff).length, 0);
    $('loadMsg').textContent = `Loaded ${f.items.length} products from "${f.sheet}" with stores: ${f.stores.map((s) => s.name).join(', ')}.` + (pre ? ` ${pre} affiliate links were already filled and will be skipped.` : '');
    render(f);
  } catch (err) { $('loadMsg').textContent = '⚠ ' + err.message; }
};
$('go').onclick = async () => { const r = await chrome.runtime.sendMessage({ type: 'finderGo' }); if (r && r.error) alert(r.error); };
$('export').onclick = async () => { const f = await getF(); if (f) exportFile(f); };
$('onlyOpen').onchange = async () => render(await getF());
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.finder) render(ch.finder.newValue); });
getF().then(render);
