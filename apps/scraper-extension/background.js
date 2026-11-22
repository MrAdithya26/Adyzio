// Background service worker: runs scrape/export and conversion jobs so they keep going after the popup closes.
importScripts(
  'lib/xlsx.full.min.js',
  'common/stores.js',
  'common/settings.js',
  'bg/gdrive.js',
  'bg/excel.js',
  'bg/converter.js'
);

const S = self.DealStores;

// ---------------- Status & job storage ----------------
async function setStatus(status) {
  const full = { ...status, updatedAt: Date.now() };
  await chrome.storage.local.set({ jobStatus: full });
  const badge = status.state === 'running' ? (status.total ? `${Math.round((status.done / status.total) * 100)}%` : '…')
    : status.state === 'error' ? '!' : '';
  chrome.action.setBadgeBackgroundColor({ color: status.state === 'error' ? '#d93025' : '#2563eb' });
  chrome.action.setBadgeText({ text: badge });
}

async function getJob() {
  const { lastJob } = await chrome.storage.local.get('lastJob');
  return lastJob || null;
}

async function saveJob(job) {
  await chrome.storage.local.set({ lastJob: job });
}

let busy = false;
async function runExclusive(fn) {
  if (busy) throw new Error('Another job is still running. Please wait for it to finish.');
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

// ---------------- Helpers ----------------
function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

function slug(s, max) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max || 40) || 'item';
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function pool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

function extFromType(type, url) {
  if (/png/.test(type)) return 'png';
  if (/webp/.test(type)) return 'webp';
  if (/gif/.test(type)) return 'gif';
  if (/avif/.test(type)) return 'avif';
  const m = String(url).match(/\.(jpe?g|png|webp|gif|avif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

// ---------------- Scrape ----------------
async function scrapeTab(tabId, settings) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['common/stores.js', 'content/scraper.js'] });
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (opts) => window.__dealScrape(opts),
    args: [{ autoScroll: settings.autoScroll, maxScrolls: Number(settings.maxScrolls) || 20, highResImages: settings.highResImages }],
  });
  if (!res || !res.result) throw new Error('Could not read this page. Reload the page and try again.');
  return res.result;
}

// Image file name = product title, so the image in Drive and the row in the sheet match.
function imageFileName(p, ext) {
  const base = String(p.title || `${p.storeId} ${hash(p.link)}`)
    .replace(/[\\/:*?"<>|#%{}~&\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
    .trim();
  return `${base}.${ext}`;
}

async function uploadImages(job, settings) {
  const { imageCache = {} } = await chrome.storage.local.get('imageCache');
  const todo = job.products.filter((p) => p.image);
  let done = 0;
  let failed = 0;
  await pool(todo, 3, async (p) => {
    try {
      const cacheKey = `${settings.imagesFolderLink}|${p.link}`;
      if (imageCache[cacheKey]) {
        p.driveImageLink = imageCache[cacheKey];
      } else {
        const r = await fetch(p.image, { credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
        const file = await DealGDrive.call(settings, 'uploadImage', {
          folder: settings.imagesFolderLink,
          name: imageFileName(p, extFromType(type, p.image)),
          mimeType: type,
          data: DealGDrive.base64(await blob.arrayBuffer()),
          link: p.link,
          description: `${p.title}\nProduct link: ${p.link}\nStore: ${p.store}`,
        });
        p.driveImageLink = file.url;
        p.driveImageName = file.name;
        imageCache[cacheKey] = file.url;
      }
    } catch (e) {
      failed++;
      p.driveImageLink = `Upload failed: ${e.message}`.slice(0, 200);
    }
    done++;
    await setStatus({ kind: 'scrape', state: 'running', phase: `Saving images to Google Drive (${done}/${todo.length})`, done, total: todo.length });
  });
  const keys = Object.keys(imageCache);
  if (keys.length > 5000) keys.slice(0, keys.length - 5000).forEach((k) => delete imageCache[k]);
  await chrome.storage.local.set({ imageCache });
  return { uploaded: todo.length - failed, failed };
}

async function exportExcel(job, settings, { isUpdate, skipDrive }) {
  const wb = DealExcel.buildWorkbook(job.products, job.store);
  const base = `${slug(job.store, 20)}_${stamp(new Date(job.createdAt))}`;
  const result = {};
  const warnings = [];

  if (settings.downloadExcelLocally) {
    await chrome.downloads.download({
      url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + DealExcel.toBase64(wb),
      filename: `DealScraper/${base}${isUpdate ? '_affiliate' : ''}.xlsx`,
      conflictAction: 'uniquify',
      saveAs: false,
    });
    result.downloaded = `${base}${isUpdate ? '_affiliate' : ''}.xlsx`;
  }
  if (skipDrive || !DealGDrive.configured(settings)) return { result, warnings };
  if (settings.imagesFolderLink && settings.uploadImages) result.imagesFolder = settings.imagesFolderLink;

  // Excel copy in Drive (same file name, replaced after conversion).
  if (settings.excelFolderLink) {
    try {
      const f = await DealGDrive.call(settings, 'uploadFile', {
        folder: settings.excelFolderLink,
        name: `${base}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: DealExcel.toBase64(wb),
      });
      job.excelLink = f.url;
      result.driveLink = f.url;
    } catch (e) {
      warnings.push('Excel not saved to Drive: ' + e.message);
    }
  }

  // Google Sheet: append rows after scraping, fill affiliate links after converting.
  if (settings.sheetLink) {
    try {
      if (!isUpdate) {
        const r = await DealGDrive.call(settings, 'appendRows', {
          sheet: settings.sheetLink,
          tab: settings.sheetTab,
          header: DealExcel.HEADER,
          rows: job.products.map(DealExcel.toRecord),
        });
        job.sheetUrl = r.sheetUrl;
      } else {
        await DealGDrive.call(settings, 'updateAffiliate', {
          sheet: settings.sheetLink,
          tab: settings.sheetTab,
          header: DealExcel.HEADER,
          items: job.products.map((p) => ({ link: p.link, affiliate: p.affiliateLink, method: p.affiliateMethod })),
        });
      }
      result.sheetLink = job.sheetUrl || settings.sheetLink;
    } catch (e) {
      warnings.push('Google Sheet not updated: ' + e.message);
    }
  }
  return { result, warnings };
}

async function runScrapeJob(tabId) {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    try {
      await setStatus({ kind: 'scrape', state: 'running', phase: settings.autoScroll ? 'Scrolling and reading the page…' : 'Reading the page…' });
      const page = await scrapeTab(tabId, settings);
      if (!page.products.length) throw new Error('No products found on this page.');
      const now = new Date();
      const { batchDefaults = {} } = await chrome.storage.local.get('batchDefaults');
      const pick = (k, fallback) => (batchDefaults[k] || '').trim() || fallback || '';
      const job = {
        id: hash(page.url + now.getTime()),
        createdAt: now.getTime(),
        sourceUrl: page.url,
        pageTitle: page.pageTitle,
        pageType: page.pageType,
        store: page.store,
        products: page.products.map((p) => ({
          ...p,
          affiliateLink: '',
          affiliateMethod: '',
          driveImageLink: '',
          scrapedAt: now.toLocaleString('en-IN'),
          sourcePage: page.url,
          category: pick('category', p.category),
          subcategory: pick('subcategory', p.subcategory),
          childCategory: pick('childCategory', p.childCategory),
          dealType: pick('dealType'),
          goodFor: pick('goodFor'),
          checkList: pick('checkList'),
          description: p.description || '',
          ends: pick('ends'),
        })),
      };
      await saveJob(job);

      const warnings = [];
      if (settings.uploadImages && DealGDrive.configured(settings) && settings.imagesFolderLink) {
        const r = await uploadImages(job, settings);
        if (r.failed) warnings.push(`${r.failed} image(s) could not be saved to Drive`);
        await saveJob(job);
      } else if (settings.uploadImages) {
        warnings.push('Drive not set up (Settings → Google Drive), so images were not saved');
      }

      await setStatus({ kind: 'scrape', state: 'running', phase: 'Creating Excel and updating Google Sheet…' });
      const { result: out, warnings: w2 } = await exportExcel(job, settings, { isUpdate: false });
      warnings.push(...w2);
      await saveJob(job);
      await setStatus({
        kind: 'scrape',
        state: 'done',
        phase: `Scraped ${job.products.length} product(s) from ${job.store}.`,
        warnings,
        links: out,
      });
      return { ok: true, count: job.products.length };
    } catch (e) {
      await setStatus({ kind: 'scrape', state: 'error', phase: e.message });
      return { ok: false, error: e.message };
    }
  });
}

async function runConvertJob() {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    const job = await getJob();
    try {
      if (!job || !job.products.length) throw new Error('Scrape a page first (Option 1), then convert its links.');
      await setStatus({ kind: 'convert', state: 'running', phase: 'Converting links…', done: 0, total: job.products.length });
      const results = await DealConverter.convertMany(job.products.map((p) => p.link), settings, async (done, total, r) => {
        await setStatus({ kind: 'convert', state: 'running', phase: `Converting links (${done}/${total}) – ${r.store || ''}`, done, total });
      });
      let ok = 0;
      const errors = [];
      results.forEach((r, i) => {
        const p = job.products[i];
        p.affiliateLink = r.affiliate || '';
        p.affiliateMethod = r.error ? `${r.method} (${r.error})`.slice(0, 250) : r.method;
        if (r.affiliate) ok++;
        if (r.error) errors.push(r.error);
      });
      job.convertedAt = Date.now();
      await saveJob(job);
      await setStatus({ kind: 'convert', state: 'running', phase: 'Updating Excel / Google Drive…' });
      const { result: out, warnings: w2 } = await exportExcel(job, settings, { isUpdate: true });
      await saveJob(job);
      const uniqueErrors = [...new Set(errors)].slice(0, 3).concat(w2);
      await setStatus({
        kind: 'convert',
        state: 'done',
        phase: `Converted ${ok} of ${job.products.length} link(s).`,
        warnings: uniqueErrors,
        links: out,
      });
      return { ok: true, converted: ok };
    } catch (e) {
      await setStatus({ kind: 'convert', state: 'error', phase: e.message });
      return { ok: false, error: e.message };
    }
  });
}

// ---------------- Toast inside a page (context menu results) ----------------
async function showInPage(tabId, title, link, error) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (t, l, err) => {
        const old = document.getElementById('__deal_toast');
        if (old) old.remove();
        const box = document.createElement('div');
        box.id = '__deal_toast';
        box.style.cssText = 'position:fixed;z-index:2147483647;right:20px;bottom:20px;max-width:420px;background:#111827;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:12px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.3)';
        const h = document.createElement('div');
        h.style.cssText = 'font-weight:600;margin-bottom:6px';
        h.textContent = t;
        const v = document.createElement('div');
        v.style.cssText = 'word-break:break-all;color:' + (err && !l ? '#fca5a5' : '#93c5fd');
        v.textContent = l || err;
        box.append(h, v);
        if (l && err) {
          const e = document.createElement('div');
          e.style.cssText = 'color:#fcd34d;margin-top:6px;font-size:12px';
          e.textContent = err;
          box.append(e);
        }
        document.body.appendChild(box);
        if (l) {
          const ta = document.createElement('textarea');
          ta.value = l;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (x) { /* ignore */ }
          ta.remove();
        }
        setTimeout(() => box.remove(), 9000);
      },
      args: [title, link || '', error || ''],
    });
  } catch (e) { /* page does not allow scripts (chrome:// etc.) */ }
}

// ---------------- Context menus ----------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'convert-link', title: 'Convert link to affiliate link', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'convert-page', title: 'Convert this page to affiliate link', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'scrape-page', title: 'Scrape products on this page → Excel', contexts: ['page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  if (info.menuItemId === 'scrape-page') {
    await showInPage(tab.id, 'Scraping started…', '', 'Open the extension to see progress.');
    const r = await runScrapeJob(tab.id).catch((e) => ({ ok: false, error: e.message }));
    await showInPage(tab.id, r.ok ? `Scraped ${r.count} product(s)` : 'Scrape failed', '', r.ok ? 'Excel ready. Open the extension for links.' : r.error);
    return;
  }
  const url = info.menuItemId === 'convert-link' ? info.linkUrl : tab.url;
  await showInPage(tab.id, 'Converting link…', '', url);
  const settings = await DealSettings.getSettings();
  const ctx = DealConverter.newContext();
  try {
    const r = await DealConverter.convertOne(url, settings, ctx);
    await showInPage(tab.id, r.affiliate ? `Affiliate link (${r.method}) – copied` : 'Conversion failed', r.affiliate, r.error);
  } finally {
    await DealConverter.closeContext(ctx);
  }
});

// ---------------- Messages from popup / options / floating button ----------------
// ---------------- Convert links from an uploaded Excel/CSV (convert-file.html) ----------------
// Uses a port so progress streams back row by row and the worker stays awake.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'bulk-convert') return;
  let cancelled = false;
  port.onDisconnect.addListener(() => { cancelled = true; });
  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'cancel') { cancelled = true; return; }
    if (msg.type !== 'start') return;
    try {
      await runExclusive(async () => {
        const settings = await DealSettings.getSettings();
        const ctx = DealConverter.newContext();
        const cache = {};
        const total = msg.items.length;
        await setStatus({ kind: 'convert', state: 'running', phase: `Converting uploaded file (0/${total})`, done: 0, total });
        try {
          for (let i = 0; i < total && !cancelled; i++) {
            const { key, url } = msg.items[i];
            if (!cache[url]) cache[url] = await DealConverter.convertOne(url, settings, ctx);
            try { port.postMessage({ type: 'progress', key, done: i + 1, total, result: cache[url] }); } catch (e) { cancelled = true; }
            await setStatus({ kind: 'convert', state: 'running', phase: `Converting uploaded file (${i + 1}/${total})`, done: i + 1, total });
          }
        } finally {
          await DealConverter.closeContext(ctx);
        }
        await setStatus({ kind: 'convert', state: 'done', phase: cancelled ? 'File conversion stopped.' : `Converted links in uploaded file (${total}).` });
      });
      try { port.postMessage({ type: 'done', cancelled }); } catch (e) { /* page closed */ }
    } catch (e) {
      try { port.postMessage({ type: 'error', error: e.message }); } catch (x) { /* page closed */ }
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'scrape': {
        const tabId = msg.tabId || (sender.tab && sender.tab.id);
        runScrapeJob(tabId); // progress is reported through jobStatus
        return { started: true };
      }
      case 'convertJob':
        runConvertJob();
        return { started: true };
      case 'convertOne': {
        const settings = await DealSettings.getSettings();
        const ctx = DealConverter.newContext();
        try { return await DealConverter.convertOne(msg.url, settings, ctx); } finally { await DealConverter.closeContext(ctx); }
      }
      case 'convertText': {
        const settings = await DealSettings.getSettings();
        return DealConverter.convertText(msg.text, settings);
      }
      case 'redownload': {
        const job = await getJob();
        if (!job) return { ok: false, error: 'Nothing scraped yet.' };
        const settings = await DealSettings.getSettings();
        await exportExcel(job, { ...settings, downloadExcelLocally: true }, { isUpdate: !!job.convertedAt, skipDrive: true });
        return { ok: true };
      }
      case 'getState': {
        const { jobStatus } = await chrome.storage.local.get('jobStatus');
        const job = await getJob();
        return {
          status: jobStatus || null,
          busy,
          job: job ? { store: job.store, count: job.products.length, createdAt: job.createdAt, convertedAt: job.convertedAt || null, sourceUrl: job.sourceUrl, excelLink: job.excelLink || '', sheetUrl: job.sheetUrl || '' } : null,
        };
      }
      case 'saveFileToDrive': {
        const settings = await DealSettings.getSettings();
        if (!settings.excelFolderLink) throw new Error('Add an Excel folder link in Settings first.');
        return DealGDrive.call(settings, 'uploadFile', { folder: settings.excelFolderLink, name: msg.name, mimeType: msg.mimeType, data: msg.data });
      }
      case 'hasExcelFolder': {
        const settings = await DealSettings.getSettings();
        return { ok: DealGDrive.configured(settings) && !!settings.excelFolderLink };
      }
      case 'testDrive': {
        const settings = await DealSettings.getSettings();
        return DealGDrive.call(settings, 'ping', {
          folder: settings.imagesFolderLink,
          sheet: settings.sheetLink,
          tab: settings.sheetTab,
          excelFolder: settings.excelFolderLink,
        });
      }
      case 'detectStore':
        return S.detectStore(msg.url);
      default:
        return { error: 'Unknown message ' + msg.type };
    }
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true; // async response
});
