// Shared store rules: detection, link cleaning and image upscaling.
// Loaded in the background worker (importScripts) and injected into pages before the scraper.
(function (g) {
  const STORES = [
    { id: 'amazon', name: 'Amazon', hosts: ['amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'amzn.eu', 'a.co'] },
    { id: 'flipkart', name: 'Flipkart', hosts: ['flipkart.com', 'fkrt.it', 'fkrt.co', 'fkrt.cc'] },
    { id: 'myntra', name: 'Myntra', hosts: ['myntra.com', 'myntr.it'] },
    { id: 'ajio', name: 'Ajio', hosts: ['ajio.com', 'ajiio.in'] },
    { id: 'meesho', name: 'Meesho', hosts: ['meesho.com'] },
    { id: 'shopsy', name: 'Shopsy', hosts: ['shopsy.in'] },
    { id: 'nykaa', name: 'Nykaa', hosts: ['nykaa.com', 'nykaafashion.com', 'nykaaman.com'] },
    { id: 'tatacliq', name: 'Tata CLiQ', hosts: ['tatacliq.com', 'luxury.tatacliq.com'] },
    { id: 'snapdeal', name: 'Snapdeal', hosts: ['snapdeal.com'] },
    { id: 'jiomart', name: 'JioMart', hosts: ['jiomart.com'] },
    { id: 'croma', name: 'Croma', hosts: ['croma.com'] },
    { id: 'reliancedigital', name: 'Reliance Digital', hosts: ['reliancedigital.in'] },
    { id: 'firstcry', name: 'FirstCry', hosts: ['firstcry.com'] },
    { id: 'purplle', name: 'Purplle', hosts: ['purplle.com'] },
    { id: 'bewakoof', name: 'Bewakoof', hosts: ['bewakoof.com'] },
    { id: 'lenskart', name: 'Lenskart', hosts: ['lenskart.com'] },
    { id: 'pepperfry', name: 'Pepperfry', hosts: ['pepperfry.com'] },
    { id: 'mamaearth', name: 'Mamaearth', hosts: ['mamaearth.in'] },
    { id: 'boat', name: 'boAt', hosts: ['boat-lifestyle.com'] },
    { id: 'swiggy', name: 'Swiggy Instamart', hosts: ['swiggy.com'] },
    { id: 'bigbasket', name: 'BigBasket', hosts: ['bigbasket.com'] },
    { id: 'extrape', name: 'ExtraPe', hosts: ['extrape.com', 'extp.in'] },
  ];

  // Query parameters that only track clicks and can always be removed.
  const TRACKING_PARAMS = /^(utm_\w+|gclid|fbclid|msclkid|igshid|ref|ref_|_encoding|psc|qid|sr|sprefix|crid|keywords|dib|dib_tag|pd_rd_\w+|pf_rd_\w+|content-id|th|smid|spLa|linkCode|linkId|tag|ascsubtag|affid|affExtParam\d|cmpid|lid|marketplace|store|srno|otracker\d?|fm|iid|ppt|ppn|ssid|spm|ctx|trackingId|_appId|source|isrc|sid)$/i;

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^(www|m|dl)\./, ''); } catch (e) { return ''; }
  }

  function detectStore(url) {
    const h = hostOf(url);
    for (const s of STORES) {
      if (s.hosts.some((x) => h === x || h.endsWith('.' + x))) return s;
    }
    return { id: 'other', name: h || 'Other', hosts: [] };
  }

  function amazonAsin(url) {
    const m = String(url).match(/\/(?:dp|gp\/product|gp\/aw\/d|product|d)\/([A-Z0-9]{10})(?=[/?#]|$)/i);
    return m ? m[1].toUpperCase() : '';
  }

  // Short store links (amzn.to, fkrt.it, ...) must be expanded before cleaning.
  function isShortLink(url) {
    return /^(amzn\.to|amzn\.in|amzn\.eu|a\.co|fkrt\.it|fkrt\.co|fkrt\.cc|myntr\.it|ajiio\.in|extp\.in|bit\.ly|tinyurl\.com|cutt\.ly)$/i.test(hostOf(url));
  }

  function cleanProductUrl(url) {
    let u;
    try { u = new URL(url); } catch (e) { return url; }
    const store = detectStore(url).id;
    u.hash = '';
    if (store === 'amazon') {
      const asin = amazonAsin(u.pathname);
      if (asin) return `${u.protocol}//${u.hostname.replace(/^m\./, 'www.')}/dp/${asin}`;
    }
    if (store === 'flipkart' || store === 'shopsy') {
      const pid = u.searchParams.get('pid');
      const lid = u.searchParams.get('lid');
      const out = new URL(u.origin + u.pathname);
      if (pid) out.searchParams.set('pid', pid);
      if (lid) out.searchParams.set('lid', lid);
      return out.toString();
    }
    if (['myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq', 'snapdeal', 'croma', 'jiomart', 'reliancedigital', 'lenskart', 'bewakoof'].includes(store)) {
      // Product id lives in the path for these stores, except Nykaa listing variants.
      const keep = store === 'nykaa' ? ['skuId', 'productId'] : [];
      const out = new URL(u.origin + u.pathname);
      keep.forEach((k) => { if (u.searchParams.get(k)) out.searchParams.set(k, u.searchParams.get(k)); });
      return out.toString();
    }
    [...u.searchParams.keys()].forEach((k) => { if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k); });
    return u.toString();
  }

  // Swap thumbnail sizes in CDN URLs for the large version.
  function upscaleImage(url) {
    if (!url || url.startsWith('data:')) return url || '';
    let out = url;
    if (/media-amazon\.com|images-amazon\.com|ssl-images-amazon/.test(out)) {
      out = out.replace(/\._[^/]+?_\.(jpe?g|png|webp|gif)(\?.*)?$/i, '.$1');
    } else if (/rukminim\d*\.flixcart\.com|rukmini\d*\.flixcart\.com/.test(out)) {
      out = out.replace(/\/image\/\d+\/\d+\//, '/image/832/832/').replace(/([?&])q=\d+/, '$1q=90');
    } else if (/myntassets\.com/.test(out)) {
      out = out.replace(/\/(?:[a-z]{1,4}_[^/,]+,?)+\/(v1|assets)\//, '/h_1440,q_100,w_1080/$1/');
    } else if (/assets\.ajio\.com|assets-jiocdn\.ajio\.com/.test(out)) {
      out = out.replace(/-\d+Wx\d+H-/, '-1117Wx1400H-');
    } else if (/images\.meesho\.com/.test(out)) {
      out = out.replace(/\/(\d+)_\d+\.(webp|jpe?g|png)/i, '/$1_512.$2');
    } else if (/nykaa\.com/.test(out)) {
      out = out.replace(/tr=w-\d+(,h-\d+)?/, 'tr=w-800');
    }
    return out;
  }

  g.DealStores = { STORES, hostOf, detectStore, amazonAsin, isShortLink, cleanProductUrl, upscaleImage };
})(typeof self !== 'undefined' ? self : window);
