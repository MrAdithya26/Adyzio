// Page scraper. Injected on demand (after common/stores.js) and called as window.__dealScrape(options).
// Works on listing/search pages (many products) and on single product pages.
(function () {
  if (window.__dealScrape) return;
  const S = window.DealStores;

  const PRICE_RE = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const PRICE_RE_G = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const num = (s) => {
    if (s == null) return '';
    const m = String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : '';
  };
  const priceOf = (s) => {
    const m = String(s || '').match(PRICE_RE);
    return m ? num(m[1]) : num(s);
  };
  const abs = (href) => { try { return new URL(href, location.href).toString(); } catch (e) { return ''; } };

  function q(root, sel) {
    if (!sel) return null;
    try { return root.querySelector(sel); } catch (e) { return null; }
  }

  // Best image URL from an <img>, honouring lazy-load attributes and srcset.
  function imgUrl(img) {
    if (!img) return '';
    if (img.tagName !== 'IMG') {
      const bg = getComputedStyle(img).backgroundImage;
      const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
      if (m) return abs(m[1]);
      img = img.querySelector('img');
      if (!img) return '';
    }
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
    if (srcset) {
      const best = srcset.split(',').map((p) => p.trim().split(/\s+/))
        .map(([u, d]) => ({ u, w: parseFloat(d) || 1 }))
        .sort((a, b) => b.w - a.w)[0];
      if (best && best.u) return abs(best.u);
    }
    const cands = ['data-old-hires', 'data-src', 'data-original', 'data-lazy-src', 'data-zoom', 'src'];
    for (const a of cands) {
      const v = img.getAttribute(a);
      if (v && !v.startsWith('data:')) return abs(v);
    }
    return '';
  }

  // ---------- Store specific selectors (fallback heuristics fill any gaps) ----------
  const LIST = {
    amazon: {
      card: 'div[data-component-type="s-search-result"][data-asin]:not([data-asin=""]), div.s-result-item[data-asin]:not([data-asin=""])',
      link: 'h2 a, a.a-link-normal[href*="/dp/"], a[href*="/dp/"]',
      title: 'h2 span, h2, [data-cy="title-recipe"] span',
      brand: '[data-cy="title-recipe"] h2 + h2 span, .s-line-clamp-1 span',
      price: '.a-price:not(.a-text-price) .a-offscreen',
      mrp: '.a-price.a-text-price .a-offscreen',
      rating: '.a-icon-alt',
      reviews: 'a[href*="customerReviews"] span, [aria-label$="ratings"], span.s-underline-text',
      image: 'img.s-image',
    },
    flipkart: { card: 'div[data-id]', link: 'a[href*="/p/"]', title: 'a[title], div[class*="KzDlHZ"], div[class*="_4rR01T"]', image: 'img' },
    shopsy: { card: 'div[data-id]', link: 'a[href*="/p/"]', image: 'img' },
    myntra: {
      card: 'li.product-base',
      link: 'a[href]',
      brand: '.product-brand',
      title: '.product-product',
      price: '.product-discountedPrice, .product-price span:first-child',
      mrp: '.product-strike',
      discount: '.product-discountPercentage',
      rating: '.product-ratingsContainer span',
      reviews: '.product-ratingsCount',
      image: 'picture img, img.img-responsive, img',
    },
    ajio: {
      card: '.item.rilrtl-products-list__item, .rilrtl-products-list__item',
      link: 'a.rilrtl-products-list__link, a[href*="/p/"]',
      brand: '.brand',
      title: '.nameCls',
      price: '.price strong, .price',
      mrp: '.orginal-price',
      discount: '.discount',
      image: 'img.rilrtl-lazy-img, img',
    },
    nykaa: { card: 'div.productWrapper, div[class*="productWrapper"]', link: 'a[href*="/p/"]', image: 'img' },
    snapdeal: {
      card: '.product-tuple-listing',
      link: 'a.dp-widget-link, a[href*="/product/"]',
      title: '.product-title',
      price: '.product-price',
      mrp: '.product-desc-price',
      discount: '.product-discount',
      image: 'img.product-image',
    },
  };

  // How each store's product URLs look. Used to find product cards when no selector matches.
  const PRODUCT_HREF = {
    amazon: /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i,
    flipkart: /\/p\/itm/i,
    shopsy: /\/p\/itm/i,
    myntra: /\/\d{5,}\/buy/i,
    ajio: /\/p\/[\w-]+/i,
    meesho: /\/p\/\w+/i,
    nykaa: /\/p\/\d+/i,
    tatacliq: /\/p-mp\d+/i,
    snapdeal: /\/product\//i,
    jiomart: /\/p\/[\w-]+\/[\w-]+\/\d+/i,
    croma: /\/p\/\d+/i,
    reliancedigital: /\/p\/\d+|\/[\w-]+\/p\/\d+/i,
    firstcry: /\/\d{5,}\/product-detail/i,
    purplle: /\/product\//i,
    bewakoof: /\/p\//i,
    lenskart: /\.html/i,
  };

  const PRODUCT_PAGE = {
    amazon: () => /\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/i.test(location.pathname),
    flipkart: () => /\/p\/itm/i.test(location.pathname),
    shopsy: () => /\/p\/itm/i.test(location.pathname),
    myntra: () => /\/\d{5,}\/buy$/i.test(location.pathname),
    ajio: () => /\/p\/[\w-]+$/i.test(location.pathname),
    meesho: () => /\/p\/\w+$/i.test(location.pathname),
    nykaa: () => /\/p\/\d+/i.test(location.pathname),
    tatacliq: () => /\/p-mp\d+/i.test(location.pathname),
    snapdeal: () => /\/product\//i.test(location.pathname),
  };

  const DETAIL = {
    amazon: {
      title: '#productTitle',
      brand: '#bylineInfo',
      price: '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen, #corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen, #corePrice_feature_div .a-offscreen, #priceblock_dealprice, #priceblock_ourprice, .priceToPay .a-offscreen',
      mrp: '#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen, #corePriceDisplay_desktop_feature_div .a-text-price .a-offscreen, .basisPrice .a-offscreen',
      discount: '.savingsPercentage',
      rating: '#acrPopover .a-icon-alt, #acrPopover',
      reviews: '#acrCustomerReviewText',
      image: '#landingImage, #imgTagWrapperId img, #main-image',
    },
    flipkart: { title: 'h1 span:last-child, h1', image: 'img[src*="/image/"][loading="eager"], div[class*="_8id3KM"] img, img[src*="rukminim"]' },
    myntra: {
      brand: 'h1.pdp-title',
      title: 'h1.pdp-name',
      price: '.pdp-price strong, .pdp-price',
      mrp: '.pdp-mrp s',
      discount: '.pdp-discount',
      rating: '.index-overallRating div:first-child',
      reviews: '.index-ratingsCount',
      image: '.image-grid-image, .image-grid-imageContainer img',
    },
    ajio: { brand: 'h2.brand-name, .brand-name', title: 'h1.prod-name, .prod-name', price: '.prod-sp', mrp: '.prod-cp', discount: '.prod-discnt', image: '.rilrtl-lazy-img, .img-container img, img.zoom-img' },
    meesho: { title: 'h1, span[class*="ProductTitle"]', price: 'h4', image: 'img[src*="images.meesho.com"]' },
    nykaa: { title: 'h1', image: 'img[alt][src*="nykaa"]' },
    snapdeal: { title: 'h1.pdp-e-i-head, h1', price: '.payBlkBig', mrp: '.pdpCutPrice', discount: '.pdpDiscount', image: '#bx-slider-left-image-panel img, img.cloudzoom' },
  };

  // ---------- Heuristics ----------
  function pricesIn(text) {
    const out = [];
    let m;
    PRICE_RE_G.lastIndex = 0;
    while ((m = PRICE_RE_G.exec(text))) out.push(num(m[1]));
    return out.filter((n) => n > 0);
  }

  function guessRating(card, text) {
    const aria = card.querySelector('[aria-label*="out of 5" i], [title*="out of 5" i]');
    if (aria) {
      const n = num(aria.getAttribute('aria-label') || aria.getAttribute('title'));
      if (n && n <= 5) return n;
    }
    const m = text.match(/(?:^|\s)([1-5](?:\.\d)?)\s*(?:★|★|stars?|out of 5)/i) || text.match(/(?:^|\s)([1-5]\.\d)(?=\s|$)/);
    return m ? Number(m[1]) : '';
  }

  // "1,234" -> 1234, "2.1k" -> 2100, "1.2L" -> 120000
  function count(s) {
    const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([kKlLmM])?\b/);
    if (!m) return '';
    const mult = { k: 1e3, l: 1e5, m: 1e6 }[(m[2] || '').toLowerCase()] || 1;
    return Math.round(parseFloat(m[1]) * mult) || '';
  }

  function guessReviews(text) {
    const m = text.match(/\(?([\d,.]+\s*[kKlL]?)\)?\s*(?:ratings?|reviews?)/i);
    return m ? count(m[1]) : '';
  }

  function guessTitle(card, linkEl) {
    const cands = [
      linkEl && linkEl.getAttribute('title'),
      linkEl && linkEl.getAttribute('aria-label'),
      q(card, 'h1, h2, h3, h4') && txt(q(card, 'h1, h2, h3, h4')),
      q(card, '[class*="title" i], [class*="name" i]') && txt(q(card, '[class*="title" i], [class*="name" i]')),
      q(card, 'img[alt]') && q(card, 'img[alt]').getAttribute('alt'),
      linkEl && txt(linkEl),
    ];
    for (const c of cands) {
      const s = (c || '').replace(/\s+/g, ' ').trim();
      if (s && s.length > 3 && !PRICE_RE.test(s) && !/^(add to|buy now|view|sponsored)/i.test(s)) return s.slice(0, 300);
    }
    return '';
  }

  function biggestImage(root) {
    const imgs = [...root.querySelectorAll('img')].filter((i) => !/sprite|icon|logo|placeholder|star|rating/i.test(i.src + ' ' + i.className));
    imgs.sort((a, b) => (b.naturalWidth * b.naturalHeight || b.width * b.height) - (a.naturalWidth * a.naturalHeight || a.width * a.height));
    return imgs[0] || null;
  }

  function parseCard(card, cfg, storeId, linkEl) {
    cfg = cfg || {};
    linkEl = linkEl || q(card, cfg.link) || (card.tagName === 'A' ? card : card.querySelector('a[href]'));
    let link = linkEl ? abs(linkEl.getAttribute('href')) : '';
    if (storeId === 'amazon' && card.dataset && card.dataset.asin) {
      link = `${location.origin}/dp/${card.dataset.asin}`;
    }
    if (!link) return null;
    const text = txt(card);
    const title = txt(q(card, cfg.title)) || guessTitle(card, linkEl);
    const prices = pricesIn(text);
    let price = priceOf(txt(q(card, cfg.price))) || prices[0] || '';
    let mrp = priceOf(txt(q(card, cfg.mrp))) || '';
    if (!mrp && prices.length > 1) {
      const higher = prices.filter((p) => p > price);
      mrp = higher.length ? Math.max(...higher) : '';
    }
    let discount = num(txt(q(card, cfg.discount)));
    if (!discount) { const m = text.match(/(\d{1,2})\s*%\s*off/i); discount = m ? Number(m[1]) : ''; }
    if (!discount && price && mrp && mrp > price) discount = Math.round(((mrp - price) / mrp) * 100);
    const ratingEl = q(card, cfg.rating);
    let rating = ratingEl ? num(txt(ratingEl) || ratingEl.getAttribute('aria-label')) : '';
    if (!rating || rating > 5) rating = guessRating(card, text);
    let reviews = cfg.reviews ? count(txt(q(card, cfg.reviews))) : '';
    if (!reviews) reviews = guessReviews(text);
    const imgEl = q(card, cfg.image) || biggestImage(card);
    return {
      title,
      brand: txt(q(card, cfg.brand)),
      price,
      mrp,
      discount,
      rating,
      reviews,
      link,
      image: imgUrl(imgEl),
    };
  }

  // Finds product cards by grouping product links: the card is the largest ancestor that
  // still contains only one product URL.
  function genericCards(storeId) {
    const pattern = PRODUCT_HREF[storeId];
    const anchors = [...document.querySelectorAll('a[href]')].filter((a) => {
      const href = a.getAttribute('href') || '';
      if (/^(#|javascript:|mailto:|tel:)/i.test(href)) return false;
      if (pattern) return pattern.test(href);
      return true;
    });
    const keyOf = (a) => S.cleanProductUrl(abs(a.getAttribute('href')));
    const seen = new Set();
    const results = [];
    for (const a of anchors) {
      const key = keyOf(a);
      if (!key || seen.has(key)) continue;
      let card = a;
      let el = a.parentElement;
      for (let depth = 0; el && el !== document.body && depth < 8; depth++, el = el.parentElement) {
        const keys = new Set([...el.querySelectorAll('a[href]')]
          .filter((x) => !pattern || pattern.test(x.getAttribute('href') || ''))
          .map(keyOf));
        if (keys.size > 1) break;
        card = el;
      }
      const text = txt(card);
      if (!card.querySelector('img') && card.tagName !== 'IMG') continue;
      if (!pattern && !PRICE_RE.test(text)) continue; // unknown sites: only cards that show a price
      const p = parseCard(card, {}, storeId, a);
      if (p && p.title) { seen.add(key); results.push(p); }
    }
    return results;
  }

  function jsonLdItems() {
    const out = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(walk);
      const type = [].concat(node['@type'] || []).join(',');
      if (/Product/i.test(type)) out.push(node);
      if (node['@graph']) walk(node['@graph']);
      if (node.itemListElement) walk(node.itemListElement);
      if (node.item) walk(node.item);
      if (node.mainEntity) walk(node.mainEntity);
    };
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { walk(JSON.parse(s.textContent)); } catch (e) { /* ignore broken JSON-LD */ }
    });
    return out.map((p) => {
      const offer = [].concat(p.offers || [])[0] || {};
      const img = [].concat(p.image || [])[0];
      return {
        title: (p.name || '').trim(),
        brand: typeof p.brand === 'string' ? p.brand : (p.brand && p.brand.name) || '',
        price: num(offer.price || offer.lowPrice),
        mrp: num(offer.highPrice) || '',
        discount: '',
        rating: num(p.aggregateRating && p.aggregateRating.ratingValue),
        reviews: num(p.aggregateRating && (p.aggregateRating.reviewCount || p.aggregateRating.ratingCount)),
        link: abs(p.url || offer.url || location.href),
        image: typeof img === 'string' ? abs(img) : (img && img.url) || '',
      };
    }).filter((p) => p.title);
  }

  function meta(name) {
    const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
    return el ? el.getAttribute('content') || '' : '';
  }

  // Category path from structured data or the breadcrumb bar, without "Home".
  function breadcrumbs() {
    let names = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      if (names.length) return;
      try {
        const walk = (n) => {
          if (!n || typeof n !== 'object' || names.length) return;
          if (Array.isArray(n)) return n.forEach(walk);
          if (/BreadcrumbList/i.test([].concat(n['@type'] || []).join(','))) {
            names = [].concat(n.itemListElement || [])
              .sort((a, b) => (a.position || 0) - (b.position || 0))
              .map((it) => (it.name || (it.item && it.item.name) || '').trim());
            return;
          }
          if (n['@graph']) walk(n['@graph']);
        };
        walk(JSON.parse(s.textContent));
      } catch (e) { /* ignore */ }
    });
    if (!names.length) {
      const sel = '#wayfinding-breadcrumbs_feature_div a, nav[aria-label*="readcrumb"] a, [class*="breadcrumb" i] a, [class*="Breadcrumb"] a';
      names = [...document.querySelectorAll(sel)].map(txt);
    }
    return names.filter((n) => n && !/^(home|all categories|›|>|\/)$/i.test(n) && n.length < 60);
  }

  function shortDescription(storeId) {
    let text = '';
    if (storeId === 'amazon') {
      text = [...document.querySelectorAll('#feature-bullets li span.a-list-item')].map(txt).filter(Boolean).slice(0, 2).join(' ');
    }
    if (!text) {
      const d = meta('og:description') || meta('description');
      if (d && !/\bonline\b.*\b(price|india)\b|^buy\b|^shop\b/i.test(d)) text = d;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 220) text = text.slice(0, 220).replace(/\s+\S*$/, '') + '…';
    return text;
  }

  function productPage(storeId) {
    const cfg = DETAIL[storeId] || {};
    const ld = jsonLdItems()[0] || {};
    const textOf = (sel) => txt(q(document, sel));
    const imgEl = q(document, cfg.image);
    let title = textOf(cfg.title) || ld.title || meta('og:title') || document.title;
    const brand = textOf(cfg.brand).replace(/^(visit the|brand:)\s*/i, '').replace(/\s*store$/i, '') || ld.brand || '';
    let price = priceOf(textOf(cfg.price)) || ld.price || num(meta('product:price:amount')) || '';
    let mrp = priceOf(textOf(cfg.mrp)) || ld.mrp || '';
    if (!price) {
      // First rupee amounts near the top of the page.
      const main = document.querySelector('main') || document.body;
      const prices = pricesIn(txt(main).slice(0, 4000));
      price = prices[0] || '';
      if (!mrp) { const higher = prices.slice(1, 4).filter((p) => p > price); mrp = higher[0] || ''; }
    }
    let discount = num(textOf(cfg.discount));
    if (!discount && price && mrp && mrp > price) discount = Math.round(((mrp - price) / mrp) * 100);
    const ratingEl = q(document, cfg.rating);
    let rating = ratingEl ? num(txt(ratingEl) || ratingEl.getAttribute('title')) : '';
    if (!rating || rating > 5) rating = ld.rating || '';
    const reviews = count(textOf(cfg.reviews)) || ld.reviews || '';
    let image = imgUrl(imgEl) || ld.image || meta('og:image') || imgUrl(biggestImage(document.body));
    if (storeId === 'amazon' && imgEl) {
      const dyn = imgEl.getAttribute('data-a-dynamic-image');
      if (dyn) {
        try {
          const best = Object.entries(JSON.parse(dyn)).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0];
          if (best) image = best[0];
        } catch (e) { /* keep fallback */ }
      }
    }
    if (storeId === 'myntra' && title && brand && !title.toLowerCase().startsWith(brand.toLowerCase())) title = `${brand} ${title}`;
    return { title: title.trim(), brand, price, mrp, discount, rating, reviews, link: location.href, image, description: shortDescription(storeId) };
  }

  async function autoScroll(maxSteps) {
    let lastHeight = 0;
    let stable = 0;
    for (let i = 0; i < maxSteps; i++) {
      if (window.__dealStop) break; // Stop pressed: keep what is loaded so far
      window.scrollBy(0, Math.round(window.innerHeight * 0.9));
      await sleep(700);
      const h = document.documentElement.scrollHeight;
      if (window.innerHeight + window.scrollY >= h - 10) {
        stable = h === lastHeight ? stable + 1 : 0;
        if (stable >= 2) break;
      }
      lastHeight = h;
    }
    window.scrollTo(0, 0);
    await sleep(300);
  }

  window.__dealScrape = async function (opts) {
    opts = opts || {};
    window.__dealStop = false;
    const store = S.detectStore(location.href);
    const isDetail = PRODUCT_PAGE[store.id] ? PRODUCT_PAGE[store.id]() : false;
    let products = [];
    let pageType = 'listing';

    if (isDetail || opts.mode === 'product') {
      pageType = 'product';
      products = [productPage(store.id)];
    } else {
      if (opts.autoScroll) await autoScroll(opts.maxScrolls || 15);
      const cfg = LIST[store.id];
      if (cfg) {
        document.querySelectorAll(cfg.card).forEach((card) => {
          const p = parseCard(card, cfg, store.id);
          if (p && p.title) products.push(p);
        });
      }
      if (products.length < 2) {
        const generic = genericCards(store.id);
        if (generic.length > products.length) products = generic;
      }
      if (products.length < 2) {
        const ld = jsonLdItems();
        if (ld.length > products.length) products = ld;
      }
      if (!products.length) {
        // Nothing list-like found: treat it as a product page.
        pageType = 'product';
        products = [productPage(store.id)];
      }
    }

    const crumbs = breadcrumbs();
    const seen = new Set();
    const clean = [];
    for (const p of products) {
      const link = S.cleanProductUrl(p.link);
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const pStore = S.detectStore(link);
      clean.push({
        ...p,
        store: pStore.id === 'other' ? store.name : pStore.name,
        storeId: pStore.id === 'other' ? store.id : pStore.id,
        link,
        category: crumbs[0] || '',
        subcategory: crumbs[1] || '',
        childCategory: crumbs.length > 2 ? crumbs[crumbs.length - 1] : '',
        description: p.description || '',
        image: opts.highResImages === false ? p.image : S.upscaleImage(p.image),
      });
    }
    return { pageType, store: store.name, storeId: store.id, url: location.href, pageTitle: document.title, products: clean };
  };
})();
