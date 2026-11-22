// Default settings, shared by the background worker, popup and options page.
(function (g) {
  const DEFAULTS = {
    // Google Drive / Sheets (through your Apps Script web app – no sign-in in the extension)
    scriptUrl: '',                 // Apps Script web app URL (…/exec)
    imagesFolderLink: '',          // "product images" Drive folder link
    sheetLink: '',                 // Google Sheet link (rows are appended here)
    sheetTab: '',                  // Tab name. Blank = first tab.
    excelFolderLink: '',           // Optional: also save each Excel file in this Drive folder
    uploadImages: true,
    downloadExcelLocally: true,

    // Scraping
    autoScroll: true,
    maxScrolls: 20,
    highResImages: true,

    // Amazon (SiteStripe)
    amazonTag: '',                 // Your Associates tracking id, e.g. mytag-21
    amazonUseSiteStripe: true,     // Short amzn.to link via SiteStripe (needs Associates login in Chrome)

    // ExtraPe (all other stores)
    extrapeMode: 'web',            // 'web' = drive the ExtraPe converter page, 'api' = call an endpoint
    extrapeConverterUrl: 'https://www.extrape.com/',
    extrapeInputSelector: '',
    extrapeButtonSelector: '',
    extrapeOutputSelector: '',
    extrapeTimeoutSec: 25,
    extrapeApiUrl: '',
    extrapeApiMethod: 'POST',
    extrapeApiHeaders: '{\n  "Content-Type": "application/json"\n}',
    extrapeApiBody: '{"url": "{{url}}"}',
    extrapeApiResultPath: '',      // e.g. data.shortUrl ; blank = first URL found in the response

    // Optional per-store link templates, e.g. {"flipkart": "{{url}}&affid=myid"}
    storeTemplates: '{}',

    // UI
    floatingButton: true,
  };

  async function getSettings() {
    const stored = await chrome.storage.sync.get('settings');
    return { ...DEFAULTS, ...(stored.settings || {}) };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = { ...current, ...partial };
    await chrome.storage.sync.set({ settings: next });
    return next;
  }

  g.DealSettings = { DEFAULTS, getSettings, saveSettings };
})(typeof self !== 'undefined' ? self : window);
