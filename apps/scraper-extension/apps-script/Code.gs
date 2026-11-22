/**
 * Deal Scraper bridge for Google Drive + Google Sheets.
 *
 * Setup (one time):
 *   1. Go to https://script.google.com → New project → paste this whole file → Save.
 *   2. Deploy → New deployment → type "Web app".
 *        Execute as: Me
 *        Who has access: Anyone
 *   3. Click Deploy, allow access, copy the Web app URL (ends with /exec)
 *      and paste it into the extension's Settings.
 *
 * The extension sends your folder + sheet links with every request,
 * so you never need to edit this file.
 */

const TEMPLATE_HEADER = [
  'Sr No', 'Store', 'Product Title', 'Brand', 'Price (₹)', 'MRP (₹)', 'Discount %', 'Rating', 'Reviews',
  'Product Link', 'Affiliate Link', 'Conversion', 'Image URL', 'Drive Image Link', 'Scraped At', 'Source Page',
  'Category', 'Subcategory', 'Child Category', 'Deal Type', 'Good For', 'Check List', 'Description', 'Ends',
];

function doGet() {
  return json_({ ok: true, message: 'Deal Scraper bridge is running.', version: 2 });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = ACTIONS[req.action];
    if (!fn) throw new Error('Unknown action: ' + req.action);
    const result = fn(req) || {};
    result.ok = true;
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

const ACTIONS = {
  // Checks the links work and returns their names.
  ping(req) {
    const out = {};
    if (req.folder) out.folder = DriveApp.getFolderById(id_(req.folder)).getName();
    if (req.excelFolder) out.excelFolder = DriveApp.getFolderById(id_(req.excelFolder)).getName();
    if (req.sheet) {
      const ss = SpreadsheetApp.openById(id_(req.sheet));
      out.sheet = ss.getName();
      out.tab = sheet_(ss, req.tab).getName();
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

  // Appends rows. Each row is an object keyed by column header, so the sheet's column order can be anything.
  appendRows(req) {
    const ss = SpreadsheetApp.openById(id_(req.sheet));
    const sh = sheet_(ss, req.tab);
    const headers = headers_(sh, req.header || TEMPLATE_HEADER);
    const values = req.rows.map((r) => headers.map((h) => (r[h] === undefined || r[h] === null ? '' : r[h])));
    if (!values.length) return { added: 0 };
    const first = sh.getLastRow() + 1;
    const srCol = headers.indexOf('Sr No');
    if (srCol >= 0) values.forEach((row, i) => { row[srCol] = first - 1 + i; }); // keeps counting across scrapes
    sh.getRange(first, 1, values.length, headers.length).setValues(values);
    return { added: values.length, firstRow: first, sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId() };
  },

  // Fills Affiliate Link + Conversion for rows whose Product Link matches.
  updateAffiliate(req) {
    const ss = SpreadsheetApp.openById(id_(req.sheet));
    const sh = sheet_(ss, req.tab);
    const headers = headers_(sh, req.header || TEMPLATE_HEADER);
    const linkCol = headers.indexOf('Product Link');
    const affCol = headers.indexOf('Affiliate Link');
    const convCol = headers.indexOf('Conversion');
    const last = sh.getLastRow();
    if (last < 2) return { updated: 0 };
    const data = sh.getRange(2, 1, last - 1, headers.length).getValues();
    const byLink = {};
    req.items.forEach((it) => { if (it.affiliate) byLink[it.link] = it; });
    let updated = 0;
    data.forEach((row) => {
      const it = byLink[row[linkCol]];
      if (!it) return;
      row[affCol] = it.affiliate;
      if (convCol >= 0) row[convCol] = it.method || '';
      updated++;
    });
    sh.getRange(2, affCol + 1, data.length, 1).setValues(data.map((r) => [r[affCol]]));
    if (convCol >= 0) sh.getRange(2, convCol + 1, data.length, 1).setValues(data.map((r) => [r[convCol]]));
    return { updated: updated };
  },

  // Saves the Excel file. Replaces an older file with the same name.
  uploadFile(req) {
    const folder = DriveApp.getFolderById(id_(req.folder));
    const old = folder.getFilesByName(req.name);
    while (old.hasNext()) old.next().setTrashed(true);
    const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType, req.name);
    return info_(folder.createFile(blob), false);
  },
};

// ---------- helpers ----------
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

// Writes the template header on an empty sheet, adds any missing columns at the end, returns the header row.
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

function info_(f, reused) {
  return {
    id: f.getId(),
    name: f.getName(),
    url: 'https://drive.google.com/file/d/' + f.getId() + '/view',
    reused: reused,
  };
}
