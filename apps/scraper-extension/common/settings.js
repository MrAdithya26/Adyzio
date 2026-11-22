// Default settings, shared by the background worker, popup and options page.
(function (g) {
  // ExtraPe's link-converter page. Built in, so conversion keeps working even if the Settings box is
  // blank, still has the old homepage address, or points to a page that no longer has the link box.
  const BUILT_IN_EXTRAPE_URL = 'https://www.extrape.com/link-converter';

  // How each store's links are converted (Settings → Conversion per store).
  //  auto     = Amazon → your tag + SiteStripe, every other store → ExtraPe
  //  extrape  = ExtraPe converter
  //  amazon   = Amazon tag + SiteStripe (Amazon links only)
  //  template = your own affiliate link pattern, e.g. {{url}}&affid=yourid
  //  page     = your own affiliate network's converter page (paste link → press Convert), like ExtraPe
  //  api      = the custom API set up in the ExtraPe section
  //  none     = do not convert, keep the clean store link
  const ROUTE_METHODS = ['auto', 'extrape', 'amazon', 'template', 'page', 'api', 'none'];

  const DEFAULTS = {
    // Google Drive / Sheets (through your Apps Script web app – no sign-in in the extension)
    scriptUrl: '',                 // Apps Script web app URL (…/exec)
    imagesFolderLink: '',          // "product images" Drive folder link
    sheetLink: '',                 // Google Sheet link (rows are appended here)
    sheetTab: '',                  // Tab name. Blank = first tab.
    excelFolderLink: '',           // Optional: also save each Excel file in this Drive folder
    accessKey: '',                 // Same key as the dashboard PIN (protects your Apps Script web app)
    autoQueue: false,              // Process links added on the dashboard / phone every 15 minutes
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
    extrapeConverterUrl: BUILT_IN_EXTRAPE_URL,
    extrapeInputSelector: '',
    extrapeButtonSelector: '',
    extrapeOutputSelector: '',
    extrapeTimeoutSec: 25,
    extrapeApiUrl: '',
    extrapeApiMethod: 'POST',
    extrapeApiHeaders: '{\n  "Content-Type": "application/json"\n}',
    extrapeApiBody: '{"url": "{{url}}"}',
    extrapeApiResultPath: '',      // e.g. data.shortUrl ; blank = first URL found in the response

    // Per-store conversion: {"flipkart": {"method": "template", "value": "{{url}}&affid=myid"}, ...}
    storeRoutes: '{}',
    // Older per-store templates, still honoured: {"flipkart": "{{url}}&affid=myid"}
    storeTemplates: '{}',

    // UI
    floatingButton: true,
  };

  function isOldExtrapeUrl(u) {
    const s = String(u || '').trim();
    return !s || /^https?:\/\/(www\.)?extrape\.com\/?(#.*)?$/i.test(s);
  }

  async function getSettings() {
    const stored = await chrome.storage.sync.get('settings');
    const s = { ...DEFAULTS, ...(stored.settings || {}) };
    if (isOldExtrapeUrl(s.extrapeConverterUrl)) s.extrapeConverterUrl = BUILT_IN_EXTRAPE_URL;
    return s;
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = { ...current, ...partial };
    await chrome.storage.sync.set({ settings: next });
    return next;
  }

  function parseRoutes(settings) {
    let routes = {};
    try { routes = JSON.parse(settings.storeRoutes || '{}') || {}; } catch (e) { routes = {}; }
    return routes;
  }

  g.DealSettings = { DEFAULTS, BUILT_IN_EXTRAPE_URL, ROUTE_METHODS, getSettings, saveSettings, parseRoutes };
})(typeof self !== 'undefined' ? self : window);
