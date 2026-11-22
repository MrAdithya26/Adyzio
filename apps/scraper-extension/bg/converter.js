// Affiliate link conversion.
//  - Amazon: add your Associates tag, then shorten to amzn.to via SiteStripe (your logged-in Associates session).
//  - Every other store: ExtraPe, either by driving the ExtraPe converter page or via a custom API endpoint.
//  - Optional per-store templates override both.
(function (g) {
  const S = self.DealStores;

  const AMAZON_MARKETPLACE = {
    'amazon.in': '44571', 'amazon.com': '1', 'amazon.co.uk': '3', 'amazon.de': '4', 'amazon.fr': '5',
    'amazon.co.jp': '6', 'amazon.ca': '7', 'amazon.it': '35691', 'amazon.es': '44551', 'amazon.ae': '338801',
    'amazon.com.au': '111172',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function newContext() {
    return { createdTabs: [], amazonTabs: {}, pageTabs: {}, extrapeFallback: false };
  }

  async function closeContext(ctx) {
    for (const id of ctx.createdTabs) {
      try { await chrome.tabs.remove(id); } catch (e) { /* already closed */ }
    }
  }

  function waitForTab(tabId, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(done, timeoutMs || 30000);
      function done() {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
      function listener(id, info) {
        if (id === tabId && info.status === 'complete') done();
      }
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') done(); }).catch(done);
    });
  }

  async function openBackgroundTab(ctx, url) {
    const tab = await chrome.tabs.create({ url, active: false });
    ctx.createdTabs.push(tab.id);
    await waitForTab(tab.id, 45000);
    return tab.id;
  }

  async function expand(url) {
    if (!S.isShortLink(url)) return url;
    try {
      const r = await fetch(url, { redirect: 'follow', credentials: 'omit' });
      return r.url || url;
    } catch (e) {
      return url;
    }
  }

  function firstUrl(text, exclude) {
    const urls = String(text || '').match(/https?:\/\/[^\s"'<>\\)]+/g) || [];
    return urls.find((u) => !exclude || (u !== exclude && S.cleanProductUrl(u) !== S.cleanProductUrl(exclude))) || '';
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
  }

  // ---------------- Amazon ----------------
  function amazonLongLink(url, tag) {
    const u = new URL(S.cleanProductUrl(url));
    if (tag) u.searchParams.set('tag', tag.trim());
    return u.toString();
  }

  async function siteStripeShort(longUrl, ctx) {
    const u = new URL(longUrl);
    const host = u.hostname;
    const mid = AMAZON_MARKETPLACE[host.replace(/^www\./, '')] || '44571';
    const endpoint = `https://${host}/associates/sitestripe/getShortUrl?longUrl=${encodeURIComponent(longUrl)}&marketplaceId=${mid}`;
    const parse = (text) => {
      try {
        const j = JSON.parse(text);
        if (j && (j.shortUrl || j.short_url)) return j.shortUrl || j.short_url;
      } catch (e) { /* not JSON = not logged in */ }
      return '';
    };

    // 1) Directly from the extension (uses your Amazon cookies).
    try {
      const r = await fetch(endpoint, { credentials: 'include' });
      if (r.ok) {
        const short = parse(await r.text());
        if (short) return short;
      }
    } catch (e) { /* fall through */ }

    // 2) From inside an Amazon tab, where the request is first-party.
    let tabId = ctx.amazonTabs[host];
    if (!tabId) {
      const existing = await chrome.tabs.query({ url: `https://${host}/*` });
      tabId = existing.length ? existing[0].id : await openBackgroundTab(ctx, `https://${host}/`);
      ctx.amazonTabs[host] = tabId;
    }
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (ep) => {
        try {
          const r = await fetch(ep, { credentials: 'include' });
          return await r.text();
        } catch (e) {
          return '';
        }
      },
      args: [endpoint],
    });
    const short = parse(res && res.result);
    if (short) return short;
    throw new Error('SiteStripe short link failed. Log in to Amazon Associates in Chrome and make sure SiteStripe is on.');
  }

  // ---------------- Converter pages (ExtraPe or your own affiliate network) ----------------
  // Opens the converter page once per job in a background tab, pastes the link, presses Convert and reads the result.
  async function converterPage(url, pageUrl, sel, settings, ctx) {
    ctx.pageTabs = ctx.pageTabs || {};
    if (!ctx.pageTabs[pageUrl]) {
      ctx.pageTabs[pageUrl] = await openBackgroundTab(ctx, pageUrl);
      await sleep(2500); // let the web app render
    }
    const tabId = ctx.pageTabs[pageUrl];
    // Re-inject every time: the page may have reloaded. The script ignores repeat injections.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/extrape_bridge.js'] });
    const cfg = {
      input: sel.input || '',
      button: sel.button || '',
      output: sel.output || '',
      timeoutMs: (Number(settings.extrapeTimeoutSec) || 25) * 1000,
    };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (u, c) => window.__extrapeConvert(u, c),
      args: [url, cfg],
    });
    const r = res && res.result;
    if (!r || !r.ok) {
      const err = new Error((r && r.error) || 'Converter page did not return a link');
      err.noLinkBox = !!(r && r.noLinkBox);
      throw err;
    }
    return r.link;
  }

  async function extrapeWeb(url, settings, ctx) {
    const builtIn = DealSettings.BUILT_IN_EXTRAPE_URL;
    const configured = (settings.extrapeConverterUrl || '').trim() || builtIn;
    const sel = { input: settings.extrapeInputSelector, button: settings.extrapeButtonSelector, output: settings.extrapeOutputSelector };
    // After one failure on your saved address, the rest of the job goes straight to the built-in page.
    const pageUrl = ctx.extrapeFallback ? builtIn : configured;
    try {
      return await converterPage(url, pageUrl, ctx.extrapeFallback ? {} : sel, settings, ctx);
    } catch (e) {
      if (!e.noLinkBox || pageUrl === builtIn) throw e;
      ctx.extrapeFallback = true; // saved address is outdated: use the built-in ExtraPe converter
      return converterPage(url, builtIn, {}, settings, ctx);
    }
  }

  async function extrapeApi(url, settings) {
    if (!settings.extrapeApiUrl) throw new Error('ExtraPe API URL is not set (Settings → ExtraPe).');
    const fill = (t) => String(t || '').replace(/\{\{url\}\}/g, url).replace(/\{\{url_enc\}\}/g, encodeURIComponent(url));
    let headers = {};
    try { headers = JSON.parse(settings.extrapeApiHeaders || '{}'); } catch (e) { throw new Error('ExtraPe API headers are not valid JSON.'); }
    Object.keys(headers).forEach((k) => { headers[k] = fill(headers[k]); });
    const method = (settings.extrapeApiMethod || 'POST').toUpperCase();
    const r = await fetch(fill(settings.extrapeApiUrl), {
      method,
      headers,
      body: method === 'GET' ? undefined : fill(settings.extrapeApiBody),
      credentials: 'include',
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`ExtraPe API ${r.status}: ${text.slice(0, 200)}`);
    if (settings.extrapeApiResultPath) {
      try {
        const v = getPath(JSON.parse(text), settings.extrapeApiResultPath.trim());
        if (v) return String(v);
      } catch (e) { /* fall back to scanning */ }
    }
    const found = firstUrl(text, url);
    if (!found) throw new Error('ExtraPe API response had no link: ' + text.slice(0, 200));
    return found;
  }

  // ---------------- Main ----------------
  function routeFor(storeId, settings) {
    const routes = DealSettings.parseRoutes(settings);
    const r = routes[storeId]; // unknown shops use the "other" row (detectStore id 'other')
    if (r && r.method && r.method !== 'auto') return r;
    // Older "per-store templates" setting.
    let templates = {};
    try { templates = JSON.parse(settings.storeTemplates || '{}'); } catch (e) { /* ignore bad JSON */ }
    if (templates[storeId]) return { method: 'template', value: templates[storeId] };
    return { method: storeId === 'amazon' ? 'amazon' : 'extrape' };
  }

  async function convertOne(url, settings, ctx) {
    const original = String(url || '').trim();
    if (!/^https?:\/\//i.test(original)) return { original, affiliate: '', method: '', error: 'Not a link' };
    const expanded = await expand(original);
    const store = S.detectStore(expanded);
    const clean = S.cleanProductUrl(expanded);
    const route = routeFor(store.id, settings);
    const base = { original, clean, store: store.name };

    if (route.method === 'none') return { ...base, affiliate: clean, method: 'Not converted (setting)' };

    if (route.method === 'template') {
      if (!route.value) return { ...base, affiliate: '', method: 'Template', error: `No template set for ${store.name}` };
      const link = String(route.value).replace(/\{\{url\}\}/g, clean).replace(/\{\{url_enc\}\}/g, encodeURIComponent(clean));
      return { ...base, affiliate: link, method: 'Template' };
    }

    if (route.method === 'amazon' && store.id === 'amazon') {
      const long = amazonLongLink(expanded, settings.amazonTag);
      if (!settings.amazonUseSiteStripe) {
        return { ...base, affiliate: long, method: settings.amazonTag ? 'Amazon tag' : 'No tag set' };
      }
      try {
        const short = await siteStripeShort(long, ctx);
        return { ...base, affiliate: short, method: 'SiteStripe' };
      } catch (e) {
        return { ...base, affiliate: long, method: settings.amazonTag ? 'Amazon tag' : 'No tag set', error: e.message };
      }
    }

    if (route.method === 'page') {
      if (!route.value) return { ...base, affiliate: '', method: 'Converter page', error: `No converter page set for ${store.name}` };
      try {
        const link = await converterPage(clean, route.value, { input: route.input, button: route.button, output: route.output }, settings, ctx);
        return { ...base, affiliate: link, method: 'Converter page' };
      } catch (e) {
        return { ...base, affiliate: '', method: 'Converter page', error: e.message };
      }
    }

    // ExtraPe (website or API).
    const useApi = route.method === 'api' || (route.method !== 'extrape' && settings.extrapeMode === 'api');
    try {
      const link = useApi ? await extrapeApi(clean, settings) : await extrapeWeb(clean, settings, ctx);
      const note = !useApi && ctx.extrapeFallback ? 'Used the built-in ExtraPe converter (the address in Settings did not work)' : undefined;
      return { ...base, affiliate: link, method: useApi ? 'ExtraPe API' : 'ExtraPe', ...(note ? { note } : {}) };
    } catch (e) {
      return { ...base, affiliate: '', method: 'ExtraPe', error: e.message };
    }
  }

  // shouldStop(): return true to stop early. Returns the results so far (may be shorter than urls).
  async function convertMany(urls, settings, onProgress, shouldStop) {
    const ctx = newContext();
    const out = [];
    try {
      for (let i = 0; i < urls.length; i++) {
        if (shouldStop && shouldStop()) break;
        out.push(await convertOne(urls[i], settings, ctx));
        if (onProgress) await onProgress(i + 1, urls.length, out[i]);
      }
    } finally {
      await closeContext(ctx);
    }
    return out;
  }

  // Replaces every link inside a block of text (deal posts, WhatsApp/Telegram messages).
  async function convertText(text, settings, onProgress) {
    const urls = [...new Set(String(text).match(/https?:\/\/[^\s"'<>]+/g) || [])];
    const results = await convertMany(urls, settings, onProgress);
    let out = String(text);
    results.forEach((r) => { if (r.affiliate) out = out.split(r.original).join(r.affiliate); });
    return { text: out, results };
  }

  g.DealConverter = { convertOne, convertMany, convertText, newContext, closeContext, routeFor };
})(self);
