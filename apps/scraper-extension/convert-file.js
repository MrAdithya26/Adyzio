// Upload an Excel/CSV with product links → convert each link → write affiliate links back into the same file.
const $ = (id) => document.getElementById(id);
const URL_RE = /https?:\/\/[^\s"'<>]+/i;

const state = {
  fileName: '',
  bookType: 'xlsx',
  wb: null,
  ws: null,
  range: null,
  port: null,
  items: [],
  results: {},
  converted: false,
};

const colName = (c) => XLSX.utils.encode_col(c);
const cellAt = (r, c) => state.ws[XLSX.utils.encode_cell({ r, c })];
const cellText = (cell) => (cell ? String(cell.w != null ? cell.w : cell.v != null ? cell.v : '').trim() : '');

// The link in a cell: a hyperlink target first, otherwise the first URL in its text.
function cellUrl(r, c) {
  const cell = cellAt(r, c);
  if (!cell) return '';
  if (cell.l && /^https?:/i.test(cell.l.Target || '')) return cell.l.Target;
  const m = cellText(cell).match(URL_RE);
  return m ? m[0].replace(/[),.;]+$/, '') : '';
}

function urlCount(c, fromRow) {
  let n = 0;
  for (let r = fromRow; r <= state.range.e.r; r++) if (cellUrl(r, c)) n++;
  return n;
}

function headerName(hr, c) {
  const t = hr >= 0 ? cellText(cellAt(hr, c)) : '';
  return t ? `${colName(c)} – ${t.slice(0, 40)}` : `Column ${colName(c)}`;
}

function option(value, label, selected) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  if (selected) o.selected = true;
  return o;
}

function guessHeaderRow() {
  const last = Math.min(state.range.e.r, state.range.s.r + 9);
  for (let r = state.range.s.r; r <= last; r++) {
    for (let c = state.range.s.c; c <= state.range.e.c; c++) {
      if (/link|url/i.test(cellText(cellAt(r, c))) && !cellUrl(r, c)) return r;
    }
  }
  // No obvious header: row 1 is a header if it has text but no links.
  const r0 = state.range.s.r;
  let text = false;
  let links = false;
  for (let c = state.range.s.c; c <= state.range.e.c; c++) {
    if (cellText(cellAt(r0, c))) text = true;
    if (cellUrl(r0, c)) links = true;
  }
  return text && !links ? r0 : -1;
}

function selectSheet(name) {
  state.ws = state.wb.Sheets[name];
  state.range = XLSX.utils.decode_range(state.ws['!ref'] || 'A1:A1');
  const hr = guessHeaderRow();

  const headerSel = $('headerRow');
  headerSel.innerHTML = '';
  headerSel.append(option(-1, 'No header row', hr === -1));
  for (let r = state.range.s.r; r <= Math.min(state.range.e.r, state.range.s.r + 9); r++) {
    headerSel.append(option(r, `Row ${r + 1}`, r === hr));
  }
  fillColumns();
}

function fillColumns() {
  const hr = Number($('headerRow').value);
  const first = hr + 1;
  const cols = [];
  for (let c = state.range.s.c; c <= state.range.e.c; c++) cols.push(c);
  const head = (c) => (hr >= 0 ? cellText(cellAt(hr, c)) : '');

  // Link column: "Product Link" header, else any link/url header that isn't affiliate/image, else most links.
  let linkCol = cols.find((c) => /product\s*link/i.test(head(c)));
  if (linkCol == null) linkCol = cols.find((c) => /link|url/i.test(head(c)) && !/affiliate|image|img|drive|source|photo/i.test(head(c)));
  if (linkCol == null) linkCol = cols.slice().sort((a, b) => urlCount(b, first) - urlCount(a, first))[0];
  const affCol = cols.find((c) => /affiliate/i.test(head(c)));

  const linkSel = $('linkCol');
  linkSel.innerHTML = '';
  cols.forEach((c) => linkSel.append(option(c, `${headerName(hr, c)} (${urlCount(c, first)} links)`, c === linkCol)));

  const affSel = $('affCol');
  affSel.innerHTML = '';
  affSel.append(option('new', 'New column "Affiliate Link" (added at the end)', affCol == null));
  cols.forEach((c) => affSel.append(option(c, headerName(hr, c), c === affCol)));
  buildItems();
}

function buildItems() {
  const hr = Number($('headerRow').value);
  const linkCol = Number($('linkCol').value);
  const affSel = $('affCol').value;
  const skip = $('skipFilled').checked;
  state.items = [];
  let filled = 0;
  for (let r = Math.max(hr + 1, state.range.s.r); r <= state.range.e.r; r++) {
    const url = cellUrl(r, linkCol);
    if (!url) continue;
    if (skip && affSel !== 'new' && cellText(cellAt(r, Number(affSel)))) { filled++; continue; }
    state.items.push({ key: r, url });
  }
  $('summary').textContent = `${state.items.length} link(s) to convert` + (filled ? ` · ${filled} row(s) already have an affiliate link and will be skipped` : '') + '.';
  $('start').disabled = !state.items.length;
  renderRows();
  showMapping();
}

function renderRows() {
  const tbody = $('rows');
  tbody.innerHTML = '';
  state.items.slice(0, 2000).forEach((it) => {
    const tr = document.createElement('tr');
    tr.id = 'row-' + it.key;
    const r = state.results[it.key];
    const cells = [String(it.key + 1), it.url, r ? r.affiliate || '' : '', r ? (r.error ? r.error : r.method) : 'waiting'];
    cells.forEach((t, i) => {
      const td = document.createElement('td');
      td.textContent = t;
      if (i === 3) td.className = !r ? 'wait' : r.affiliate ? 'ok' : 'err';
      tr.append(td);
    });
    tbody.append(tr);
  });
  $('preview').classList.toggle('hidden', !state.items.length);
}

function updateRow(key, r) {
  const tr = document.getElementById('row-' + key);
  if (!tr) return;
  tr.children[2].textContent = r.affiliate || '';
  tr.children[3].textContent = r.error ? (r.affiliate ? `${r.method} – ${r.error}` : r.error) : r.method;
  tr.children[3].className = r.affiliate ? 'ok' : 'err';
}

function setCell(r, c, value, isLink) {
  const ref = XLSX.utils.encode_cell({ r, c });
  const cell = { t: 's', v: value };
  if (isLink && /^https?:/i.test(value)) cell.l = { Target: value };
  state.ws[ref] = cell;
  if (r > state.range.e.r) state.range.e.r = r;
  if (c > state.range.e.c) state.range.e.c = c;
  state.ws['!ref'] = XLSX.utils.encode_range(state.range);
}

// ---------- Deals template output ----------
const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Other header names that mean the same template column.
const ALIASES = {
  title: /^(producttitle|productname|title|name|product|itemname)$/,
  brand: /^brand(name)?$/,
  price: /^(price|sellingprice|dealprice|offerprice|saleprice|price₹)$/,
  mrp: /^(mrp|originalprice|listprice|mrp₹)$/,
  discount: /^(discount|off|discountpercent)$/,
  image: /^(image|imageurl|imagelink|img|photo|picture)$/,
  driveImageLink: /^drive(image)?(link|url)?$/,
  category: /^(category|maincategory)$/,
  subcategory: /^(subcategory|subcat)$/,
  childCategory: /^(childcategory|childcat)$/,
  dealType: /^(dealtype|type)$/,
  goodFor: /^goodfor$/,
  checkList: /^checklist$/,
  description: /^(description|desc|about)$/,
  ends: /^(ends|enddate|endsat|expiry|validtill)$/,
  sourcePage: /^(sourcepage|source)$/,
  scrapedAt: /^(scrapedat|date|addedon)$/,
  rating: /^rating$/,
  reviews: /^(reviews|ratingscount|reviewcount)$/,
  store: /^(store|site|platform)$/,
};

// Column index in the uploaded sheet for each template field.
function templateMapping() {
  const hr = Number($('headerRow').value);
  const map = {};
  if (hr < 0) return map;
  const byNorm = {};
  for (let c = state.range.s.c; c <= state.range.e.c; c++) {
    const h = norm(cellText(cellAt(hr, c)));
    if (h && byNorm[h] == null) byNorm[h] = c;
  }
  DealExcel.COLUMNS.forEach((col) => {
    if (col.key === 'sr' || col.key === 'link' || col.key === 'affiliateLink') return;
    const exact = byNorm[norm(col.header)];
    if (exact != null) { map[col.key] = exact; return; }
    const re = ALIASES[col.key];
    if (!re) return;
    const hit = Object.keys(byNorm).find((h) => re.test(h));
    if (hit) map[col.key] = byNorm[hit];
  });
  return map;
}

function showMapping() {
  if ($('outFormat').value !== 'template') { $('mapInfo').textContent = ''; return; }
  const hr = Number($('headerRow').value);
  const map = templateMapping();
  const found = DealExcel.COLUMNS.filter((c) => map[c.key] != null).map((c) => `${c.header} ← ${cellText(cellAt(hr, map[c.key]))}`);
  $('mapInfo').textContent = 'Matched columns: Product Link, Affiliate Link' + (found.length ? ', ' + found.join(', ') : '') + '. Store and Sr No are filled automatically; other template columns stay empty.';
}

function buildTemplateWorkbook() {
  const hr = Number($('headerRow').value);
  const linkCol = Number($('linkCol').value);
  const affSel = $('affCol').value;
  const map = templateMapping();
  const products = [];
  for (let r = Math.max(hr + 1, state.range.s.r); r <= state.range.e.r; r++) {
    let any = false;
    for (let c = state.range.s.c; c <= state.range.e.c; c++) if (cellText(cellAt(r, c))) { any = true; break; }
    if (!any) continue;
    const p = {};
    Object.entries(map).forEach(([key, c]) => {
      const cell = cellAt(r, c);
      p[key] = cell && cell.l && /^https?:/i.test(cell.l.Target || '') && /image|Link|sourcePage/.test(key) ? cell.l.Target : (cell ? (cell.v != null ? cell.v : '') : '');
    });
    p.link = cellUrl(r, linkCol);
    const res = state.results[r];
    p.affiliateLink = res && res.affiliate ? res.affiliate : (affSel !== 'new' ? cellUrl(r, Number(affSel)) || cellText(cellAt(r, Number(affSel))) : '');
    if (res) p.affiliateMethod = res.error ? `${res.method || ''} (${res.error})`.slice(0, 250) : res.method;
    if (!p.store && p.link) {
      const st = DealStores.detectStore(p.link);
      p.store = st.id === 'other' ? '' : st.name;
    }
    products.push(p);
  }
  return DealExcel.buildWorkbook(products, 'Deals');
}

// Writes the results into the sheet, adding the Affiliate Link / Conversion columns if needed.
function writeResults() {
  const hr = Number($('headerRow').value);
  const headerRow = hr >= 0 ? hr : null;
  let affCol;
  if ($('affCol').value === 'new') {
    affCol = state.range.e.c + 1;
    if (headerRow != null) setCell(headerRow, affCol, 'Affiliate Link');
    $('affCol').append(option(affCol, `${colName(affCol)} – Affiliate Link`, true));
  } else {
    affCol = Number($('affCol').value);
  }
  let convCol = null;
  if ($('addConversion').checked) {
    for (let c = state.range.s.c; c <= state.range.e.c && headerRow != null; c++) {
      if (/^conversion$/i.test(cellText(cellAt(headerRow, c)))) convCol = c;
    }
    if (convCol == null) {
      convCol = affCol === state.range.e.c ? affCol + 1 : state.range.e.c + 1;
      if (headerRow != null) setCell(headerRow, convCol, 'Conversion');
    }
  }
  let ok = 0;
  Object.entries(state.results).forEach(([key, r]) => {
    const row = Number(key);
    if (r.affiliate) { setCell(row, affCol, r.affiliate, true); ok++; }
    if (convCol != null) setCell(row, convCol, r.error ? `${r.method || ''} (${r.error})`.slice(0, 250) : r.method);
  });
  return ok;
}

function outputFile() {
  const base = state.fileName.replace(/\.[^.]+$/, '');
  if ($('outFormat').value === 'template') {
    const wb = buildTemplateWorkbook();
    if (state.bookType === 'csv') {
      const csv = '\ufeff' + XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      return { name: `${base}_affiliate.csv`, mime: 'text/csv', blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), base64: btoa(unescape(encodeURIComponent(csv))) };
    }
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { name: `${base}_affiliate.xlsx`, mime, blob: new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: mime }), base64: XLSX.write(wb, { bookType: 'xlsx', type: 'base64' }) };
  }
  if (state.bookType === 'csv') {
    const csv = '﻿' + XLSX.utils.sheet_to_csv(state.ws);
    return { name: `${base}_affiliate.csv`, mime: 'text/csv', blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), base64: btoa(unescape(encodeURIComponent(csv))) };
  }
  const array = XLSX.write(state.wb, { bookType: 'xlsx', type: 'array' });
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return { name: `${base}_affiliate.xlsx`, mime, blob: new Blob([array], { type: mime }), base64: XLSX.write(state.wb, { bookType: 'xlsx', type: 'base64' }) };
}

function download() {
  const out = outputFile();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out.blob);
  a.download = out.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function status(text, ok) {
  $('status').textContent = text;
  $('status').className = 'result ' + (ok ? 'ok' : 'err');
}

async function finish(cancelled) {
  state.port = null;
  $('stop').classList.add('hidden');
  $('start').classList.remove('hidden');
  $('start').disabled = false;
  $('start').textContent = 'Convert again';
  const ok = $('outFormat').value === 'template' ? Object.values(state.results).filter((r) => r.affiliate).length : writeResults();
  state.converted = true;
  const total = Object.keys(state.results).length;
  $('download').classList.remove('hidden');
  let msg = `${cancelled ? 'Stopped. ' : ''}Converted ${ok} of ${total} link(s). Click "Download filled file".`;
  if ($('saveDrive').checked) {
    try {
      const out = outputFile();
      const f = await chrome.runtime.sendMessage({ type: 'saveFileToDrive', name: out.name, mimeType: out.mime, data: out.base64 });
      msg += f && f.ok ? `  Saved to Drive: ${f.url}` : `  Drive save failed: ${(f && f.error) || 'unknown error'}`;
    } catch (e) {
      msg += '  Drive save failed: ' + e.message;
    }
  }
  status(msg, ok > 0);
}

function start() {
  if (!state.items.length) return;
  state.results = {};
  renderRows();
  $('start').classList.add('hidden');
  $('stop').classList.remove('hidden');
  $('download').classList.add('hidden');
  $('progress').classList.remove('hidden');
  $('bar').style.width = '0%';
  status(`Converting 0 / ${state.items.length}…  (keep this tab open)`, true);

  const port = chrome.runtime.connect({ name: 'bulk-convert' });
  state.port = port;
  port.onMessage.addListener((m) => {
    if (m.type === 'progress') {
      state.results[m.key] = m.result;
      updateRow(m.key, m.result);
      $('bar').style.width = Math.round((m.done / m.total) * 100) + '%';
      status(`Converting ${m.done} / ${m.total}…  (keep this tab open)`, true);
    } else if (m.type === 'done') {
      port.disconnect();
      finish(m.cancelled);
    } else if (m.type === 'error') {
      port.disconnect();
      state.port = null;
      $('stop').classList.add('hidden');
      $('start').classList.remove('hidden');
      status(m.error, false);
    }
  });
  port.postMessage({ type: 'start', items: state.items });
}

async function loadFile(file) {
  state.fileName = file.name;
  state.bookType = /\.csv$/i.test(file.name) ? 'csv' : 'xlsx';
  state.results = {};
  state.converted = false;
  try {
    const buf = await file.arrayBuffer();
    state.wb = XLSX.read(buf, { type: 'array', cellStyles: true, cellDates: false, codepage: 65001 });
  } catch (e) {
    $('fileInfo').textContent = 'Could not read this file: ' + e.message;
    return;
  }
  $('fileInfo').textContent = `${file.name} · ${state.wb.SheetNames.length} sheet(s)`;
  const sheetSel = $('sheet');
  sheetSel.innerHTML = '';
  // Default to the first sheet that has links.
  let best = state.wb.SheetNames[0];
  for (const n of state.wb.SheetNames) {
    const ref = state.wb.Sheets[n]['!ref'];
    if (ref && /https?:\/\//i.test(XLSX.utils.sheet_to_csv(state.wb.Sheets[n]).slice(0, 200000))) { best = n; break; }
  }
  state.wb.SheetNames.forEach((n) => sheetSel.append(option(n, n, n === best)));
  $('setup').classList.remove('hidden');
  $('download').classList.add('hidden');
  $('start').textContent = 'Convert links';
  status('', true);
  selectSheet(best);
}

// ---------- wiring ----------
$('file').onchange = (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); };
const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });

$('sheet').onchange = (e) => selectSheet(e.target.value);
$('headerRow').onchange = fillColumns;
$('linkCol').onchange = buildItems;
$('affCol').onchange = buildItems;
$('skipFilled').onchange = buildItems;
$('outFormat').onchange = showMapping;
$('start').onclick = start;
$('stop').onclick = () => { if (state.port) state.port.postMessage({ type: 'cancel' }); };
$('download').onclick = download;

chrome.runtime.sendMessage({ type: 'hasExcelFolder' }).then((r) => {
  if (r && r.ok) $('driveOpt').classList.remove('hidden');
}).catch(() => {});
