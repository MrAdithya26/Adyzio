// Wishlink creator profiles (wishlink.com/<username>).
// Reads every product through Wishlink's public storefront API (the same one the profile page uses),
// then follows each Wishlink share link to the real store page so the row holds the store's own product link.
(function (g) {
  const S = self.DealStores;
  const API = 'https://api.wishlink.com/api/store';
  const RESERVED = new Set(['w', 'share', 'api', '_next', 'cdn-cgi', 'login', 'signup', 'search', 'brand', 'brands', 'about', 'blog', 'blogs']);
  const PAGE_SIZE = 50;
  const MAX_PAGES = 200;

  // Anonymous visitor id. Wishlink's API needs one; the site creates a random one for every visitor.
  function visitorId() {
    const rnd = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return `${Date.now()}-${rnd}`;
  }

  // "https://www.wishlink.com/deekshakhurana/products" → "deekshakhurana". Also accepts "@name" or "name".
  function usernameFrom(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    // Bare username: "@name" or "name" (no slash, not a domain).
    if (/^@?[\w.-]+$/.test(s) && !/\.(com|in|me|co|net|org)$/i.test(s)) return s.replace(/^@/, '');
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return ''; }
    if (!/(^|\.)wishlink\.com$/i.test(u.hostname)) return '';
    const first = decodeURIComponent(u.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '');
    if (!first || RESERVED.has(first.toLowerCase())) return '';
    return first;
  }

  function isProfileUrl(url) {
    return !!usernameFrom(url) && /wishlink\.com/i.test(String(url));
  }

  async function api(path, params, wid) {
    const qs = new URLSearchParams({ ...params, sourceApp: 'STOREFRONT' });
    const r = await fetch(`${API}/${path}?${qs}`, {
      headers: { wishlinkId: wid, gaId: '', 'Content-Type': 'application/json' },
      credentials: 'omit',
    });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!r.ok || !j) throw new Error(`Wishlink ${path} failed (${r.status}): ${(j && j.message) || text.slice(0, 150)}`);
    return j.data;
  }

  async function creatorInfo(username, wid) {
    try { return await api('getCreatorInfo', { username }, wid); } catch (e) { return null; }
  }

  async function fetchAllProducts(username, wid, onProgress, shouldStop) {
    const seen = new Map();
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (shouldStop()) break;
      const d = await api('getCreatorContent', { page, limit: PAGE_SIZE, tab: 'PRODUCTS', username }, wid);
      const items = (d && d.productContent) || [];
      items.forEach((p) => { if (p && p.id != null && !seen.has(p.id)) seen.set(p.id, p); });
      if (onProgress) await onProgress(seen.size);
      if (!items.length || d.done) break;
    }
    return [...seen.values()];
  }

  // Remove Wishlink / creator tracking from a store link, keep the product itself.
  function cleanStoreLink(url) {
    let out = S.cleanProductUrl(url);
    try {
      const u = new URL(out);
      [...u.searchParams.keys()].forEach((k) => {
        const v = u.searchParams.get(k) || '';
        if (/^(utm_\w+|af_\w+|atgSessionId|clickid|affiliate_id|shared|is_retargeting|deep_link_value|gad_\w+|gbraid|wbraid|ptype|ref|tag)$/i.test(k) || /wishlink/i.test(v)) {
          u.searchParams.delete(k);
        }
      });
      out = u.toString();
    } catch (e) { /* keep as is */ }
    return out;
  }

  // AppsFlyer/OneLink pages carry the web link in a parameter.
  function fromOneLink(url) {
    try {
      const u = new URL(url);
      if (!/onelink\.me$|app\.link$|sng\.link$/i.test(u.hostname)) return '';
      for (const k of ['af_web_dp', 'af_android_url', 'af_ios_url', '_dl', 'deep_link_value']) {
        const v = u.searchParams.get(k);
        if (v && /^https?:\/\//i.test(v)) return v;
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  // Follows a wishlink.com/share/... link to the store page. Only headers are read; the page body is dropped.
  async function resolveShare(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { redirect: 'follow', credentials: 'omit', signal: ctl.signal });
      const final = r.url || url;
      try { ctl.abort(); } catch (e) { /* body no longer needed */ }
      const web = fromOneLink(final);
      if (web) return web;
      if (/(^|\.)wishlink\.com$/i.test(S.hostOf(final))) throw new Error('did not redirect to a store');
      return final;
    } finally {
      clearTimeout(timer);
    }
  }

  function titleCase(slug) {
    return String(slug || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const JUNK_BRAND = /^(null|shopify|www\..*|.*\.(com|in))$/i;

  // One Wishlink product → one row in the deals template.
  function toProduct(p, resolvedLink, resolveError) {
    const storeFromLink = resolvedLink ? S.detectStore(resolvedLink) : null;
    const storeName = storeFromLink && storeFromLink.id !== 'other' ? storeFromLink.name
      : (p.brand || (storeFromLink && storeFromLink.name) || 'Wishlink');
    const plat = String(p.productBrand || p.platform || '').trim();
    const brand = plat && !JUNK_BRAND.test(plat) && plat.toLowerCase().replace(/\W/g, '') !== String(storeName).toLowerCase().replace(/\W/g, '') ? plat : '';
    const price = Number(p.price) > 0 ? Number(p.price) : '';
    const mrp = Number(p.mrp) > 0 ? Number(p.mrp) : '';
    const discount = price && mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : '';
    const image = String(p.imageUrl || p.thumbnailUrl || '').replace(/\?width=\d+$/, '');
    const extra = [];
    if (p.couponCode) extra.push(`Coupon: ${p.couponCode}`);
    if (p.couponText) extra.push(p.couponText);
    if (p.isOutOfStock) extra.push('Out of stock on Wishlink');
    if (resolveError) extra.push(`Store link not found (${resolveError}); Product Link is the Wishlink link`);
    return {
      storeId: storeFromLink ? storeFromLink.id : 'wishlink',
      store: storeName,
      title: String(p.name || '').trim(),
      brand,
      price,
      mrp: mrp || price,
      discount,
      rating: Number(p.rating) > 0 ? Number(p.rating) : '',
      reviews: Number(p.numRatings) > 0 ? Number(p.numRatings) : '',
      link: resolvedLink ? cleanStoreLink(resolvedLink) : (p.purchaseUrl || p.shortUrl || ''),
      image,
      category: titleCase(p.productCategory || p.productCategoryFromBrand || ''),
      subcategory: titleCase(p.subCategory || ''),
      childCategory: '',
      description: [String(p.description || '').trim(), ...extra].filter(Boolean).join(' | '),
      wishlinkLink: p.purchaseUrl || p.shortUrl || '',
    };
  }

  async function pool(items, limit, worker, shouldStop) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length && !(shouldStop && shouldStop())) {
        const idx = i++;
        await worker(items[idx], idx);
      }
    }));
  }

  // Returns the same shape as the page scraper: { url, pageTitle, pageType, store, products }.
  // shouldStop(): return true to stop; the products read so far are returned (page.stopped = true).
  async function scrapeProfile(input, onStatus, shouldStop) {
    const stop = shouldStop || (() => false);
    const username = usernameFrom(input);
    if (!username) throw new Error(`Not a Wishlink profile link: ${input}`);
    const wid = visitorId();
    const status = onStatus || (async () => {});
    await status({ phase: `Reading @${username}'s Wishlink products…` });
    const info = await creatorInfo(username, wid);
    const raw = await fetchAllProducts(username, wid, (n) => status({ phase: `Reading @${username}'s Wishlink products (${n} found)…` }), stop);
    if (!raw.length) throw new Error(`No products found on Wishlink profile @${username}.`);

    const products = new Array(raw.length);
    let done = 0;
    await pool(raw, 6, async (p, idx) => {
      const share = p.purchaseUrl || p.shortUrl || '';
      let resolved = '';
      let err = '';
      if (share) {
        try { resolved = await resolveShare(share); } catch (e) { err = e.name === 'AbortError' ? 'timed out' : e.message; }
      } else {
        err = 'no link';
      }
      products[idx] = toProduct(p, resolved, err);
      done++;
      if (done % 5 === 0 || done === raw.length) {
        await status({ phase: `Finding store links (${done}/${raw.length})`, done, total: raw.length });
      }
    }, stop);
    const finished = products.filter(Boolean); // only rows finished before Stop

    const profileUrl = `https://www.wishlink.com/${username}`;
    return {
      url: profileUrl,
      pageTitle: (info && info.name) ? `${info.name} (@${username}) – Wishlink` : `@${username} – Wishlink`,
      pageType: 'wishlink-profile',
      store: `Wishlink ${username}`,
      username,
      products: finished,
      stopped: stop() || finished.length < raw.length,
      totalOnProfile: raw.length,
    };
  }

  g.DealWishlink = { usernameFrom, isProfileUrl, scrapeProfile, resolveShare, cleanStoreLink };
})(self);
