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
    return { createdTabs: [], amazonTabs: {}, extrapeTab: null };
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

  // ---------------- ExtraPe ----------------
  async function extrapeWeb(url, settings, ctx) {
    if (!ctx.extrapeTab) {
      ctx.extrapeTab = await openBackgroundTab(ctx, settings.extrapeConverterUrl || 'https://www.extrape.com/');
      await sleep(2500); // let the web app render
    }
    // Re-inject every time: the page may have reloaded. The script ignores repeat injections.
    await chrome.scripting.executeScript({ target: { tabId: ctx.extrapeTab }, files: ['content/extrape_bridge.js'] });
    const cfg = {
      input: settings.extrapeInputSelector,
      button: settings.extrapeButtonSelector,
      output: settings.extrapeOutputSelector,
      timeoutMs: (Number(settings.extrapeTimeoutSec) || 25) * 1000,
    };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: ctx.extrapeTab },
      func: (u, c) => window.__extrapeConvert(u, c),
      args: [url, cfg],
    });
    const r = res && res.result;
    if (!r || !r.ok) throw new Error((r && r.error) || 'ExtraPe conversion failed');
    return r.link;
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
  async function convertOne(url, settings, ctx) {
    const original = String(url || '').trim();
    if (!/^https?:\/\//i.test(original)) return { original, affiliate: '', method: '', error: 'Not a link' };
    const expanded = await expand(original);
    const store = S.detectStore(expanded);
    const clean = S.cleanProductUrl(expanded);

    let templates = {};
    try { templates = JSON.parse(settings.storeTemplates || '{}'); } catch (e) { /* ignore bad JSON */ }
    if (templates[store.id]) {
      const link = templates[store.id].replace(/\{\{url\}\}/g, clean).replace(/\{\{url_enc\}\}/g, encodeURIComponent(clean));
      return { original, clean, store: store.name, affiliate: link, method: 'Template' };
    }

    if (store.id === 'amazon') {
      const long = amazonLongLink(expanded, settings.amazonTag);
      if (!settings.amazonUseSiteStripe) {
        return { original, clean, store: store.name, affiliate: long, method: settings.amazonTag ? 'Amazon tag' : 'No tag set' };
      }
      try {
        const short = await siteStripeShort(long, ctx);
        return { original, clean, store: store.name, affiliate: short, method: 'SiteStripe' };
      } catch (e) {
        return { original, clean, store: store.name, affiliate: long, method: settings.amazonTag ? 'Amazon tag' : 'No tag set', error: e.message };
      }
    }

    try {
      const link = settings.extrapeMode === 'api' ? await extrapeApi(clean, settings) : await extrapeWeb(clean, settings, ctx);
      return { original, clean, store: store.name, affiliate: link, method: 'ExtraPe' };
    } catch (e) {
      return { original, clean, store: store.name, affiliate: '', method: 'ExtraPe', error: e.message };
    }
  }

  async function convertMany(urls, settings, onProgress) {
    const ctx = newContext();
    const out = [];
    try {
      for (let i = 0; i < urls.length; i++) {
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

  g.DealConverter = { convertOne, convertMany, convertText, newContext, closeContext };
})(self);
