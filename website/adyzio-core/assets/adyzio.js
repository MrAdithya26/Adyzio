/* Adyzio Core – homepage script (v1.2: sections, category bar, banners, panels, category pages).
   Data comes from WordPress in window.ADYZIO_DATA. */
(function () {
  "use strict";
  var root = document.getElementById("adz-app");
  if (!root) return;

  var D = window.ADYZIO_DATA || {};
  var P = D.deals || [];
  var STORES = {};
  (D.stores || []).forEach(function (s) { STORES[s.k] = s; });
  var TOP = D.top || [];
  var ALLCATS = D.cats || [];               /* [slug, en, te, parentSlug, link] */
  var VERTS = D.verts || { main: ["Adyzio", "Adyzio", "Visit Store", "Store చూడండి"] };
  var VKEYS = Object.keys(VERTS);
  var PER_ROW = D.perRow || 10;
  var DAY = 864e5, HOUR = 36e5;

  /* ---------- text ---------- */
  var TXT = {
    te: {
      saved: "సేవ్", fType: "డీల్ రకం", loot: "లూట్ డీల్", today: "ఈరోజు డీల్", drop: "ధర తగ్గింది", fPrice: "ధర (₹)", fOff: "కనీస డిస్కౌంట్", fSort: "క్రమం",
      reset: "Filters తీసేయండి",
      jH: "లూట్ డీల్స్ అయిపోకముందే పొందండి", jP: "Telegram, WhatsApp లో free alerts. రోజుకు కొన్ని మంచి picks, spam లేదు.",
      jT: "Telegram లో చేరండి", jW: "WhatsApp లో చేరండి", follow: "Adyzio ని follow అవ్వండి",
      s1: "డీల్ ఎంచుకోండి", s1p: "Category లేదా store ద్వారా చూడండి, లేదా search చేయండి. నచ్చినవి heart తో save చేయండి.",
      s2: "ఎవరికి సరిపోతుందో చదవండి", s2p: "\"సరిపోయేది\" line మీ అవసరానికి తగినదో చెబుతుంది. కొనే ముందు చెక్ చేయాల్సినవి title నొక్కితే కనిపిస్తాయి.",
      s3: "Store లో కొనండి", s3p: "Button Amazon, Flipkart లేదా store page ఓపెన్ చేస్తుంది. అక్కడ ఈరోజు ధర చూసి కొనండి.",
      fq: "ప్రశ్నలు", q1: "Adyzio అంటే ఏమిటి?", a1: "Adyzio, ఆంధ్రప్రదేశ్ కి చెందిన ABD Innovations డీల్స్ site. ఉపయోగపడే products ఎంచుకుని, చిన్న note రాసి, కొనడానికి store link ఇస్తాం.",
      q2: "ఈ links నుండి మీకు ఆదాయం వస్తుందా?", a2: "అవును. Adyzio Amazon Associate, మరియు Flipkart, Myntra, Ajio వంటి stores కోసం ExtraPe ద్వారా commission వస్తుంది. మీకు ధర మారదు.",
      q3: "ధరలు live గా ఉంటాయా?", a3: "లేదు. మేము చెక్ చేసిన 24 గంటల వరకే ధర చూపిస్తాం. తర్వాత \"తాజా ధర చూడండి\" అని ఉంటుంది. కొనే ముందు store page లో confirm చేయండి.",
      q4: "Ratings, reviews చూపిస్తారా?", a4: "లేదు. Ratings store page లోనే ఉంటాయి. మేము ఎవరికి సరిపోతుందో మాత్రమే రాస్తాం."
    }
  };
  var L = {
    en: { good: "Good for", check: "Check latest price", checked: "Checked", buy: "Buy Now", read: "Read more", results: "deals", deal1: "deal", none: "No deals match these filters.", catSoon: "New deals here are on the way. Join our channel to get them first.", saved: "Saved deals", savedNone: "Tap the heart on any deal to save it here.", copied: "Link copied", ends: "Ends in", ended: "Ended", before: "Check before you buy", lootL: "Loot Deal", todayL: "Get Today", dropL: "Price Drop", dotd: "Deal of the hour", startPrice: "Price", mrp: "MRP", seeDeal: "See deal", seeDeals: "See deals", under: "Under", all: "All deals", close: "Close", share: "Share", shareOn: "Share On", copyLink: "Copy link", shareVia: "Share this deal", tgSub: "Send to a chat or group", mailSub: "Opens your email app", waSub: "Send to a contact or group", fullPost: "Read full post", minAgo: " min ago", hAgo: " h ago", dAgo: " days ago", viewAll: "View all", allIn: "All", bestOf: "Best of ", dotdT: "Deals of the Day", budgetT: "Shop by budget", budgetP: "Prices we checked in the last 24 hours", storesT: "Top stores", moreT: "More on Adyzio", explore: "Explore", partners: " partners", latestIn: "Latest deals", soonT: "First deals coming soon", soonP: "We're checking prices and writing the first picks. Join the channel to get them first.", soonV: " offers are coming soon", soonVP: "We're adding trusted partners. Join our Telegram channel to hear first.", adminTip: "Only you see this: add store links in Settings → Adyzio → Store links to fill this section.", home: "Adyzio", resultsFor: "Results for", travelS: "Travel", prev: "Previous banner", next: "Next banner", slideOf: " of ", store: "Store" },
    te: { good: "సరిపోయేది", check: "తాజా ధర చూడండి", checked: "చెక్ చేసింది", buy: "ఇప్పుడే కొనండి", read: "మరింత చదవండి", results: "డీల్స్", deal1: "డీల్", none: "ఈ filters కి డీల్స్ లేవు.", catSoon: "ఇక్కడ కొత్త డీల్స్ త్వరలో. ముందుగా పొందడానికి మా channel లో చేరండి.", saved: "సేవ్ చేసిన డీల్స్", savedNone: "ఏ డీల్ పైనైనా heart నొక్కితే ఇక్కడ save అవుతుంది.", copied: "Link కాపీ అయింది", ends: "ముగింపు", ended: "ముగిసింది", before: "కొనే ముందు చెక్ చేయండి", lootL: "లూట్ డీల్", todayL: "ఈరోజే", dropL: "ధర తగ్గింది", dotd: "ఈ గంట డీల్", startPrice: "ధర", mrp: "MRP", seeDeal: "డీల్ చూడండి", seeDeals: "డీల్స్ చూడండి", under: "లోపు", all: "అన్ని డీల్స్", close: "మూసివేయండి", share: "షేర్", shareOn: "షేర్ చేయండి", copyLink: "Link కాపీ", shareVia: "ఈ డీల్ షేర్ చేయండి", tgSub: "Chat లేదా group కి పంపండి", mailSub: "మీ email app ఓపెన్ అవుతుంది", waSub: "Contact లేదా group కి పంపండి", fullPost: "పూర్తి post చదవండి", minAgo: " నిమిషాల క్రితం", hAgo: " గంటల క్రితం", dAgo: " రోజుల క్రితం", viewAll: "అన్నీ చూడండి", allIn: "అన్నీ", bestOf: "బెస్ట్: ", dotdT: "ఈరోజు డీల్స్", budgetT: "బడ్జెట్ వారీగా", budgetP: "గత 24 గంటల్లో చెక్ చేసిన ధరలు", storesT: "టాప్ stores", moreT: "Adyzio లో ఇంకా", explore: "చూడండి", partners: " భాగస్వాములు", latestIn: "తాజా డీల్స్", soonT: "మొదటి డీల్స్ త్వరలో", soonP: "ధరలు చెక్ చేసి మొదటి picks రాస్తున్నాం. ముందుగా పొందడానికి channel లో చేరండి.", soonV: " ఆఫర్లు త్వరలో", soonVP: "నమ్మకమైన భాగస్వాములను చేర్చుతున్నాం. ముందుగా తెలుసుకోవడానికి Telegram లో చేరండి.", adminTip: "ఇది మీకు మాత్రమే కనిపిస్తుంది: Settings → Adyzio → Store links లో links జోడించండి.", home: "Adyzio", resultsFor: "ఫలితాలు", travelS: "ప్రయాణం", prev: "ముందు banner", next: "తర్వాతి banner", slideOf: " / ", store: "Store" }
  };
  var VDESC = {
    shopping: ["Amazon, Flipkart, Myntra and more", "Amazon, Flipkart, Myntra ఇంకా మరెన్నో"],
    travel: ["Flights, hotels and holidays", "ఫ్లైట్స్, హోటల్స్, హాలిడేస్"],
    finance: ["Credit cards, savings and loans", "క్రెడిట్ కార్డులు, సేవింగ్స్, లోన్స్"],
    hosting: ["Domains and web hosting", "డొమైన్స్, వెబ్ హోస్టింగ్"],
    services: ["Apps, courses and services", "యాప్స్, కోర్సులు, సేవలు"]
  };

  /* ---------- helpers ---------- */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var st = { vert: "main", mode: "home", cat: "all", stores: new Set(), types: new Set(), q: "", min: "", max: "", minoff: 0, sort: "new", under: 0, wish: new Set(lsGet("adz-wish") || []), onlyWish: false, lang: lsGet("adz-lang") || "en" };
  var rowSub = {}, keepFilters = false, wasList = false, carTimer = null, booted = false;
  function $(s) { return root.querySelector(s); }
  function tl(k) { return L[st.lang][k]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function fresh(p) { return p.price != null && p.checked && Date.now() - p.checked < DAY; }
  function off(p) { return fresh(p) && p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0; }
  function ago(ms) { var m = Math.max(1, Math.round((Date.now() - ms) / 6e4)); return m < 60 ? m + tl("minAgo") : m < 1440 ? Math.round(m / 60) + tl("hAgo") : Math.round(m / 1440) + tl("dAgo"); }
  function countdown(ms) { var d = ms - Date.now(); if (d <= 0) return null; var hh = Math.floor(d / HOUR), mm = Math.floor(d % HOUR / 6e4), ss = Math.floor(d % 6e4 / 1e3); return hh + "h " + String(mm).padStart(2, "0") + "m " + String(ss).padStart(2, "0") + "s"; }
  function sInfo(k) { return STORES[k] || { k: k, n: k ? k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, " ") : "Adyzio", c: "#2a2470", v: "shopping" }; }
  function initials(t) { return t.split(/\s+/).filter(function (w) { return /^[A-Za-z]/.test(w); }).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("") || "A"; }
  function catRow(slug) { return ALLCATS.filter(function (c) { return c[0] === slug; })[0]; }
  function catName(slug) { var c = catRow(slug); return c ? c[st.lang === "te" ? 2 : 1] : ""; }
  function tops() { return ALLCATS.filter(function (c) { return !c[3]; }); }
  function children(slug) { return ALLCATS.filter(function (c) { return c[3] === slug; }); }
  function inCat(p, slug) { return (p.cats || [p.cat]).indexOf(slug) > -1; }
  function vName(v) { var x = VERTS[v] || VERTS.main; return st.lang === "te" ? x[1] : x[0]; }
  function vAction(v) { var x = VERTS[v] || VERTS.main; return st.lang === "te" ? x[3] : x[2]; }
  function dealVert(p) { return p.s ? (sInfo(p.s).v || "shopping") : "shopping"; }
  function newest(a, b) { return (b.pin - a.pin) || (b.date - a.date); }

  /* ---------- icons ---------- */
  function svg(paths, size) { return '<svg width="' + (size || 28) + '" height="' + (size || 28) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>'; }
  var CI = {
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    appliance: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h.01"/>',
    shirt: '<path d="M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-1 2-3 2-4 2s-3 0-4-2z"/>',
    beauty: '<path d="M9 22h6V12H9z"/><path d="M10 12V7l4-3v8"/>',
    toys: '<rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><rect x="8" y="4" width="8" height="8" rx="1"/>',
    grocery: '<path d="M3 9h18l-2 11H5z"/><path d="M8 9l3-6M16 9l-3-6"/>',
    sports: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M8 9h3"/>',
    plane: '<path d="M10.5 13.5 3 11l1-2 8 1 5-6a1.5 1.5 0 0 1 2 2l-6 5 1 8-2 1-2.5-7.5z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/><path d="M8 12h2l1.5-3 2 6 1.5-3h2"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
    paw: '<circle cx="5.5" cy="10" r="2"/><circle cx="9" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 3-4 3s-4-1-4-3z"/>',
    office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4 9 8 12 8zM12 8s2-5 4.5-4S15 8 12 8z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function iconFor(slug, name) {
    var s = (slug + " " + name).toLowerCase();
    var map = [[/deal|offer/, "tag"], [/mobile|phone|tablet/, "phone"], [/student|school|exam|stationer|book/, "cap"], [/applian/, "appliance"], [/electron|laptop|computer/, "laptop"], [/kitchen|home|furnit|decor/, "home"], [/fashion|cloth|wear/, "shirt"], [/beauty|personal|groom|cosmetic/, "beauty"], [/toy|baby|kid/, "toys"], [/health|wellness/, "health"], [/grocer|food|staple|gourmet/, "grocery"], [/sport|fitness|gym|yoga/, "sports"], [/jewel|watch/, "gem"], [/luggage|bag/, "bag"], [/wheel|auto|bike|car\b/, "bike"], [/pet/, "paw"], [/office|industr/, "office"], [/music|instrument|entertain/, "music"], [/gift|occasion/, "gift"], [/travel|flight|hotel/, "plane"], [/financ|card|loan|bank/, "card"], [/host|domain|server/, "server"], [/service/, "grid"]];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(s)) return map[i][1];
    return "bag";
  }
  var TINTS = [["#ECEBFB", "#2A2470"], ["#FFF1DC", "#9A5600"], ["#E2F4EA", "#16794A"], ["#FDE7E2", "#B3311A"], ["#E6F0FB", "#1D5FA0"], ["#F3E8FB", "#6E2B82"]];
  var VICON = { main: "tag", shopping: "bag", travel: "plane", finance: "card", hosting: "server", services: "grid" };

  var ICO = {
    wa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    tg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 2.9 10.8c-1.2.5-1.2 1.2 0 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8s.6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.8-1.6-1.3zM9.8 14.3l-.4 4.2-1.5-4.8 10.6-6.7z"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    heart: function (on) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (on ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z"/></svg>'; }
  };

  /* ---------- share (always the Adyzio post, never the raw affiliate link) ---------- */
  var enc = encodeURIComponent;
  function shareUrl(p, src) { return p.url + (p.url.indexOf("?") < 0 ? "?" : "&") + "src=" + src; }
  function shareText(p) { return "🛍️ " + p.t + (p.good ? "\n" + tl("good") + ": " + p.good : "") + "\n" + (fresh(p) ? inr(p.price) + (p.mrp ? " (MRP " + inr(p.mrp) + ")" : "") : tl("check")) + (p.s ? " · " + sInfo(p.s).n : ""); }
  function waHref(p) { return "https://wa.me/?text=" + enc(shareText(p) + "\n👉 " + shareUrl(p, "whatsapp")); }
  function tgHref(p) { return "https://t.me/share/url?url=" + enc(shareUrl(p, "telegram")) + "&text=" + enc(shareText(p)); }
  function mailHref(p) { return "mailto:?subject=" + enc("Deal on Adyzio: " + p.t) + "&body=" + enc(shareText(p) + "\n\n" + shareUrl(p, "email") + "\n\n(Adyzio may earn a commission on purchases.)"); }
  function shareBlock(p) {
    return '<div class="adz-shrow"><a class="adz-swa" href="' + esc(waHref(p)) + '" target="_blank" rel="noopener">' + ICO.wa + tl("share") + '</a>' +
      '<button type="button" class="adz-son" data-sh="' + p.id + '">' + ICO.share + tl("shareOn") + '</button></div>' +
      '<button type="button" class="adz-cpy" data-copy="' + p.id + '">' + ICO.copy + tl("copyLink") + '</button>';
  }
  function storeMark(k) {
    if (!k) return "";
    var s = sInfo(k);
    if (s.logo) return '<img src="' + esc(s.logo) + '" alt="' + esc(s.n) + '" loading="lazy">';
    return '<span class="adz-stxt" style="color:' + esc(s.c) + '"><i style="background:' + esc(s.c) + '">' + esc(s.n.charAt(0).toUpperCase()) + '</i>' + esc(s.n) + '</span>';
  }
  function buyBtn(p, cls) {
    var link = safeUrl(p.link);
    return link
      ? '<a class="adz-buy ' + (cls || "") + '" href="' + esc(link) + '" target="_blank" rel="sponsored nofollow noopener">' + tl("buy") + '</a>'
      : '<a class="adz-buy ' + (cls || "") + '" href="' + esc(p.url) + '">' + tl("read") + '</a>';
  }

  /* ---------- deal card ---------- */
  function card(p) {
    var o = off(p), w = st.wish.has(p.id), c = sInfo(p.s).c, f = fresh(p), cd = p.ends ? countdown(p.ends) : null;
    var rib = p.type ? '<span class="adz-ribbon adz-b-' + esc(p.type) + '">' + tl(p.type + "L") + '</span>' : "";
    return '<article class="adz-card">' +
      '<div class="adz-thumb">' + (p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(p.t) + '" loading="lazy">' : '<span class="adz-ph" style="color:' + esc(c) + '">' + esc(initials(p.t)) + '</span>') +
        rib +
        '<button type="button" class="adz-heart" data-w="' + p.id + '" aria-pressed="' + w + '" aria-label="Save deal">' + ICO.heart(w) + '</button>' +
        (o ? '<span class="adz-off">' + o + '% off</span>' : "") +
      '</div>' +
      '<div class="adz-cb">' +
        '<div class="adz-smark">' + storeMark(p.s) + '</div>' +
        '<h4><button type="button" class="adz-tlink" data-d="' + p.id + '">' + esc(p.t) + '</button></h4>' +
        (p.good ? '<div class="adz-good"><b>' + tl("good") + ':</b> ' + esc(p.good) + '</div>' : "") +
        '<div class="adz-pinfo">' +
          '<div><span class="adz-lbl">' + tl("startPrice") + '</span>' + (f ? '<b>' + inr(p.price) + '</b>' : '<span class="adz-checkp">' + tl("check") + '</span>') + '</div>' +
          '<div class="adz-sep"></div>' +
          '<div>' + (f && p.mrp ? '<span class="adz-pillg">' + tl("mrp") + ' <s>' + inr(p.mrp) + '</s></span><strong>' + o + '% off</strong>' : '<span class="adz-pillg">' + esc(p.s ? sInfo(p.s).n : catName(p.cat)) + '</span><strong>' + tl("seeDeal") + '</strong>') +
            (cd ? '<div class="adz-checked" style="color:var(--hot);font-weight:700" data-end="' + p.ends + '">' + tl("ends") + " " + cd + '</div>' : (f ? '<div class="adz-checked">' + tl("checked") + " " + ago(p.checked) + '</div>' : "")) +
          '</div>' +
        '</div>' +
        buyBtn(p) +
        shareBlock(p) +
      '</div></article>';
  }

  /* ---------- header + category bar ---------- */
  function buildChrome() {
    root.querySelectorAll("[data-i]").forEach(function (el) {
      var k = el.getAttribute("data-i");
      if (!el.hasAttribute("data-en")) el.setAttribute("data-en", el.innerHTML);
      var te = st.lang === "te" && TXT.te[k];
      el.innerHTML = te ? TXT.te[k] : el.getAttribute("data-en");
      el.classList.toggle("te", !!te);
    });
    root.querySelectorAll("[data-vt]").forEach(function (el) { el.textContent = vName(el.getAttribute("data-vt")); });
    root.querySelectorAll(".adz-vt").forEach(function (a) {
      if (a.dataset.v === st.vert && !isList()) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      a.classList.toggle("is-on", a.dataset.v === st.vert);
    });
    $("#adz-lang").textContent = st.lang === "te" ? "English" : "తెలుగు";
    $("#adz-lang").setAttribute("aria-pressed", st.lang === "te");
    $("#adz-wc").textContent = st.wish.size;
    $("#adz-q").placeholder = st.lang === "te" ? "Products, brands కోసం search చేయండి" : "Search for products, brands and more";
  }

  /* top-level ancestor and full chain of a category */
  function chain(slug) { var out = [], c = catRow(slug), guard = 0; while (c && guard++ < 6) { out.unshift(c); c = c[3] ? catRow(c[3]) : null; } return out; }
  function cName(c) { return st.lang === "te" ? c[2] : c[1]; }

  function buildStrip() {
    var strip = $("#adz-strip");
    var show = isList() || st.vert === "main" || st.vert === "shopping";
    strip.hidden = !show || !tops().length;
    if (strip.hidden) return;
    var topOn = isList() && st.cat !== "all" ? (chain(st.cat)[0] || [])[0] : "";
    var items = tops().map(function (c, i) {
      var t = TINTS[i % TINTS.length], subs = children(c[0]);
      return '<div class="adz-ci' + (subs.length ? " has-sub" : "") + '" data-top="' + esc(c[0]) + '">' +
        '<a class="adz-cia" href="#c/' + esc(c[0]) + '"' + (topOn === c[0] ? ' aria-current="true"' : "") + (subs.length ? ' aria-haspopup="true"' : "") + '>' +
          '<span class="adz-cic" style="background:' + t[0] + ';color:' + t[1] + '">' + svg(CI[iconFor(c[0], c[1])]) + '</span>' +
          '<span class="adz-cil">' + esc(cName(c)) + (subs.length ? svg(CI.chev, 14) : "") + '</span></a></div>';
    }).join("");
    if (VERTS.travel) {
      var t = TINTS[(tops().length) % TINTS.length];
      items += '<div class="adz-ci"><a class="adz-cia" href="#travel"><span class="adz-cic" style="background:' + t[0] + ';color:' + t[1] + '">' + svg(CI.plane) + '</span><span class="adz-cil">' + tl("travelS") + '</span></a></div>';
    }
    strip.innerHTML = '<div class="adz-stripwrap"><button type="button" class="adz-sarrow adz-sl" aria-label="' + tl("prev") + '" hidden>‹</button>' +
      '<div class="adz-stripin" id="adz-stripin">' + items + '</div>' +
      '<button type="button" class="adz-sarrow adz-sr" aria-label="' + tl("next") + '">›</button></div>' +
      '<div class="adz-mega" id="adz-mega" hidden></div>';
    initStrip();
  }

  /* Mega menu (desktop): subcategories as columns, child categories under each. */
  function megaHtml(slug) {
    var top = catRow(slug); if (!top) return "";
    var cols = children(slug).map(function (sc) {
      var kids = children(sc[0]), more = kids.length > 8;
      return '<div class="adz-mcol"><a class="adz-mh" href="#c/' + esc(sc[0]) + '">' + esc(cName(sc)) + '</a>' +
        kids.slice(0, 8).map(function (k) { return '<a href="#c/' + esc(k[0]) + '">' + esc(cName(k)) + '</a>'; }).join("") +
        (more ? '<a class="adz-mmore" href="#c/' + esc(sc[0]) + '">' + tl("viewAll") + ' (' + kids.length + ') →</a>' : "") + '</div>';
    }).join("");
    return '<div class="adz-mtop"><a href="#c/' + esc(slug) + '">' + esc(cName(top)) + ' · ' + tl("viewAll") + ' →</a></div><div class="adz-mgrid">' + cols + '</div>';
  }
  function initStrip() {
    var nav = $("#adz-strip"), row = $("#adz-stripin"), mega = $("#adz-mega"), l = nav.querySelector(".adz-sl"), r = nav.querySelector(".adz-sr");
    function arrows() { l.hidden = row.scrollLeft < 8; r.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8; }
    l.addEventListener("click", function () { row.scrollBy({ left: -row.clientWidth * 0.8, behavior: "smooth" }); });
    r.addEventListener("click", function () { row.scrollBy({ left: row.clientWidth * 0.8, behavior: "smooth" }); });
    row.addEventListener("scroll", arrows, { passive: true });
    arrows();
    var desk = window.matchMedia && window.matchMedia("(hover: hover) and (min-width: 900px)").matches;
    if (!desk) return;
    var timer = null, cur = "";
    function open(slug, item) {
      clearTimeout(timer);
      if (cur !== slug) { mega.innerHTML = megaHtml(slug); cur = slug; }
      mega.hidden = false;
      row.querySelectorAll(".adz-ci").forEach(function (x) { x.classList.toggle("is-open", x === item); });
    }
    function close() { timer = setTimeout(function () { mega.hidden = true; cur = ""; row.querySelectorAll(".is-open").forEach(function (x) { x.classList.remove("is-open"); }); }, 180); }
    row.querySelectorAll(".adz-ci.has-sub").forEach(function (item) {
      item.addEventListener("mousemove", function () { if (cur !== item.dataset.top || mega.hidden) open(item.dataset.top, item); });
      item.addEventListener("focusin", function () { open(item.dataset.top, item); });
    });
    row.querySelectorAll(".adz-ci:not(.has-sub)").forEach(function (item) { item.addEventListener("mouseenter", close); });
    nav.addEventListener("mouseleave", close);
    mega.addEventListener("mouseenter", function () { clearTimeout(timer); });
    mega.addEventListener("click", function (e) { if (e.target.closest("a")) { mega.hidden = true; cur = ""; } });
    nav.addEventListener("keydown", function (e) { if (e.key === "Escape") { mega.hidden = true; cur = ""; } });
  }

  /* ---------- banners ---------- */
  function stuCat() { return ["student", "books-and-stationery"].filter(function (s) { return catRow(s); })[0] || ""; }
  function defaultBanners(v) {
    var te = st.lang === "te";
    var B = {
      welcome: { e: "Adyzio", h: te ? "ఇండియాలోని మంచి డీల్స్ అన్నీ, చెక్ చేసి మీకు అందిస్తాం." : "Every good deal in India, checked before it reaches you.", p: te ? "Amazon, Flipkart, Myntra ఇంకా మరెన్నో ఒకే చోట. కొనడం ఎప్పుడూ store site లోనే." : "Amazon, Flipkart, Myntra and more in one place. You always buy on the store's own site.", b: te ? "అన్ని డీల్స్ చూడండి" : "See all deals", u: "#all", i: "tag" },
      shop: { e: vName("shopping"), h: te ? "Amazon, Flipkart, Myntra లో తెలివిగా కొనండి" : "Shop smart across Amazon, Flipkart, Myntra and more", p: te ? "ప్రతి card ఎవరికి సరిపోతుందో చెబుతుంది. కొనే ముందు store లో తాజా ధర చూడండి." : "Every card says who the product suits. Check the latest price on the store before you pay.", b: te ? "అన్ని డీల్స్ చూడండి" : "Browse all deals", u: "#all", i: "bag" },
      student: { e: catName(stuCat()) || "Student Essentials", h: te ? "Calculators, study lamps, bags, exam books" : "Calculators, study lamps, bags and exam books", p: te ? "విద్యార్థులు, ఉద్యోగార్థుల కోసం ఎంచుకున్నవి. కొనే ముందు చెక్ చేయాల్సినవి కూడా." : "Picked for students and job seekers, with what to check before you buy.", b: te ? "ఇప్పుడే చూడండి" : "Shop now", u: "#c/" + stuCat(), i: "cap" },
      tg: { e: "Telegram · WhatsApp", h: te ? "లూట్ డీల్స్ అయిపోకముందే పొందండి" : "Get loot deals before they sell out", p: te ? "Telegram, WhatsApp లో Adyzio లో చేరండి. రోజుకు కొన్ని మంచి picks, spam లేదు." : "Join Adyzio on Telegram and WhatsApp. A few useful picks a day, no spam.", b: te ? "Telegram లో చేరండి" : "Join Telegram", u: "telegram", i: "send" },
      more: { e: tl("moreT"), h: te ? "ప్రయాణం, క్రెడిట్ కార్డులు, హోస్టింగ్ ఆఫర్లు" : "Travel, credit card and web hosting offers", p: te ? "ఫ్లైట్స్, హోటల్స్, కార్డులు, హోస్టింగ్ నమ్మకమైన brands నుండి." : "Flights, hotels, cards and hosting from trusted brands, in one place.", b: te ? "ప్రయాణం చూడండి" : "Explore travel", u: "#travel", i: "plane" },
      travel: { e: vName("travel"), h: te ? "ఫ్లైట్స్, హోటల్స్, హాలిడేస్" : "Flights, hotels and holidays", p: te ? "నమ్మకమైన travel sites లో బుక్ చేయండి. చెల్లించే ముందు final ధర, fees, cancellation rules చూడండి." : "Book with trusted travel sites. Compare the final price, fees and cancellation rules before you pay.", b: te ? "భాగస్వాములను చూడండి" : "See travel partners", u: "#partners", i: "plane" },
      finance: { e: vName("finance"), h: te ? "క్రెడిట్ కార్డులు, సేవింగ్స్, లోన్ ఆఫర్లు" : "Credit cards, savings and loan offers", p: te ? "Apply చేసే ముందు bank page లో fees, వడ్డీ రేటు, eligibility చదవండి." : "Read the fees, interest rate and eligibility on the bank's page before you apply.", b: te ? "ఆఫర్లు చూడండి" : "See offers", u: "#partners", i: "card" },
      hosting: { e: vName("hosting"), h: te ? "నమ్మకమైన hosting, domains తో మీ website మొదలుపెట్టండి" : "Start your website with trusted hosting and domains", p: te ? "Domains, web hosting, website tools. కొనే ముందు renewal ధర చూడండి." : "Domains, web hosting and website tools. Check the renewal price before you buy.", b: te ? "హోస్టింగ్ డీల్స్ చూడండి" : "See hosting deals", u: "#partners", i: "server" },
      services: { e: vName("services"), h: te ? "యాప్స్, కోర్సులు, ఆన్‌లైన్ సేవలు" : "Apps, courses and online services", p: te ? "Learning, health, recharge ఇంకా మరెన్నో నమ్మకమైన brands నుండి." : "Learning, health, recharge and more from trusted brands.", b: te ? "సేవలు చూడండి" : "See services", u: "#partners", i: "grid" }
    };
    var hasStudent = !!stuCat();
    var sets = {
      main: [B.welcome, hasStudent && B.student, B.tg, B.more],
      shopping: [B.shop, hasStudent && B.student, B.tg],
      travel: [B.travel, B.tg], finance: [B.finance, B.tg], hosting: [B.hosting, B.tg], services: [B.services, B.tg]
    };
    return (sets[v] || sets.main).filter(Boolean);
  }
  function bannersFor(v) {
    var custom = (D.banners || []).filter(function (b) { return b.v === v; }).map(function (b) { return { e: vName(v), h: b.h, p: b.p, b: b.b || tl("explore"), u: b.u, i: VICON[v] || "tag" }; });
    var list = custom.length ? custom : defaultBanners(v);
    if (v === "main" || v === "shopping") {
      var now = Date.now();
      var live = P.filter(function (p) { return p.type === "loot" && p.ends && p.ends > now; }).sort(function (a, b) { return a.ends - b.ends; })[0];
      if (live) list = [{ dotd: live }].concat(list);
    }
    return list;
  }
  function bannerLink(u, cls, label) {
    u = u || "";
    if (u === "telegram" && D.telegram) return '<a class="' + cls + '" href="' + esc(D.telegram) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
    if (u === "whatsapp" && D.whatsapp) return '<a class="' + cls + '" href="' + esc(D.whatsapp) + '" target="_blank" rel="noopener">' + esc(label) + '</a>';
    if (u === "#partners") return '<button type="button" class="' + cls + '" data-scroll="adz-partners">' + esc(label) + '</button>';
    if (u.charAt(0) === "#") return '<a class="' + cls + '" href="' + esc(u) + '">' + esc(label) + '</a>';
    if (safeUrl(u)) return '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="sponsored nofollow noopener">' + esc(label) + '</a>';
    return "";
  }
  var BV = ["adz-bv1", "adz-bv2", "adz-bv3", "adz-bv4"];
  function slideHtml(b, i, n) {
    var art, text;
    if (b.dotd) {
      var p = b.dotd, cd = countdown(p.ends);
      text = '<span class="adz-beye">' + tl("dotd") + (p.s ? " · " + esc(sInfo(p.s).n) : "") + '</span><h2>' + esc(p.t) + '</h2>' +
        (p.good ? '<p>' + esc(p.good) + '</p>' : "") +
        '<div class="adz-bprice">' + (fresh(p) ? '<b>' + inr(p.price) + '</b>' + (p.mrp ? '<s>' + inr(p.mrp) + '</s>' : "") : '<b>' + tl("check") + '</b>') +
        (cd ? '<span class="adz-timer" data-end="' + p.ends + '">' + tl("ends") + " " + cd + '</span>' : "") + '</div>' +
        buyBtn(p, "adz-bcta");
      art = p.img ? '<span class="adz-bimg"><img src="' + esc(p.img) + '" alt="" loading="lazy"></span>' : '<span class="adz-bico">' + svg(CI.tag, 96) + '</span>';
    } else {
      text = '<span class="adz-beye">' + esc(b.e || "Adyzio") + '</span><h2>' + esc(b.h) + '</h2>' + (b.p ? '<p>' + esc(b.p) + '</p>' : "") + bannerLink(b.u, "adz-bcta", b.b);
      art = '<span class="adz-bico">' + svg(CI[b.i] || CI.tag, 96) + '</span>';
    }
    return '<div class="adz-slide ' + BV[i % BV.length] + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + tl("slideOf") + n + '">' +
      '<div class="adz-btext">' + text + '</div><div class="adz-bart" aria-hidden="true"><span class="adz-ring"></span><span class="adz-ring adz-r2"></span>' + art + '</div></div>';
  }
  function buildHero() {
    var list = bannersFor(st.vert), n = list.length, hero = $("#adz-hero");
    hero.innerHTML = '<div class="adz-car"><div class="adz-slides" id="adz-slides" tabindex="0">' + list.map(function (b, i) { return slideHtml(b, i, n); }).join("") + '</div>' +
      (n > 1 ? '<button type="button" class="adz-carb adz-prev" aria-label="' + tl("prev") + '">‹</button><button type="button" class="adz-carb adz-next" aria-label="' + tl("next") + '">›</button>' +
        '<div class="adz-dots">' + list.map(function (_, i) { return '<button type="button" data-dot="' + i + '" aria-label="' + (i + 1) + tl("slideOf") + n + '"' + (i ? "" : ' aria-current="true"') + '></button>'; }).join("") + '</div>' : "") + '</div>';
    initCarousel(n);
  }
  function initCarousel(n) {
    clearInterval(carTimer);
    var track = $("#adz-slides");
    if (!track || n < 2) return;
    var paused = false, idx = 0;
    function go(i) { idx = (i + n) % n; track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" }); }
    track.addEventListener("scroll", function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== idx) idx = i;
      root.querySelectorAll("[data-dot]").forEach(function (d) { if (+d.dataset.dot === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
    }, { passive: true });
    var car = track.parentNode;
    car.querySelector(".adz-prev").addEventListener("click", function () { go(idx - 1); });
    car.querySelector(".adz-next").addEventListener("click", function () { go(idx + 1); });
    car.querySelectorAll("[data-dot]").forEach(function (d) { d.addEventListener("click", function () { go(+d.dataset.dot); }); });
    ["mouseenter", "focusin", "touchstart"].forEach(function (e) { car.addEventListener(e, function () { paused = true; }, { passive: true }); });
    ["mouseleave", "focusout"].forEach(function (e) { car.addEventListener(e, function () { paused = false; }); });
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    carTimer = setInterval(function () { if (!paused && !document.hidden) go(idx + 1); }, 5000);
  }

  /* ---------- home panels ---------- */
  function panel(title, inner, opts) {
    opts = opts || {};
    return '<section class="adz-wrap adz-psec"' + (opts.id ? ' id="' + opts.id + '"' : "") + '><div class="adz-panel">' +
      '<div class="adz-phead"><div class="adz-ptitle"><h2>' + title + '</h2>' + (opts.sub ? '<span class="adz-psub">' + opts.sub + '</span>' : "") + (opts.chip || "") + '</div>' +
        (opts.more ? '<a class="adz-pmore" href="' + esc(opts.more) + '" aria-label="' + tl("viewAll") + ': ' + title + '"><span>' + tl("viewAll") + '</span><i>' + svg(CI.arrow, 18) + '</i></a>' : "") + '</div>' +
      (opts.subs || "") + inner + '</div></section>';
  }
  function track(list) { return '<div class="adz-track">' + list.map(card).join("") + '</div>'; }
  function storeTile(k, v) {
    var s = STORES[k], link = safeUrl(s.link);
    return '<div class="adz-stile"><div class="adz-slogo">' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="' + esc(s.n) + '" loading="lazy">' : '<span class="adz-stxt">' + esc(s.n) + '</span>') + '</div>' +
      '<div class="adz-sname" title="' + esc(s.n) + '">' + esc(s.n) + '</div>' +
      (link ? '<a class="adz-buy" href="' + esc(link) + '" target="_blank" rel="sponsored nofollow noopener">' + vAction(v || s.v) + '</a>'
            : '<button type="button" class="adz-buy" data-sd="' + esc(k) + '">' + tl("seeDeals") + '</button>') + '</div>';
  }
  function vCards(except) {
    return '<div class="adz-vcards">' + ["travel", "finance", "hosting", "services", "shopping"].filter(function (v) { return VERTS[v] && v !== except; }).slice(0, 4).map(function (v, i) {
      var t = TINTS[(i + 1) % TINTS.length];
      return '<a class="adz-vcard" href="#' + v + '"><span class="adz-cic" style="background:' + t[0] + ';color:' + t[1] + '">' + svg(CI[VICON[v]]) + '</span>' +
        '<span class="adz-vct"><b>' + esc(vName(v)) + '</b><span>' + esc(VDESC[v][st.lang === "te" ? 1 : 0]) + '</span></span><em>' + svg(CI.arrow, 18) + '</em></a>';
    }).join("") + '</div>';
  }
  function soonPanel(title, text) {
    var tip = D.isAdmin ? '<p class="adz-tip">' + tl("adminTip") + ' <a href="' + esc(D.setUrl) + '">Settings → Adyzio</a></p>' : "";
    return '<div class="adz-soon"><span class="adz-cic">' + svg(CI.send) + '</span><div><h3>' + title + '</h3><p>' + text + '</p>' +
      (D.telegram ? '<a class="adz-buy adz-inline" href="' + esc(D.telegram) + '" target="_blank" rel="noopener">' + (st.lang === "te" ? "Telegram లో చేరండి" : "Join Telegram") + '</a>' : "") + tip + '</div></div>';
  }

  function blocksShopping(isMain) {
    var pool = P.filter(function (p) { return isMain || dealVert(p) === "shopping"; });
    var html = "";
    if (!pool.length) {
      html += panel(tl("soonT"), soonPanel(tl("soonT"), tl("soonP")));
    } else {
      var now = Date.now();
      var dotd = pool.slice().sort(function (a, b) { return ((b.type === "loot" || b.type === "today") - (a.type === "loot" || a.type === "today")) || newest(a, b); }).slice(0, PER_ROW);
      var soon = pool.filter(function (p) { return p.ends && p.ends > now; }).sort(function (a, b) { return a.ends - b.ends; })[0];
      html += panel(tl("dotdT"), track(dotd), { more: "#all", chip: soon ? '<span class="adz-cd" data-end="' + soon.ends + '">' + tl("ends") + " " + countdown(soon.ends) + '</span>' : "" });
    }
    var rows = [];
    tops().forEach(function (c) {
      var slug = c[0], inTop = pool.filter(function (p) { return inCat(p, slug); });
      if (!inTop.length || slug === "deals") return;
      var subs = children(slug).filter(function (sc) { return inTop.some(function (p) { return inCat(p, sc[0]); }); });
      var active = rowSub[slug] && subs.some(function (sc) { return sc[0] === rowSub[slug]; }) ? rowSub[slug] : "";
      var list = (active ? inTop.filter(function (p) { return inCat(p, active); }) : inTop).slice().sort(newest).slice(0, PER_ROW);
      var chips = subs.length ? '<div class="adz-subs"><button type="button" class="adz-chip" data-rs="' + esc(slug) + '" data-sub="" aria-pressed="' + (!active) + '">' + tl("allIn") + '</button>' +
        subs.map(function (sc) { return '<button type="button" class="adz-chip" data-rs="' + esc(slug) + '" data-sub="' + esc(sc[0]) + '" aria-pressed="' + (active === sc[0]) + '">' + esc(st.lang === "te" ? sc[2] : sc[1]) + '</button>'; }).join("") + '</div>' : "";
      rows.push(panel(esc(tl("bestOf") + (st.lang === "te" ? c[2] : c[1])), track(list), { more: "#c/" + (active || slug), subs: chips, id: "adz-row-" + slug }));
    });
    var budget = panel(tl("budgetT"), '<div class="adz-budget">' + [199, 499, 999, 1999].map(function (u, i) {
      return '<button type="button" class="adz-btile adz-bt' + (i + 1) + '" data-u="' + u + '"><span>' + tl("under") + '</span><b>' + inr(u) + '</b></button>';
    }).join("") + '</div>', { sub: tl("budgetP") });
    var withDeal = {};
    pool.forEach(function (p) { if (p.s) withDeal[p.s] = 1; });
    var shopStores = Object.keys(STORES).filter(function (k) { return STORES[k].v === "shopping" && (safeUrl(STORES[k].link) || withDeal[k]); })
      .sort(function (a, b) { return ((TOP.indexOf(a) + 1) || 999) - ((TOP.indexOf(b) + 1) || 999) || STORES[a].n.localeCompare(STORES[b].n); });
    var stores = shopStores.length ? panel(tl("storesT"), '<div class="adz-sgrid">' + shopStores.map(function (k) { return storeTile(k, "shopping"); }).join("") + '</div>') : "";
    /* budget after the 1st category row, stores after the 2nd */
    var mid = [];
    rows.forEach(function (r, i) { mid.push(r); if (i === 0 && pool.length) mid.push(budget); if (i === 1) mid.push(stores); });
    if (rows.length < 1 && pool.length) mid.push(budget);
    if (rows.length < 2) mid.push(stores);
    html += mid.join("");
    if (isMain) html += panel(tl("moreT"), vCards("main"));
    return html;
  }

  function blocksVertical(v) {
    var name = esc(vName(v)), html = "";
    var partners = Object.keys(STORES).filter(function (k) { return STORES[k].v === v && safeUrl(STORES[k].link); }).sort(function (a, b) { return STORES[a].n.localeCompare(STORES[b].n); });
    html += panel(name + tl("partners"), partners.length ? '<div class="adz-sgrid">' + partners.map(function (k) { return storeTile(k, v); }).join("") + '</div>' : soonPanel(name + tl("soonV"), tl("soonVP")), { id: "adz-partners" });
    var deals = P.filter(function (p) { return dealVert(p) === v; }).sort(newest).slice(0, PER_ROW);
    if (deals.length) html += panel(tl("latestIn") + " · " + name, track(deals));
    html += panel(tl("moreT"), vCards(v));
    return html;
  }

  function buildBlocks() {
    $("#adz-blocks").innerHTML = (st.vert === "main" || st.vert === "shopping") ? blocksShopping(st.vert === "main") : blocksVertical(st.vert);
  }

  /* ---------- category page (list view) ---------- */
  function isList() { return st.mode === "list" || st.q.trim() !== ""; }
  function filtered() {
    var q = st.q.trim().toLowerCase();
    var r = P.filter(function (p) {
      var price = fresh(p) ? p.price : null;
      return (st.cat === "all" || inCat(p, st.cat)) &&
        (!st.stores.size || st.stores.has(p.s)) &&
        (!st.types.size || st.types.has(p.type)) &&
        (!q || (p.t + " " + p.good + " " + sInfo(p.s).n + " " + (p.cats || []).map(catName).join(" ")).toLowerCase().indexOf(q) > -1) &&
        (st.min === "" || (price != null && price >= +st.min)) &&
        (st.max === "" || (price != null && price <= +st.max)) &&
        (!st.under || (price != null && price < st.under)) &&
        off(p) >= st.minoff &&
        (!st.onlyWish || st.wish.has(p.id));
    });
    var by = {
      "new": newest,
      off: function (a, b) { return off(b) - off(a); },
      low: function (a, b) { return (fresh(a) ? a.price : 1e12) - (fresh(b) ? b.price : 1e12); },
      high: function (a, b) { return (fresh(b) ? b.price : -1) - (fresh(a) ? a.price : -1); }
    };
    return r.sort(by[st.sort] || newest);
  }
  function buildList() {
    var r = filtered(), q = st.q.trim(), cur = catRow(st.cat), ch = cur ? chain(st.cat) : [];
    var title = q ? tl("resultsFor") + " “" + q + "”" : st.onlyWish ? tl("saved") : st.cat === "all" ? tl("all") : catName(st.cat);
    if (!q && st.stores.size === 1) title += " · " + sInfo(Array.from(st.stores)[0]).n;
    var crumbs = '<a href="#adyzio">' + tl("home") + '</a>' + ch.slice(0, -1).map(function (c) { return '<span>›</span><a href="#c/' + esc(c[0]) + '">' + esc(cName(c)) + '</a>'; }).join("") + '<span>›</span><b>' + esc(title) + '</b>';
    $("#adz-crumbs").innerHTML = crumbs;
    $("#adz-gtitle").textContent = title;
    $("#adz-count").textContent = r.length + " " + (r.length === 1 ? tl("deal1") : tl("results"));
    var base = cur ? (children(cur[0]).length ? cur[0] : (cur[3] || cur[0])) : "";
    var subs = base ? children(base) : [];
    $("#adz-subs").innerHTML = subs.length && !q ? '<a class="adz-chip" href="#c/' + esc(base) + '"' + (st.cat === base ? ' aria-current="true"' : "") + '>' + tl("allIn") + '</a>' +
      subs.map(function (sc) { return '<a class="adz-chip" href="#c/' + esc(sc[0]) + '"' + (st.cat === sc[0] ? ' aria-current="true"' : "") + '>' + esc(st.lang === "te" ? sc[2] : sc[1]) + '</a>'; }).join("") : "";
    $("#adz-quick").innerHTML = [199, 499, 999, 1999].map(function (u) { return '<button type="button" class="adz-qk" data-uq="' + u + '" aria-pressed="' + (st.under === u) + '">' + (st.lang === "te" ? inr(u) + " " + tl("under") : tl("under") + " " + inr(u)) + '</button>'; }).join("");
    var empty = st.onlyWish ? tl("savedNone") : (P.some(function (p) { return st.cat === "all" || inCat(p, st.cat); }) ? tl("none") : tl("catSoon"));
    fetchMore();
    $("#adz-grid").innerHTML = r.length ? r.map(card).join("") : '<div class="adz-empty">' + empty + '</div>';
  }

  /* ---------- load more products from the site for category pages and search ---------- */
  var fetched = {}, fetchTimer = null;
  function fetchMore() {
    if (!D.ajax || st.onlyWish) return;
    var q = st.q.trim(), key = st.cat + "|" + q.toLowerCase();
    if ((st.cat === "all" && !q) || fetched[key]) return;
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(function () {
      fetched[key] = true;
      var url = D.ajax + "?action=adyzio_list&cat=" + encodeURIComponent(st.cat) + "&q=" + encodeURIComponent(q);
      fetch(url, { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (r) {
        var have = {}, added = 0;
        P.forEach(function (p) { have[p.id] = 1; });
        (r.deals || []).forEach(function (p) { if (!have[p.id]) { P.push(p); added++; } });
        if (added && isList() && st.cat + "|" + st.q.trim().toLowerCase() === key) buildList();
      }).catch(function () { fetched[key] = false; });
    }, q ? 400 : 0);
  }

  /* ---------- render + routing ---------- */
  function renderView(doScroll) {
    var list = isList();
    $("#adz-homeview").hidden = list;
    $("#adz-list").hidden = !list;
    buildChrome();
    buildStrip();
    if (list) { clearInterval(carTimer); buildList(); }
    else { buildHero(); buildBlocks(); }
    if (doScroll !== false && list !== wasList) root.scrollIntoView({ block: "start" });
    wasList = list;
  }
  function resetFilters() { st.stores.clear(); st.types.clear(); st.min = ""; st.max = ""; st.minoff = 0; st.under = 0; st.onlyWish = false; syncInputs(); }
  function syncInputs() {
    $("#adz-pmin").value = st.min; $("#adz-pmax").value = st.max; $("#adz-minoff").value = String(st.minoff); $("#adz-sort").value = st.sort;
    root.querySelectorAll(".adz-ft").forEach(function (x) { x.checked = st.types.has(x.value); });
  }
  function route() {
    var h = decodeURIComponent((location.hash || "").slice(1));
    var listRoute = h === "all" || h === "saved" || h.indexOf("c/") === 0;
    if (listRoute) {
      if (!keepFilters) resetFilters();
      keepFilters = false;
      st.mode = "list";
      if (h === "saved") { st.cat = "all"; st.onlyWish = true; }
      else st.cat = h === "all" ? "all" : (catRow(h.slice(2)) ? h.slice(2) : "all");
    } else if (h === "" || h === "adyzio" || VERTS[h]) {
      st.vert = VERTS[h] ? h : "main"; st.mode = "home"; st.cat = "all"; st.onlyWish = false;
      if (st.q) { st.q = ""; $("#adz-q").value = ""; }
    } else return; /* some other anchor on the page */
    if (booted) wasList = !isList(); /* scroll to the top of the app on every navigation, but not on first load */
    renderView(booted);
  }
  function goList(hash) { keepFilters = true; if (location.hash === hash) route(); else location.hash = hash; }

  /* ---------- modal ---------- */
  function find(id) { return P.filter(function (p) { return String(p.id) === String(id); })[0]; }
  function openSheet(html) { $("#adz-sheet").innerHTML = html; $("#adz-scrim").hidden = false; var c = $("#adz-closeM"); if (c) c.focus(); }
  function closeSheet() { $("#adz-scrim").hidden = true; }
  function openDetails(id) {
    var p = find(id); if (!p) return;
    var o = off(p), f = fresh(p), s = sInfo(p.s);
    openSheet(
      (p.s ? '<div class="adz-meta"><span class="adz-dot" style="background:' + esc(s.c) + '"></span>' + esc(s.n) + '</div>' : "") +
      '<h3 id="adz-mT">' + esc(p.t) + '</h3>' +
      (p.good ? '<div class="adz-good"><b>' + tl("good") + ':</b> ' + esc(p.good) + '</div>' : "") +
      (f ? '<div class="adz-price"><b>' + inr(p.price) + '</b>' + (p.mrp ? '<s>' + inr(p.mrp) + '</s>' : "") + (o ? '<span style="color:var(--good);font-weight:700">' + o + '% off</span>' : "") + '</div><div class="adz-checked">' + tl("checked") + " " + new Date(p.checked).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) + '</div>'
         : '<div class="adz-checkp">' + tl("check") + '</div>') +
      (p.check && p.check.length ? '<div><strong>' + tl("before") + '</strong><ul>' + p.check.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join("") + '</ul></div>' : "") +
      '<div class="adz-row">' + buyBtn(p) + '<a class="adz-ghost" href="' + esc(p.url) + '">' + tl("fullPost") + '</a><button type="button" class="adz-ghost" id="adz-closeM">' + tl("close") + '</button></div>' +
      shareBlock(p) +
      '<div class="adz-checked">As an Amazon Associate I earn from qualifying purchases. Other store links earn through ExtraPe.</div>'
    );
  }
  function openShare(id) {
    var p = find(id); if (!p) return;
    openSheet(
      '<h3 id="adz-mT">' + tl("shareVia") + '</h3><div class="adz-good">' + esc(p.t) + '</div>' +
      '<div class="adz-shopts">' +
        '<a class="adz-shopt" href="' + esc(waHref(p)) + '" target="_blank" rel="noopener"><i style="background:#1fa855">' + ICO.wa + '</i><span>WhatsApp<small>' + tl("waSub") + '</small></span></a>' +
        '<a class="adz-shopt" href="' + esc(tgHref(p)) + '" target="_blank" rel="noopener"><i style="background:#229ED9">' + ICO.tg + '</i><span>Telegram<small>' + tl("tgSub") + '</small></span></a>' +
        '<a class="adz-shopt" href="' + esc(mailHref(p)) + '"><i style="background:#5b5f97">' + ICO.mail + '</i><span>Email<small>' + tl("mailSub") + '</small></span></a>' +
      '</div>' +
      '<div class="adz-shurl">' + esc(shareUrl(p, "copy")) + '</div>' +
      '<div class="adz-row"><button type="button" class="adz-cpy" data-copy="' + p.id + '" style="flex:1">' + ICO.copy + tl("copyLink") + '</button><button type="button" class="adz-ghost" id="adz-closeM">' + tl("close") + '</button></div>'
    );
  }
  function toast(m) { var t = $("#adz-toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 1800); }

  /* ---------- events ---------- */
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button,a"); if (!b || !root.contains(b)) return;
    var d = b.dataset;
    if (d.rs !== undefined) { rowSub[d.rs] = d.sub || ""; buildBlocks(); }
    else if (d.u) { st.under = +d.u; goList("#all"); }
    else if (d.uq) { var u = +d.uq; st.under = st.under === u ? 0 : u; buildList(); }
    else if (d.sd) { st.stores = new Set([d.sd]); goList("#all"); }
    else if (d.scroll) { var t = document.getElementById(d.scroll); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (d.w) { var id = +d.w; st.wish.has(id) ? st.wish.delete(id) : st.wish.add(id); lsSet("adz-wish", Array.from(st.wish)); $("#adz-wc").textContent = st.wish.size; if (isList()) buildList(); else buildBlocks(); }
    else if (d.sh) { openShare(d.sh); }
    else if (d.d) { openDetails(d.d); }
    else if (b.id === "adz-closeM") { closeSheet(); }
    else if (d.copy) {
      var p = find(d.copy); if (!p) return; var url = shareUrl(p, "copy");
      try { navigator.clipboard.writeText(url).then(function () { toast(tl("copied")); }, function () { toast(url); }); } catch (err) { toast(url); }
    }
    else if (b.id === "adz-lang") { st.lang = st.lang === "en" ? "te" : "en"; lsSet("adz-lang", st.lang); renderView(); }
    else if (b.id === "adz-reset") { st.q = ""; $("#adz-q").value = ""; resetFilters(); st.sort = "new"; syncInputs(); if (st.mode !== "list") location.hash = "all"; else buildList(); }
  });
  $("#adz-scrim").addEventListener("click", function (e) { if (e.target.id === "adz-scrim") closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  window.addEventListener("hashchange", route);
  $("#adz-q").addEventListener("input", function (e) { st.q = e.target.value; renderView(); });
  $("#adz-pmin").addEventListener("input", function (e) { st.min = e.target.value; buildList(); });
  $("#adz-pmax").addEventListener("input", function (e) { st.max = e.target.value; buildList(); });
  $("#adz-minoff").addEventListener("change", function (e) { st.minoff = +e.target.value; buildList(); });
  $("#adz-sort").addEventListener("change", function (e) { st.sort = e.target.value; buildList(); });
  root.querySelectorAll(".adz-ft").forEach(function (c) { c.addEventListener("change", function () { c.checked ? st.types.add(c.value) : st.types.delete(c.value); buildList(); }); });
  setInterval(function () {
    root.querySelectorAll("[data-end]").forEach(function (el) { var c = countdown(+el.getAttribute("data-end")); el.textContent = c ? tl("ends") + " " + c : tl("ended"); });
  }, 1000);

  route();
  if (!booted) { wasList = isList(); renderView(false); }
  booted = true;
})();
