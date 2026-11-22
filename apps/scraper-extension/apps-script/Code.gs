/**
 * Deal Scraper bridge + Adyzio dashboard (Google Drive, Google Sheets, web app).
 *
 * Setup (one time):
 *   1. Go to https://script.google.com → New project.
 *      Paste this file into Code.gs. Add an HTML file named "Dashboard" (File → + → HTML)
 *      and paste apps-script/Dashboard.html into it. Save.
 *   2. Deploy → New deployment → type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *   3. Deploy, allow access, copy the Web app URL (ends with /exec):
 *        - paste it into the extension's Settings (with your access key)
 *        - open it in your browser / phone: that is your dashboard.
 *   4. Open the dashboard once and choose your access key (PIN). Put the same key in the extension.
 *
 * Updating later: Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy.
 * The URL stays the same.
 *
 * Sheet layout (created automatically in your Google Sheet):
 *   Products tab (your deals tab) – every scraped product, one row per product (no duplicates).
 *   Live       – only rows with Status = Live (same columns as the products tab).
 *   Category Map – scraped categories you map to Adyzio category slugs (filled once, remembered).
 *   Adyzio Link Sheet (connect it on the dashboard → Settings): Live products are written there in the
 *   plugin's own columns (status, source_url, store, affiliate_url, title, category …) automatically.
 *   Queue      – links added from the dashboard / phone, processed by the Chrome extension.
 *   Job Log    – every scrape / conversion / export.
 */

const VERSION = 3;

const TEMPLATE_HEADER = [
  'Sr No', 'Store', 'Product Title', 'Brand', 'Price (₹)', 'MRP (₹)', 'Discount %', 'Rating', 'Reviews',
  'Product Link', 'Affiliate Link', 'Conversion', 'Image URL', 'Drive Image Link', 'Scraped At', 'Source Page',
  'Category', 'Subcategory', 'Child Category', 'Deal Type', 'Good For', 'Check List', 'Description', 'Ends',
];
// Added at the end of the products tab. Status / Viral / Clicks / Published On are yours to edit;
// re-scraping a product never overwrites them.
const TRACK_HEADER = ['Product ID', 'Status', 'Viral', 'Clicks', 'Published On', 'Job ID', 'Updated At'];
const KEEP_ON_UPDATE = ['Sr No', 'Status', 'Viral', 'Clicks', 'Published On', 'Drive Image Link'];

const STATUS = { SCRAPED: 'Scraped', CONVERTED: 'Converted', FAILED: 'Convert failed', LIVE: 'Live', NOT_PLACED: 'Not placed' };

const QUEUE_HEADER = ['Added At', 'Link', 'Convert', 'Note', 'Status', 'Result', 'Processed At', 'Queue ID'];
const JOBLOG_HEADER = ['Time', 'Job ID', 'Type', 'Source', 'Store', 'Products', 'Converted', 'Failed', 'Stopped', 'Excel', 'Note'];

// ===================== web entry points =====================

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.ping) return json_({ ok: true, message: 'Deal Scraper bridge is running.', version: VERSION });
  return HtmlService.createTemplateFromFile('Dashboard').evaluate()
    .setTitle('Adyzio Deals Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Calls from the Chrome extension.
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    checkKey_(req.key);
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('Unknown action: ' + req.action);
    if (req.sheet) remember_(req.sheet, req.tab);
    const result = fn(req) || {};
    result.ok = true;
    result.version = VERSION;
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// ===================== access key =====================

function props_() { return PropertiesService.getScriptProperties(); }

function checkKey_(key) {
  const saved = props_().getProperty('ACCESS_KEY');
  if (!saved) return; // not set yet: open until you choose a key on the dashboard
  if (String(key || '') !== saved) throw new Error('Wrong access key. Use the same key in the extension Settings and the dashboard.');
}

// Remembers which sheet/tab the extension writes to, so the dashboard reads the same one.
function remember_(sheet, tab) {
  const p = props_();
  const id = id_(sheet);
  if (p.getProperty('SHEET_ID') !== id) p.setProperty('SHEET_ID', id);
  if ((p.getProperty('SHEET_TAB') || '') !== (tab || '')) p.setProperty('SHEET_TAB', tab || '');
}

function master_() {
  const id = props_().getProperty('SHEET_ID');
  if (!id) throw new Error('No sheet connected yet. In the extension Settings press "Save & test links" once.');
  const ss = SpreadsheetApp.openById(id);
  return { ss: ss, sh: sheet_(ss, props_().getProperty('SHEET_TAB') || '') };
}

// ===================== actions for the extension =====================

const ACTIONS = {
  // Checks the links work and returns their names.
  ping(req) {
    const out = { keySet: !!props_().getProperty('ACCESS_KEY') };
    if (req.folder) out.folder = DriveApp.getFolderById(id_(req.folder)).getName();
    if (req.excelFolder) out.excelFolder = DriveApp.getFolderById(id_(req.excelFolder)).getName();
    if (req.sheet) {
      const ss = SpreadsheetApp.openById(id_(req.sheet));
      out.sheet = ss.getName();
      out.tab = sheet_(ss, req.tab).getName();
      ensureTabs_(ss);
    }
    return out;
  },

  // Saves one product image, named after the product title.
  // If an image with the same name already belongs to the same product link, it is reused.
  uploadImage(req) {
    const folder = DriveApp.getFolderById(id_(req.folder));
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      let name = req.name;
      const same = folder.getFilesByName(name);
      while (same.hasNext()) {
        const f = same.next();
        if (req.link && (f.getDescription() || '').indexOf(req.link) >= 0) return info_(f, true);
      }
      if (folder.getFilesByName(name).hasNext()) {
        const dot = name.lastIndexOf('.');
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let i = 2;
        while (folder.getFilesByName(base + ' (' + i + ')' + ext).hasNext()) i++;
        name = base + ' (' + i + ')' + ext;
      }
      const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType || 'image/jpeg', name);
      const file = folder.createFile(blob);
      file.setDescription(req.description || '');
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* domain may block */ }
      return info_(file, false);
    } finally {
      lock.releaseLock();
    }
  },

  // Adds products. A product that is already in the sheet (same Product ID) is updated in place,
  // keeping your Status / Viral / Clicks / Published On.
  appendRows(req) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SpreadsheetApp.openById(id_(req.sheet));
      const sh = sheet_(ss, req.tab);
      const headers = headers_(sh, (req.header || TEMPLATE_HEADER).concat(TRACK_HEADER));
      const col = colIndex_(headers);
      const data = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues() : [];
      const rowById = {};
      data.forEach((row, i) => {
        const pid = row[col['Product ID']] || (row[col['Product Link']] ? productId_(row[col['Product Link']]) : '');
        if (pid) rowById[pid] = i;
      });
      const now = new Date();
      let added = 0;
      let updated = 0;
      let nextSr = data.length + 1;
      const fresh = [];
      req.rows.forEach((r) => {
        const pid = r['Product ID'] || productId_(r['Product Link'] || r['Product Title'] || '');
        const rec = Object.assign({}, r, { 'Product ID': pid, 'Updated At': now, 'Job ID': r['Job ID'] || req.jobId || '' });
        if (rowById[pid] !== undefined) {
          // Existing sheet row, or a duplicate of a row added earlier in this same batch.
          const at = rowById[pid];
          const row = at < data.length ? data[at] : fresh[at - data.length];
          headers.forEach((h, c) => {
            if (KEEP_ON_UPDATE.indexOf(h) >= 0 || rec[h] === undefined || rec[h] === null || rec[h] === '') return;
            row[c] = rec[h];
          });
          row[col['Product ID']] = pid;
          if (!row[col['Status']]) row[col['Status']] = row[col['Affiliate Link']] ? STATUS.CONVERTED : STATUS.SCRAPED;
          if (at < data.length) updated++;
        } else {
          rec['Sr No'] = nextSr++;
          rec['Status'] = rec['Affiliate Link'] ? STATUS.CONVERTED : STATUS.SCRAPED;
          const row = headers.map((h) => (rec[h] === undefined || rec[h] === null ? '' : rec[h]));
          rowById[pid] = data.length + fresh.length; // duplicates inside one batch update the first copy
          fresh.push(row);
          added++;
        }
      });
      if (updated) sh.getRange(2, 1, data.length, headers.length).setValues(data);
      if (fresh.length) sh.getRange(data.length + 2, 1, fresh.length, headers.length).setValues(fresh);
      if (updated) syncLive_(ss, sh);
      return { added: added, updated: updated, sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId() };
    } finally {
      lock.releaseLock();
    }
  },

  // Fills Affiliate Link + Conversion for rows whose Product Link matches, and sets their Status.
  updateAffiliate(req) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const ss = SpreadsheetApp.openById(id_(req.sheet));
      const sh = sheet_(ss, req.tab);
      const headers = headers_(sh, (req.header || TEMPLATE_HEADER).concat(TRACK_HEADER));
      const col = colIndex_(headers);
      const last = sh.getLastRow();
      if (last < 2) return { updated: 0 };
      const data = sh.getRange(2, 1, last - 1, headers.length).getValues();
      const byLink = {};
      req.items.forEach((it) => { byLink[it.link] = it; });
      let updated = 0;
      const now = new Date();
      data.forEach((row) => {
        const it = byLink[row[col['Product Link']]];
        if (!it) return;
        const status = row[col['Status']];
        if (it.affiliate) {
          row[col['Affiliate Link']] = it.affiliate;
          if (status !== STATUS.LIVE && status !== STATUS.NOT_PLACED) row[col['Status']] = STATUS.CONVERTED;
        } else if (!row[col['Affiliate Link']] && (!status || status === STATUS.SCRAPED)) {
          row[col['Status']] = STATUS.FAILED;
        }
        row[col['Conversion']] = it.method || row[col['Conversion']];
        row[col['Updated At']] = now;
        updated++;
      });
      sh.getRange(2, 1, data.length, headers.length).setValues(data);
      syncLive_(ss, sh);
      return { updated: updated };
    } finally {
      lock.releaseLock();
    }
  },

  // Saves the Excel file. Replaces an older file with the same name.
  uploadFile(req) {
    const folder = DriveApp.getFolderById(id_(req.folder));
    const old = folder.getFilesByName(req.name);
    while (old.hasNext()) old.next().setTrashed(true);
    const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType, req.name);
    return info_(folder.createFile(blob), false);
  },

  // One line per job in the Job Log tab.
  logJob(req) {
    const ss = SpreadsheetApp.openById(id_(req.sheet));
    const sh = tab_(ss, 'Job Log', JOBLOG_HEADER);
    const j = req.job || {};
    sh.appendRow([new Date(), j.id || '', j.type || '', j.source || '', j.store || '', j.products || 0,
      j.converted || 0, j.failed || 0, j.stopped ? 'Yes' : '', j.excel || '', j.note || '']);
    return {};
  },

  // Links waiting in the Queue tab (added from the dashboard / phone).
  getQueue(req) {
    const ss = SpreadsheetApp.openById(id_(req.sheet));
    const sh = tab_(ss, 'Queue', QUEUE_HEADER);
    return { items: readTab_(sh).filter((q) => q.Status === 'Waiting').map((q) => ({
      id: q['Queue ID'], link: q.Link, convert: q.Convert !== 'No', note: q.Note,
    })) };
  },

  // Marks a queue item Working / Done / Failed.
  updateQueue(req) {
    const ss = SpreadsheetApp.openById(id_(req.sheet));
    const sh = tab_(ss, 'Queue', QUEUE_HEADER);
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const col = colIndex_(headers);
    const last = sh.getLastRow();
    if (last < 2) return {};
    const data = sh.getRange(2, 1, last - 1, headers.length).getValues();
    data.forEach((row, i) => {
      if (String(row[col['Queue ID']]) !== String(req.id)) return;
      sh.getRange(i + 2, col['Status'] + 1).setValue(req.status);
      if (req.result !== undefined) sh.getRange(i + 2, col['Result'] + 1).setValue(String(req.result).slice(0, 500));
      if (req.status !== 'Working') sh.getRange(i + 2, col['Processed At'] + 1).setValue(new Date());
    });
    return {};
  },
};

// ===================== dashboard (called from Dashboard.html) =====================

function dashSetupNeeded() {
  return { keySet: !!props_().getProperty('ACCESS_KEY'), sheet: !!props_().getProperty('SHEET_ID') };
}

// First visit only: choose the access key (PIN). After that it can only be changed with the old key.
function dashSetKey(oldKey, newKey) {
  newKey = String(newKey || '').trim();
  if (newKey.length < 6) throw new Error('Use at least 6 characters.');
  const saved = props_().getProperty('ACCESS_KEY');
  if (saved && saved !== oldKey) throw new Error('The current key is wrong.');
  props_().setProperty('ACCESS_KEY', newKey);
  return true;
}

function dashSettings_() {
  const p = props_();
  return {
    viralDiscount: Number(p.getProperty('VIRAL_DISCOUNT') || 60),
    viralClicks: Number(p.getProperty('VIRAL_CLICKS') || 100),
    viralDealTypes: p.getProperty('VIRAL_DEAL_TYPES') || 'loot,lightning',
  };
}

function dashSaveSettings(key, s) {
  checkKeyStrict_(key);
  const p = props_();
  p.setProperty('VIRAL_DISCOUNT', String(Number(s.viralDiscount) || 60));
  p.setProperty('VIRAL_CLICKS', String(Number(s.viralClicks) || 100));
  p.setProperty('VIRAL_DEAL_TYPES', String(s.viralDealTypes || ''));
  return dashSettings_();
}

function checkKeyStrict_(key) {
  const saved = props_().getProperty('ACCESS_KEY');
  if (!saved) throw new Error('Choose an access key first.');
  if (String(key || '') !== saved) throw new Error('Wrong access key.');
}

const DASH_FIELDS = ['Product ID', 'Sr No', 'Store', 'Product Title', 'Brand', 'Price (₹)', 'MRP (₹)', 'Discount %',
  'Rating', 'Product Link', 'Affiliate Link', 'Conversion', 'Image URL', 'Scraped At', 'Category', 'Subcategory',
  'Child Category', 'Deal Type', 'Status', 'Viral', 'Clicks', 'Published On', 'Job ID', 'Updated At'];

// Everything the dashboard shows, in one call.
function dashData(key) {
  checkKeyStrict_(key);
  const m = master_();
  ensureTabs_(m.ss);
  const rows = readTab_(m.sh).map((r) => {
    const o = {};
    DASH_FIELDS.forEach((f) => { o[f] = r[f] instanceof Date ? r[f].toISOString() : (r[f] === undefined ? '' : r[f]); });
    if (!o['Product ID'] && o['Product Link']) o['Product ID'] = productId_(o['Product Link']);
    if (!o.Status) o.Status = o['Affiliate Link'] ? STATUS.CONVERTED : STATUS.SCRAPED;
    return o;
  }).filter((o) => o['Product Title'] || o['Product Link']);
  const jobs = readTab_(tab_(m.ss, 'Job Log', JOBLOG_HEADER)).slice(-300).map(plain_);
  const queue = readTab_(tab_(m.ss, 'Queue', QUEUE_HEADER)).slice(-200).map(plain_);
  return {
    sheetName: m.ss.getName(),
    sheetUrl: m.ss.getUrl(),
    tab: m.sh.getName(),
    liveUrl: m.ss.getUrl() + '#gid=' + tab_(m.ss, 'Live', null).getSheetId(),
    products: rows,
    jobs: jobs,
    queue: queue,
    settings: dashSettings_(),
    adyzio: (function () {
      const c = adyzioCfg_();
      let url = '';
      const own = !c.sheet && !!m.ss.getSheetByName(c.tab); // one-sheet setup: Link Sheet tab in this spreadsheet
      if (c.sheet) url = 'https://docs.google.com/spreadsheets/d/' + c.sheet + '/edit';
      else if (own) url = m.ss.getUrl() + '#gid=' + m.ss.getSheetByName(c.tab).getSheetId();
      return { connected: !!c.sheet || own, sameSheet: own, url: url, tab: c.tab, last: c.last };
    })(),
    categoryMapUrl: m.ss.getUrl() + '#gid=' + tab_(m.ss, 'Category Map', CATMAP_HEADER).getSheetId(),
    at: new Date().toISOString(),
  };
}

// Changes Status (Live / Not placed / Converted …) or Viral for some products.
function dashUpdate(key, ids, field, value) {
  checkKeyStrict_(key);
  if (['Status', 'Viral', 'Clicks'].indexOf(field) < 0) throw new Error('Field not editable: ' + field);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const m = master_();
    const headers = headers_(m.sh, TEMPLATE_HEADER.concat(TRACK_HEADER));
    const col = colIndex_(headers);
    const last = m.sh.getLastRow();
    if (last < 2) return 0;
    const data = m.sh.getRange(2, 1, last - 1, headers.length).getValues();
    const want = {};
    ids.forEach((id) => { want[id] = true; });
    let n = 0;
    data.forEach((row) => {
      const pid = row[col['Product ID']] || (row[col['Product Link']] ? productId_(row[col['Product Link']]) : '');
      if (!want[pid]) return;
      row[col['Product ID']] = pid;
      row[col[field]] = value;
      if (field === 'Status' && value === STATUS.LIVE && !row[col['Published On']]) row[col['Published On']] = new Date();
      if (field === 'Status' && value !== STATUS.LIVE) row[col['Published On']] = '';
      row[col['Updated At']] = new Date();
      n++;
    });
    m.sh.getRange(2, 1, data.length, headers.length).setValues(data);
    syncLive_(m.ss, m.sh);
    return n;
  } finally {
    lock.releaseLock();
  }
}

// Phone / dashboard: add links for the Chrome extension to scrape (+ convert).
function dashAddQueue(key, links, convert, note) {
  checkKeyStrict_(key);
  const m = master_();
  const sh = tab_(m.ss, 'Queue', QUEUE_HEADER);
  const list = String(links || '').split(/[\s,]+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s) || /^@?[\w.-]+$/.test(s));
  if (!list.length) throw new Error('No links found.');
  const now = new Date();
  const rows = list.map((l, i) => [now, l, convert ? 'Yes' : 'No', note || '', 'Waiting', '', '', now.getTime().toString(36) + i]);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, QUEUE_HEADER.length).setValues(rows);
  return rows.length;
}

function dashCancelQueue(key, id) {
  checkKeyStrict_(key);
  return ACTIONS.updateQueue({ sheet: master_().ss.getId(), id: id, status: 'Cancelled', result: 'Cancelled from dashboard' });
}

// ===================== helpers =====================

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function id_(link) {
  const s = String(link || '').trim();
  const m = s.match(/\/(?:folders|d)\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  if (/^[\w-]{10,}$/.test(s)) return s;
  throw new Error('Not a Google Drive/Sheets link: ' + s);
}

function sheet_(ss, tab) {
  if (!tab) return ss.getSheets()[0];
  return ss.getSheetByName(tab) || ss.insertSheet(tab);
}

// A named tab, created with its header row if missing.
function tab_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) {
      sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  } else if (header) {
    headers_(sh, header);
  }
  return sh;
}

function ensureTabs_(ss) {
  tab_(ss, 'Queue', QUEUE_HEADER);
  tab_(ss, 'Job Log', JOBLOG_HEADER);
  tab_(ss, 'Live', null);
}

// Writes the header on an empty sheet, adds any missing columns at the end, returns the header row.
function headers_(sh, wanted) {
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, wanted.length).setValues([wanted]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return wanted.slice();
  }
  const current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  wanted.forEach((h) => {
    if (current.indexOf(h) < 0) {
      current.push(h);
      sh.getRange(1, current.length).setValue(h).setFontWeight('bold');
    }
  });
  return current;
}

function colIndex_(headers) {
  const c = {};
  headers.forEach((h, i) => { c[h] = i; });
  return c;
}

function readTab_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
  const headers = values[0].map(String);
  return values.slice(1).map((row) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = row[i]; });
    return o;
  });
}

function plain_(o) {
  const out = {};
  Object.keys(o).forEach((k) => { out[k] = o[k] instanceof Date ? o[k].toISOString() : o[k]; });
  return out;
}

// Stable id for a product: a short hash of its store link.
function productId_(link) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(link).trim().toLowerCase());
  return 'P' + bytes.slice(0, 6).map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

// Rewrites the Live tab: every product with Status = Live, newest first, same columns as the products tab.
// The Adyzio website plugin reads this tab.
function syncLive_(ss, sh) {
  const live = tab_(ss, 'Live', null);
  const last = sh.getLastRow();
  const width = sh.getLastColumn();
  if (last < 1 || width < 1) return;
  const values = sh.getRange(1, 1, last, width).getValues();
  const headers = values[0].map(String);
  const sc = headers.indexOf('Status');
  const pc = headers.indexOf('Published On');
  const rows = values.slice(1).filter((r) => r[sc] === STATUS.LIVE);
  rows.sort((a, b) => (new Date(b[pc] || 0)) - (new Date(a[pc] || 0)));
  live.clearContents();
  live.getRange(1, 1, 1, width).setValues([headers]).setFontWeight('bold');
  live.setFrozenRows(1);
  if (rows.length) live.getRange(2, 1, rows.length, width).setValues(rows);
  // Also update the Adyzio Link Sheet (the adyzio.com plugin), if connected.
  try {
    syncAdyzio_(ss, sh);
  } catch (e) {
    props_().setProperty('ADYZIO_LAST', JSON.stringify({ error: String((e && e.message) || e), at: new Date().toISOString() }));
  }
}

function info_(f, reused) {
  return {
    id: f.getId(),
    name: f.getName(),
    url: 'https://drive.google.com/file/d/' + f.getId() + '/view',
    reused: reused,
  };
}

// ===================== Adyzio Link Sheet sync =====================
// Writes every Live product into your "Adyzio Link Sheet" (the sheet the adyzio.com plugin reads),
// in its own columns, with the same checks as adyzio_links.py (validate/export):
//   status       READY / READY_CHECK / ERROR (reason in notes)
//   store        amazon, flipkart, myntra … or other (the importer's list)
//   category     a slug from the Categories tab (via the Category Map tab when needed)
//   Amazon rule  price, mrp and image are left empty for Amazon (allowed only from Amazon's API)
// Rows are matched by source_url. Rows you added by hand are never changed. A product that is no longer
// Live gets is_active = 0 (never deleted). Rows written here carry "[DS:<Product ID>]" in notes.

const ADYZIO_STORES = {
  amazon: ['amazon.', 'amzn.to', 'amzn.in', 'amzn.eu'],
  flipkart: ['flipkart.', 'fkrt.it', 'fkrt.cc', 'fkrt.co', 'dl.flipkart'],
  myntra: ['myntra.', 'myntr.it'], meesho: ['meesho.'], ajio: ['ajio.'], nykaa: ['nykaa.'],
  tatacliq: ['tatacliq.'], croma: ['croma.'], shopsy: ['shopsy.'], jiomart: ['jiomart.'],
  decathlon: ['decathlon.'], pepperfry: ['pepperfry.'], snapdeal: ['snapdeal.'], firstcry: ['firstcry.'],
  lenskart: ['lenskart.'], boat: ['boat-lifestyle.'],
};

const CATMAP_HEADER = ['Scraped category', 'Adyzio category (slug)', 'Products', 'Example product'];

// Keyword → category slug guesses (checked on the title first, then subcategory / category).
// Anything not matched goes to the Category Map tab for you to fill.
const CATEGORY_GUESSES = [
  [/\b(lipstick|lip ?(gloss|liner|balm|stain|tint|oil)|blush|mascara|foundation|eye ?liner|kajal|primer|concealer|highlighter|contour|bronzer|compact|eyeshadow|eye shadow|makeup|setting (spray|powder)|loose powder|nail (polish|paint))\b/i, 'makeup'],
  [/\b(serum|moisturi[sz]er|sunscreen|spf|face ?wash|cleanser|toner|face cream|night cream|skin ?care|body lotion)\b/i, 'skin-care'],
  [/\b(shampoo|conditioner|hair (oil|serum|mask|care)|hair dryer|straightener)\b/i, 'hair-care'],
  [/\b(trimmer|shaver|razor|beard|perfume|fragrance|deodorant|eau de)\b/i, 'grooming'],
  [/\b(earbuds?|headphones?|earphones?|neckband|tws)\b/i, 'headphones-earbuds'],
  [/\bsmart ?watch/i, 'smart-watches'],
  [/\b(bluetooth )?speakers?\b/i, 'bluetooth-speakers'],
  [/\bpower ?banks?\b/i, 'power-banks'],
  [/\b(smart ?phones?|mobile phones?|5g phone)\b/i, 'smartphones'],
  [/\b(laptops?|notebook pc)\b/i, 'laptops'],
  [/\b(backpacks?|rucksack)\b/i, 'backpacks'],
  [/\b(handbags?|sling bags?|tote|clutch|shoulder bags?)\b/i, 'handbags'],
  [/\b(trolley|luggage|suitcase)\b/i, 'trolley-bags'],
  [/\b(earrings?|necklace|bracelet|pendant|jewell?ery|anklet|rings?)\b/i, 'jewellery'],
  [/\b(sarees?)\b/i, 'sarees'],
  [/\b(kurtas?|kurtis?|kurta set)\b/i, 'kurtas-kurtis'],
  [/\b(sandals?|slippers?|flip ?flops?|sliders?)\b/i, 'sandals-slippers'],
  [/\b(running|sports) shoes?\b/i, 'sports-shoes'],
];
const WOMEN_RE = /\b(women|womens|ladies|girls?)\b/i;
const MEN_RE = /\b(men|mens|boys?)\b/i;

function adyzioCfg_() {
  const p = props_();
  return {
    sheet: p.getProperty('ADYZIO_SHEET') || '',
    tab: p.getProperty('ADYZIO_TAB') || 'Link Sheet',
    catsTab: p.getProperty('ADYZIO_CATS_TAB') || 'Categories',
    last: JSON.parse(p.getProperty('ADYZIO_LAST') || 'null'),
  };
}

function adyzioStore_(link) {
  const m = String(link || '').match(/^https?:\/\/([^/?#]+)/i);
  if (!m) return 'other';
  const h = m[1].toLowerCase();
  for (const s in ADYZIO_STORES) if (ADYZIO_STORES[s].some((n) => h.indexOf(n) >= 0)) return s;
  return 'other';
}

function slugify_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// Same idea as affiliate_ok() in adyzio_links.py.
function affiliateOk_(link, store) {
  const l = String(link || '').toLowerCase();
  if (!l) return 'missing';
  const h = (l.match(/^https?:\/\/([^/?#]+)/) || [])[1] || '';
  if (store === 'amazon') return /^(amzn\.to|amzn\.in|amzn\.eu)$/.test(h) || l.indexOf('tag=') >= 0 ? 'ok' : 'missing';
  if (store === 'flipkart') {
    if (h.indexOf('fkrt.') === 0 || l.indexOf('affid=') >= 0) return 'ok';
    return adyzioStore_(link) === 'flipkart' ? 'missing' : 'unknown';
  }
  const shortHost = h.split('.').length === 2 && h.length <= 10 && adyzioStore_(link) === 'other';
  return adyzioStore_(link) === store && !shortHost ? 'plain' : 'unknown';
}

function isoDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const m = String(v).match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  const m2 = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : '';
}

// Reads the Categories tab (names, slugs) and your Category Map tab.
function adyzioCategories_(ass, cfg, master) {
  const cats = { bySlug: {}, byName: {} };
  const csh = ass.getSheetByName(cfg.catsTab);
  if (csh) readTab_(csh).forEach((c) => {
    const slug = String(c.slug || '').trim().toLowerCase();
    if (!slug) return;
    cats.bySlug[slug] = { name: String(c.name), parent: String(c.parent || '') };
    cats.byName[String(c.name).trim().toLowerCase()] = slug;
  });
  const map = {};
  const msh = tab_(master, 'Category Map', CATMAP_HEADER);
  readTab_(msh).forEach((r) => {
    const v = String(r['Adyzio category (slug)'] || '').trim().toLowerCase();
    if (r['Scraped category'] && v) map[String(r['Scraped category']).trim().toLowerCase()] = cats.byName[v] || slugify_(v);
  });
  cats.map = map;
  cats.mapSheet = msh;
  return cats;
}

// → { slug, how: 'map' | 'exact' | 'guess' | '', key }
function adyzioCategory_(p, cats) {
  const parts = [p['Child Category'], p['Subcategory'], p['Category']].map((x) => String(x || '').trim()).filter(Boolean);
  const path = [p['Category'], p['Subcategory'], p['Child Category']].map((x) => String(x || '').trim()).filter(Boolean).join(' › ');
  const hit = (slug, how) => ({ slug: slug, how: how, key: path });
  // 1. Your Category Map (full path first, then each level).
  for (const k of [path].concat(parts)) {
    const v = cats.map[String(k).toLowerCase()];
    if (v && cats.bySlug[v]) return hit(v, 'map');
  }
  // 2. Exact name or slug, most specific first.
  for (const k of parts) {
    if (cats.byName[k.toLowerCase()]) return hit(cats.byName[k.toLowerCase()], 'exact');
    if (cats.bySlug[slugify_(k)]) return hit(slugify_(k), 'exact');
  }
  // 3. Keyword guesses: title first (store categories can be wrong), then the category path.
  const texts = [String(p['Product Title'] || '')].concat(parts);
  for (const t of texts) {
    for (const g of CATEGORY_GUESSES) if (g[0].test(t) && cats.bySlug[g[1]]) return hit(g[1], 'guess');
    const women = WOMEN_RE.test(t);
    const men = MEN_RE.test(t) && !women;
    const pick = (slug) => (cats.bySlug[slug] ? hit(slug, 'guess') : null);
    let r = null;
    if (/\b(dress(es)?|gown)\b/i.test(t)) r = pick('dresses');
    else if (/\b(tops?|crop top|blouse)\b/i.test(t) && women) r = pick('tops');
    else if (/\b(t-?shirts?|tees?)\b/i.test(t) && !women) r = pick('t-shirts');
    else if (/\bshirts?\b/i.test(t) && men) r = pick('shirts');
    else if (/\bjeans\b/i.test(t)) r = pick(women ? 'women-s-fashion' : 'jeans');
    else if (/\bwatch(es)?\b/i.test(t)) r = pick(women ? 'women-s-watches' : 'men-s-watches');
    else if (/\b(shoes?|sneakers?|heels|boots?|loafers?)\b/i.test(t)) r = pick(women ? 'women-s-footwear' : 'men-s-shoes');
    if (r) return r;
  }
  return hit('', '');
}

// One Link Sheet row (keyed by the Adyzio column names) with the validate checks.
function adyzioRow_(p, cats, active) {
  const store = adyzioStore_(p['Product Link'] || p['Affiliate Link']);
  const aff = String(p['Affiliate Link'] || '').trim();
  const title = String(p['Product Title'] || '').trim();
  const cat = adyzioCategory_(p, cats);
  const errs = [];
  const warns = [];
  if (!title) errs.push('title is empty');
  else if (title.length > 255) errs.push('title longer than 255 characters');
  if (!aff) errs.push('affiliate_url is empty (convert it first)');
  else if (!/^https:\/\//i.test(aff)) errs.push('affiliate_url must start with https://');
  else {
    const st = affiliateOk_(aff, store);
    if (st === 'missing') errs.push('affiliate_url has no affiliate ID - it would earn nothing');
    else if (st === 'plain') warns.push('affiliate_url looks like the plain store page - make sure it came out of ExtraPe');
    else if (st === 'unknown') warns.push('open the affiliate link once to confirm it lands on the right product');
  }
  if (!cat.slug) errs.push('category not matched - fill it in the Category Map tab');
  else if (cat.how === 'guess') warns.push('category guessed (' + cat.slug + ') - fix it in the Category Map tab if wrong');
  const amazon = store === 'amazon';
  const price = amazon ? '' : (Number(p['Price (₹)']) || '');
  const mrp = amazon ? '' : (Number(p['MRP (₹)']) || '');
  if (price && mrp && price > mrp) errs.push('price is higher than mrp');
  const image = amazon ? '' : String(p['Image URL'] || '');
  if (image && !/^https:\/\//i.test(image)) errs.push('image must be an https:// URL');
  const viral = /^(yes|y|true|1)$/i.test(String(p.Viral || ''));
  const status = errs.length ? 'ERROR' : (warns.length ? 'READY_CHECK' : 'READY');
  return {
    cat: cat,
    row: {
      status: status,
      source_url: p['Product Link'] || '',
      store: store,
      affiliate_url: aff,
      title: title.slice(0, 255),
      category: cat.slug,
      brand: p.Brand || '',
      price: price,
      mrp: mrp,
      price_checked_on: price ? (isoDate_(p['Scraped At']) || isoDate_(p['Updated At'])) : '',
      image: image,
      description: String(p.Description || '').split(' | ')[0].slice(0, 2000),
      is_deal: (p['Deal Type'] || (Number(p['Discount %']) || 0) > 0) ? 1 : 0,
      is_featured: viral ? 1 : 0,
      is_active: active ? 1 : 0,
      deal_type: p['Deal Type'] || '',
      deal_ends: isoDate_(p.Ends),
      added_on: isoDate_(p['Published On']) || isoDate_(new Date()),
      notes: ('[DS:' + p['Product ID'] + '] ' + errs.concat(warns).join('; ')).trim(),
    },
  };
}

// Main sync. Returns a summary (also saved for the dashboard).
function syncAdyzio_(master, sh) {
  const cfg = adyzioCfg_();
  // One-sheet setup: if no separate Adyzio sheet is set, use the "Link Sheet" tab of this same spreadsheet.
  const sheetId = cfg.sheet || (master.getSheetByName(cfg.tab) ? master.getId() : '');
  if (!sheetId) return null;
  const ass = sheetId === master.getId() ? master : SpreadsheetApp.openById(id_(sheetId));
  const lsh = ass.getSheetByName(cfg.tab);
  if (!lsh) throw new Error('Tab "' + cfg.tab + '" not found in the Adyzio sheet.');
  const cats = adyzioCategories_(ass, cfg, master);

  const products = readTab_(sh).filter((p) => p['Product Link']);
  products.forEach((p) => { if (!p['Product ID']) p['Product ID'] = productId_(p['Product Link']); });

  const width = Math.max(lsh.getLastColumn(), 1);
  const headers = lsh.getRange(1, 1, 1, width).getValues()[0].map((h) => String(h).trim());
  const col = colIndex_(headers);
  ['status', 'source_url', 'affiliate_url', 'title', 'is_active', 'notes'].forEach((h) => {
    if (col[h] === undefined) throw new Error('The Adyzio sheet has no "' + h + '" column.');
  });
  const last = lsh.getLastRow();
  const data = last > 1 ? lsh.getRange(2, 1, last - 1, headers.length).getValues() : [];
  const ours = {};     // Product ID → row index (rows written by this script)
  const bySource = {}; // source_url → row index (any row)
  data.forEach((r, i) => {
    const m = String(r[col.notes] || '').match(/\[DS:(P[0-9a-f]+)\]/);
    if (m) ours[m[1]] = i;
    if (r[col.source_url]) bySource[String(r[col.source_url]).trim()] = i;
  });

  const out = { added: 0, updated: 0, deactivated: 0, ready: 0, check: 0, error: 0, skippedManual: 0, unmapped: 0, at: new Date().toISOString() };
  const fresh = [];
  const unmapped = {};
  const KEEP = ['posted_channels', 'gallery', 'video_url', 'features', 'short_desc']; // yours to edit in the Adyzio sheet
  products.forEach((p) => {
    const live = p.Status === STATUS.LIVE;
    const at = ours[p['Product ID']];
    if (!live && at === undefined) return; // never published: nothing to do
    if (live && at === undefined && bySource[String(p['Product Link']).trim()] !== undefined) { out.skippedManual++; return; }
    if (!live && data[at][col.is_active] === 0) return; // already switched off
    const r = adyzioRow_(p, cats, live);
    if (live) {
      out[r.row.status === 'READY' ? 'ready' : r.row.status === 'ERROR' ? 'error' : 'check']++;
      if (!r.cat.slug) {
        out.unmapped++;
        const k = r.cat.key || '(no category)';
        unmapped[k] = unmapped[k] || { n: 0, example: p['Product Title'] };
        unmapped[k].n++;
      }
    }
    if (at !== undefined) {
      const row = data[at];
      headers.forEach((h, c) => {
        if (!(h in r.row) || KEEP.indexOf(h) >= 0) return;
        if (!live && h !== 'is_active') return; // no longer Live: only switch it off
        row[c] = r.row[h];
      });
      if (live) out.updated++; else out.deactivated++;
    } else {
      fresh.push(headers.map((h) => (h in r.row ? r.row[h] : '')));
      out.added++;
    }
  });
  if (data.length && (out.updated || out.deactivated)) lsh.getRange(2, 1, data.length, headers.length).setValues(data);
  if (fresh.length) lsh.getRange(data.length + 2, 1, fresh.length, headers.length).setValues(fresh);

  // Unmatched categories → Category Map tab (fill column B once; it is remembered).
  const msh = cats.mapSheet;
  const existing = {};
  readTab_(msh).forEach((r, i) => { existing[String(r['Scraped category']).trim().toLowerCase()] = i + 2; });
  Object.keys(unmapped).forEach((k) => {
    const rowNo = existing[k.toLowerCase()];
    if (rowNo) msh.getRange(rowNo, 3).setValue(unmapped[k].n);
    else msh.appendRow([k, '', unmapped[k].n, unmapped[k].example]);
  });
  props_().setProperty('ADYZIO_LAST', JSON.stringify(out));
  return out;
}

// Dashboard: connect / disconnect the Adyzio Link Sheet, and sync on demand.
function dashSaveAdyzio(key, sheetLink, tab) {
  checkKeyStrict_(key);
  const p = props_();
  if (!sheetLink) { p.deleteProperty('ADYZIO_SHEET'); return adyzioCfg_(); }
  const ss = SpreadsheetApp.openById(id_(sheetLink));
  const t = String(tab || 'Link Sheet').trim();
  if (!ss.getSheetByName(t)) throw new Error('No tab "' + t + '" in "' + ss.getName() + '".');
  p.setProperty('ADYZIO_SHEET', id_(sheetLink));
  p.setProperty('ADYZIO_TAB', t);
  return adyzioCfg_();
}

function dashSyncAdyzio(key) {
  checkKeyStrict_(key);
  const m = master_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const r = syncAdyzio_(m.ss, m.sh);
    if (!r) throw new Error('Connect your Adyzio Link Sheet in Settings first.');
    return r;
  } finally {
    lock.releaseLock();
  }
}
