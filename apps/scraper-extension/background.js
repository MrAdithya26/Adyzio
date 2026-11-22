// Background service worker: runs scrape/export and conversion jobs so they keep going after the popup closes.
importScripts(
  'lib/xlsx.full.min.js',
  'common/stores.js',
  'common/settings.js',
  'bg/gdrive.js',
  'bg/excel.js',
  'bg/converter.js',
  'bg/wishlink.js',
  'bg/finder.js'
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
let stopRequested = false; // set by the Stop button; every long loop checks it
let scrapeTabId = null;    // tab being scraped, so Stop can end its auto-scroll
const shouldStop = () => stopRequested;

async function runExclusive(fn) {
  if (busy) throw new Error('Another job is still running. Please wait for it to finish, or press Stop.');
  busy = true;
  stopRequested = false;
  try { return await fn(); } finally { busy = false; scrapeTabId = null; }
}

// Stop button: the running job finishes the current link, then saves/downloads everything done so far.
async function requestStop() {
  if (!busy) return { ok: false, error: 'Nothing is running.' };
  stopRequested = true;
  if (scrapeTabId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: scrapeTabId }, func: () => { window.__dealStop = true; } });
    } catch (e) { /* tab closed */ }
  }
  const { jobStatus } = await chrome.storage.local.get('jobStatus');
  await setStatus({ ...(jobStatus || {}), state: 'running', phase: 'Stopping… saving what is done so far' });
  return { ok: true };
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
  // Wishlink profiles are read through Wishlink's own API (every product, not just what is on screen).
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && DealWishlink.isProfileUrl(tab.url)) {
    return DealWishlink.scrapeProfile(tab.url, (st) => (stopRequested ? null : setStatus({ kind: 'scrape', state: 'running', ...st })), shouldStop);
  }
  scrapeTabId = tabId;
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
    if (stopRequested) return; // Stop: keep the rows, skip the remaining image uploads
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

async function exportExcel(job, settings, { isUpdate, skipDrive, suffix = '' }) {
  const wb = DealExcel.buildWorkbook(job.products, job.store);
  const base = `${slug(job.store, 20)}_${stamp(new Date(job.createdAt))}`;
  const result = {};
  const warnings = [];

  if (settings.downloadExcelLocally) {
    await chrome.downloads.download({
      url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + DealExcel.toBase64(wb),
      filename: `DealScraper/${base}${isUpdate ? '_affiliate' : ''}${suffix}.xlsx`,
      conflictAction: 'uniquify',
      saveAs: false,
    });
    result.downloaded = `${base}${isUpdate ? '_affiliate' : ''}${suffix}.xlsx`;
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
          jobId: job.id,
        });
        job.sheetUrl = r.sheetUrl;
      } else {
        await DealGDrive.call(settings, 'updateAffiliate', {
          sheet: settings.sheetLink,
          tab: settings.sheetTab,
          header: DealExcel.HEADER,
          // Only rows a conversion was tried for (after Stop, the rest stay "Scraped").
          items: job.products.filter((p) => p.affiliateLink || p.convertTried)
            .map((p) => ({ link: p.link, affiliate: p.affiliateLink, method: p.affiliateMethod })),
        });
      }
      result.sheetLink = job.sheetUrl || settings.sheetLink;
    } catch (e) {
      warnings.push('Google Sheet not updated: ' + e.message);
    }
  }
  return { result, warnings };
}

// ---------------- Google Sheet: Job Log + phone Queue ----------------
const sheetReady = (settings) => DealGDrive.configured(settings) && !!settings.sheetLink;
const sheetCall = (settings, action, payload) => DealGDrive.call(settings, action, { sheet: settings.sheetLink, tab: settings.sheetTab, ...payload });

// One line in the sheet's "Job Log" tab (shown under Activity on the dashboard). Never fails the job.
async function logJob(settings, job, extra = {}) {
  if (!sheetReady(settings)) return;
  const products = job.products || [];
  try {
    await sheetCall(settings, 'logJob', {
      job: {
        id: job.id,
        type: extra.type || '',
        source: job.sourceUrl || '',
        store: job.store || '',
        products: extra.products != null ? extra.products : products.length,
        converted: extra.converted != null ? extra.converted : products.filter((p) => p.affiliateLink).length,
        failed: extra.failed != null ? extra.failed : products.filter((p) => p.convertTried && !p.affiliateLink).length,
        stopped: !!extra.stopped,
        excel: job.excelLink || extra.file || '',
        note: extra.note || '',
      },
    });
  } catch (e) { /* the log is optional */ }
}

function waitTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs || 45000);
    function done() { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(); }
    function listener(id, info) { if (id === tabId && info.status === 'complete') done(); }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') done(); }).catch(done);
  });
}

// Opens a link in a background tab, scrapes it like "Scrape this page", closes the tab.
async function scrapeUrlInBackground(url, settings) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitTabComplete(tab.id, 45000);
    await new Promise((r) => setTimeout(r, 2500)); // let the store's page render its products
    return await scrapeTab(tab.id, settings);
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (e) { /* already closed */ }
  }
}

// Processes the links added on the dashboard / phone (sheet "Queue" tab), one job per link.
async function runQueueJob() {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    const kind = 'scrape';
    try {
      if (!sheetReady(settings)) throw new Error('Set the Apps Script URL and Google Sheet link in Settings first.');
      await setStatus({ kind, state: 'running', phase: 'Reading the phone queue…' });
      const { items = [] } = await sheetCall(settings, 'getQueue', {});
      if (!items.length) {
        await setStatus({ kind, state: 'done', phase: 'The phone queue is empty.' });
        return { ok: true, processed: 0 };
      }
      const summary = [];
      const warnings = [];
      let lastOut = null;
      for (let i = 0; i < items.length; i++) {
        if (stopRequested) break;
        const it = items[i];
        const label = `Queue ${i + 1}/${items.length}`;
        await sheetCall(settings, 'updateQueue', { id: it.id, status: 'Working' }).catch(() => {});
        try {
          const status = (st) => (stopRequested ? null : setStatus({ kind, state: 'running', ...st, phase: `${label}: ${st.phase}` }));
          const link = String(it.link || '').trim();
          let page;
          if (DealWishlink.isProfileUrl(link) || !/^https?:\/\//i.test(link)) {
            page = await DealWishlink.scrapeProfile(link, status, shouldStop);
          } else {
            await status({ phase: `Opening ${S.hostOf(link)} in a background tab…` });
            page = await scrapeUrlInBackground(link, settings);
          }
          if (!page || !page.products || !page.products.length) throw new Error('No products found on this page.');
          const scrapeStopped = stopRequested || !!page.stopped;
          const job = await buildJob(page);
          const r1 = await exportScrapedJob(job, settings, {
            downloadLocally: settings.downloadExcelLocally && (!it.convert || scrapeStopped),
            suffix: scrapeStopped ? '_partial' : '',
          });
          warnings.push(...r1.warnings.map((w) => `${label}: ${w}`));
          lastOut = r1.out;
          let result = `${job.products.length} products`;
          let stopped = scrapeStopped;
          if (!scrapeStopped && it.convert) {
            const r2 = await convertJobCore(job, settings, label);
            warnings.push(...r2.uniqueErrors.map((w) => `${label}: ${w}`));
            lastOut = r2.out;
            stopped = r2.stopped;
            result += `, ${r2.ok} affiliate links`;
          }
          await logJob(settings, job, { type: it.convert ? 'Phone queue + convert' : 'Phone queue', stopped, file: lastOut && lastOut.downloaded, note: it.note });
          await sheetCall(settings, 'updateQueue', { id: it.id, status: stopped ? 'Stopped' : 'Done', result: stopped ? `Stopped – ${result}` : result }).catch(() => {});
          summary.push(`${S.hostOf(link) || link}: ${result}`);
        } catch (e) {
          warnings.push(`${label}: ${e.message}`);
          await sheetCall(settings, 'updateQueue', { id: it.id, status: 'Failed', result: e.message }).catch(() => {});
        }
      }
      await setStatus({
        kind,
        state: stopRequested ? 'stopped' : 'done',
        phase: `${stopRequested ? 'Stopped' : 'Phone queue done'} – ${summary.length ? summary.join('; ') : 'nothing exported'}.`,
        warnings: [...new Set(warnings)].slice(0, 8),
        links: lastOut,
      });
      return { ok: true, processed: summary.length };
    } catch (e) {
      await setStatus({ kind, state: 'error', phase: e.message });
      return { ok: false, error: e.message };
    }
  });
}

// Optional: check the phone queue every 15 minutes (Settings → "Process the phone queue automatically").
try { chrome.alarms.create('phoneQueue', { periodInMinutes: 15 }); } catch (e) { /* no alarms permission */ }
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (a) => {
    if (a.name !== 'phoneQueue' || busy) return;
    const settings = await DealSettings.getSettings();
    if (!settings.autoQueue || !sheetReady(settings)) return;
    try {
      const { items = [] } = await sheetCall(settings, 'getQueue', {});
      if (items.length && !busy) runQueueJob();
    } catch (e) { /* try again next time */ }
  });
}

// Turns a scraped page ({url, store, products, ...}) into a job with all template columns.
async function buildJob(page) {
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
      sourcePage: p.wishlinkLink || page.url,
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
  return job;
}

// Saves images to Drive, then writes Excel + Google Sheet rows for a freshly scraped job.
async function exportScrapedJob(job, settings, { downloadLocally, suffix = '' } = {}) {
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
  const exportSettings = downloadLocally === false ? { ...settings, downloadExcelLocally: false } : settings;
  const { result: out, warnings: w2 } = await exportExcel(job, exportSettings, { isUpdate: false, suffix });
  warnings.push(...w2);
  await saveJob(job);
  return { out, warnings };
}

async function runScrapeJob(tabId) {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    try {
      await setStatus({ kind: 'scrape', state: 'running', phase: settings.autoScroll ? 'Scrolling and reading the page…' : 'Reading the page…' });
      const page = await scrapeTab(tabId, settings);
      if (!page.products.length) throw new Error('No products found on this page.');
      const stopped = stopRequested || !!page.stopped;
      const job = await buildJob(page);
      const { out, warnings } = await exportScrapedJob(job, settings, { suffix: stopped ? '_partial' : '' });
      await logJob(settings, job, { type: 'Scrape', stopped, file: out && out.downloaded });
      await setStatus({
        kind: 'scrape',
        state: stopped ? 'stopped' : 'done',
        phase: stopped
          ? `Stopped – saved the ${job.products.length} product(s) scraped so far from ${job.store}.`
          : `Scraped ${job.products.length} product(s) from ${job.store}.`,
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

// Converts the job's links that have no affiliate link yet (so a stopped job can be resumed),
// then writes the _affiliate Excel / fills the Sheet. After Stop, the Excel holds only the rows done so far.
async function convertJobCore(job, settings, label) {
  const prefix = label ? `${label}: ` : '';
  const total = job.products.length;
  const todo = job.products.map((p, i) => i).filter((i) => !job.products[i].affiliateLink);
  const before = total - todo.length;
  await setStatus({ kind: 'convert', state: 'running', phase: `${prefix}Converting links…`, done: before, total });
  const results = await DealConverter.convertMany(todo.map((i) => job.products[i].link), settings, async (done, n, r) => {
    if (!stopRequested) await setStatus({ kind: 'convert', state: 'running', phase: `${prefix}Converting links (${before + done}/${total}) – ${r.store || ''}`, done: before + done, total });
  }, shouldStop);
  const errors = [];
  const notes = [];
  results.forEach((r, k) => {
    const p = job.products[todo[k]];
    p.affiliateLink = r.affiliate || '';
    p.affiliateMethod = r.error ? `${r.method} (${r.error})`.slice(0, 250) : r.method;
    p.convertTried = true;
    if (r.error) errors.push(r.error);
    if (r.note) notes.push(r.note);
  });
  const stopped = results.length < todo.length;
  const ok = job.products.filter((p) => p.affiliateLink).length;
  if (!stopped) job.convertedAt = Date.now();
  await saveJob(job);
  await setStatus({ kind: 'convert', state: 'running', phase: `${prefix}Updating Excel / Google Drive…` });
  const exportJob = stopped ? { ...job, products: job.products.filter((p) => p.affiliateLink || p.convertTried) } : job;
  const { result: out, warnings: w2 } = await exportExcel(exportJob, settings, { isUpdate: true, suffix: stopped ? '_partial' : '' });
  await saveJob(job);
  const uniqueErrors = [...new Set(notes)].concat([...new Set(errors)].slice(0, 3), w2);
  return { ok, out, uniqueErrors, stopped, rows: exportJob.products.length, total };
}

async function runConvertJob() {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    const job = await getJob();
    try {
      if (!job || !job.products.length) throw new Error('Scrape a page first (Option 1), then convert its links.');
      // Everything already converted → convert all again (e.g. after changing settings).
      if (job.products.every((p) => p.affiliateLink)) {
        job.products.forEach((p) => { p.affiliateLink = ''; p.affiliateMethod = ''; p.convertTried = false; });
      }
      const { ok, out, uniqueErrors, stopped, rows } = await convertJobCore(job, settings);
      await logJob(settings, job, { type: 'Convert', stopped, file: out && out.downloaded });
      await setStatus({
        kind: 'convert',
        state: stopped ? 'stopped' : 'done',
        phase: stopped
          ? `Stopped – ${ok} of ${job.products.length} link(s) converted. Excel with these ${rows} row(s) downloaded. Press "Convert remaining" to continue.`
          : `Converted ${ok} of ${job.products.length} link(s).`,
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

// ---------------- Wishlink profiles ----------------
// inputs: profile links or usernames (one Excel per profile).
// withAffiliate: also convert every product link (Amazon SiteStripe / ExtraPe) and export the _affiliate Excel.
async function runWishlinkJob(inputs, withAffiliate) {
  return runExclusive(async () => {
    const settings = await DealSettings.getSettings();
    const list = [...new Set((inputs || []).map((x) => DealWishlink.usernameFrom(x)).filter(Boolean))];
    const kind = withAffiliate ? 'convert' : 'scrape';
    try {
      if (!list.length) throw new Error('Paste a Wishlink profile link, e.g. https://www.wishlink.com/username');
      const summary = [];
      const warnings = [];
      let lastOut = null;
      for (let i = 0; i < list.length; i++) {
        if (stopRequested) break;
        const username = list[i];
        const label = list.length > 1 ? `@${username} (${i + 1}/${list.length})` : `@${username}`;
        try {
          const page = await DealWishlink.scrapeProfile(username, (st) => (stopRequested ? null : setStatus({
            kind, state: 'running', ...st, phase: list.length > 1 ? `${label}: ${st.phase}` : st.phase,
          })), shouldStop);
          const scrapeStopped = stopRequested || !!page.stopped;
          const job = await buildJob(page);
          // Stopped while reading: download what was read (without conversion).
          const r1 = await exportScrapedJob(job, settings, { downloadLocally: !withAffiliate || scrapeStopped, suffix: scrapeStopped ? '_partial' : '' });
          warnings.push(...r1.warnings.map((w) => `${label}: ${w}`));
          lastOut = r1.out;
          if (scrapeStopped || !withAffiliate) await logJob(settings, job, { type: 'Wishlink export', stopped: scrapeStopped, file: r1.out && r1.out.downloaded });
          if (scrapeStopped) {
            summary.push(`@${username}: stopped after ${job.products.length} of ${page.totalOnProfile || '?'} products`);
          } else if (withAffiliate) {
            const r2 = await convertJobCore(job, settings, label);
            warnings.push(...r2.uniqueErrors.map((w) => `${label}: ${w}`));
            lastOut = r2.out;
            await logJob(settings, job, { type: 'Wishlink export + convert', stopped: r2.stopped, file: r2.out && r2.out.downloaded });
            summary.push(r2.stopped
              ? `@${username}: stopped – ${r2.ok} of ${job.products.length} links converted (Excel has the ${r2.rows} rows done)`
              : `@${username}: ${job.products.length} products, ${r2.ok} affiliate links`);
          } else {
            summary.push(`@${username}: ${job.products.length} products`);
          }
        } catch (e) {
          warnings.push(`${label}: ${e.message}`);
        }
      }
      if (!summary.length) throw new Error(warnings.join(' · ') || 'Nothing exported.');
      await setStatus({
        kind,
        state: stopRequested ? 'stopped' : 'done',
        phase: `${stopRequested ? 'Stopped' : 'Wishlink export done'} – ${summary.join('; ')}.`,
        warnings: [...new Set(warnings)].slice(0, 8),
        links: lastOut,
      });
      return { ok: true, profiles: summary.length };
    } catch (e) {
      await setStatus({ kind, state: 'error', phase: e.message });
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
          for (let i = 0; i < total && !cancelled && !stopRequested; i++) {
            const { key, url } = msg.items[i];
            if (!cache[url]) cache[url] = await DealConverter.convertOne(url, settings, ctx);
            try { port.postMessage({ type: 'progress', key, done: i + 1, total, result: cache[url] }); } catch (e) { cancelled = true; }
            await setStatus({ kind: 'convert', state: 'running', phase: `Converting uploaded file (${i + 1}/${total})`, done: i + 1, total });
          }
        } finally {
          await DealConverter.closeContext(ctx);
        }
        const vals = Object.values(cache);
        await logJob(settings, { id: hash(String(Date.now())), sourceUrl: '', store: msg.fileName || 'Uploaded file' }, {
          type: 'Uploaded file', stopped: cancelled || stopRequested, products: vals.length,
          converted: vals.filter((r) => r.affiliate).length, failed: vals.filter((r) => !r.affiliate).length,
        });
        await setStatus({ kind: 'convert', state: cancelled || stopRequested ? 'stopped' : 'done', phase: cancelled || stopRequested ? 'File conversion stopped. The file with the links converted so far was downloaded.' : `Converted links in uploaded file (${total}).` });
      });
      try { port.postMessage({ type: 'done', cancelled: cancelled || stopRequested }); } catch (e) { /* page closed */ }
    } catch (e) {
      try { port.postMessage({ type: 'error', error: e.message }); } catch (x) { /* page closed */ }
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (String(msg.type || '').startsWith('finder')) {
      return DealFinder.handle(msg, sender, { getSettings: () => DealSettings.getSettings(), converter: DealConverter });
    }
    switch (msg.type) {
      case 'scrape': {
        const tabId = msg.tabId || (sender.tab && sender.tab.id);
        runScrapeJob(tabId); // progress is reported through jobStatus
        return { started: true };
      }
      case 'convertJob':
        runConvertJob();
        return { started: true };
      case 'stopJob':
        return requestStop();
      case 'processQueue':
        runQueueJob(); // progress is reported through jobStatus
        return { started: true };
      case 'queueInfo': {
        const settings = await DealSettings.getSettings();
        if (!sheetReady(settings)) return { ready: false, count: 0 };
        const { items = [] } = await sheetCall(settings, 'getQueue', {});
        return { ready: true, count: items.length, auto: !!settings.autoQueue };
      }
      case 'wishlinkExport':
        runWishlinkJob(msg.profiles, !!msg.withAffiliate); // progress is reported through jobStatus
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
          job: job ? { store: job.store, count: job.products.length, converted: job.products.filter((p) => p.affiliateLink).length, createdAt: job.createdAt, convertedAt: job.convertedAt || null, sourceUrl: job.sourceUrl, excelLink: job.excelLink || '', sheetUrl: job.sheetUrl || '' } : null,
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
