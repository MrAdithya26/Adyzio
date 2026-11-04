"""
Deal collector for the Adyzio link tool.

Reads deal posts you SAVED from WhatsApp, Telegram, Pinterest or deal websites
(text you copied, chat exports, saved web pages), finds every store link in them,
removes the original poster's affiliate tags, and returns one row per product.

It does not crawl websites or download store pages. The only network call is
optional: following a short link (amzn.to, fkrt.it, bit.ly...) to see which
product it points to.
"""
import html
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

URL_RE = re.compile(r"https?://[^\s<>\"'\)\]\}|]+", re.I)
HREF_RE = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.I)
# WhatsApp "Export chat" line:  02/11/26, 5:12 pm - Name: message   (also [02/11/26, 17:12:05] Name: ...)
WA_HEAD = re.compile(r"^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?[^:]{1,60}:\s?", re.I)
PRICE_RE = re.compile(r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)", re.I)
MRP_RE = re.compile(r"(?:mrp|m\.r\.p|was|original)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)", re.I)

# Someone else's affiliate / tracking parameters: always removed, so only YOUR ID ends up on the link.
FOREIGN_PARAMS = {
    "tag", "ascsubtag", "linkcode", "linkid", "creative", "creativeasin", "camp", "ref_", "ref",
    "affid", "affextparam1", "affextparam2", "affiliate_id", "aff_id", "subid", "sub_id",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid",
    "clickid", "click_id", "pid_source", "cmpid", "extrape", "earnkaro", "ek_id",
}
# Store links worth keeping
STORE_HINTS = ("amazon.", "amzn.", "flipkart.", "fkrt.", "myntra.", "myntr.", "ajio.", "meesho.",
               "shopsy.", "nykaa.", "tatacliq.", "croma.", "jiomart.", "boat-lifestyle.", "decathlon.",
               "pepperfry.", "snapdeal.", "firstcry.", "lenskart.", "mamaearth.")
# Links that are never products
SKIP_HOSTS = ("t.me", "telegram.me", "chat.whatsapp.com", "whatsapp.com", "wa.me", "instagram.com",
              "youtube.com", "youtu.be", "facebook.com", "fb.me", "twitter.com", "x.com", "pinterest.",
              "pin.it", "play.google.com", "apps.apple.com")
SHORT_HOSTS = ("amzn.to", "amzn.in", "amzn.eu", "fkrt.it", "fkrt.cc", "fkrt.co", "fktr.in", "myntr.it",
               "bit.ly", "bitli.in", "tinyurl.com", "cutt.ly", "ekaro.in", "earnkaro", "extp.in",
               "linkredirect.in", "inr.deals", "wishlink.com", "dl.flipkart.com", "clnk.in", "shorturl.at",
               "rb.gy", "t.ly", "is.gd", "ow.ly")


def host(u):
    try:
        return (urlparse(u).hostname or "").lower()
    except ValueError:
        return ""


def is_short(u):
    h = host(u)
    return any(h == s or h.endswith("." + s) or s in h for s in SHORT_HOSTS)


def strip_foreign(u):
    """Remove every affiliate/tracking parameter that is not part of the product's identity."""
    p = urlparse(u)
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
         if k.lower() not in FOREIGN_PARAMS and not k.lower().startswith(("pf_rd_", "pd_rd_", "utm_"))]
    path = p.path
    if "amazon." in (p.hostname or ""):
        path = re.sub(r"/ref=[^/]*$", "", path)  # amazon puts referral info in the path too
    return urlunparse((p.scheme or "https", p.netloc, path, "", urlencode(q), ""))


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def expand(u, timeout=8, hops=6):
    """Follow redirects of a short link without loading the final page. Returns final URL or None."""
    opener = build_opener(_NoRedirect)
    cur = u
    for _ in range(hops):
        try:
            req = Request(cur, method="HEAD", headers={"User-Agent": "Mozilla/5.0 AdyzioLinkTool"})
            r = opener.open(req, timeout=timeout)
            return cur  # 200: we are at the destination
        except Exception as e:
            loc = getattr(e, "headers", None) and e.headers.get("Location")
            code = getattr(e, "code", None)
            if code in (301, 302, 303, 307, 308) and loc:
                if loc.startswith("/"):
                    p = urlparse(cur); loc = f"{p.scheme}://{p.netloc}{loc}"
                cur = loc
                if not is_short(cur) and any(s in host(cur) for s in STORE_HINTS):
                    return cur
                continue
            if code in (403, 405, 404) and cur != u:
                return cur
            return None
    return cur


def product_key(store, u):
    """Same product → same key, so duplicates from different channels merge."""
    if store == "amazon":
        m = re.search(r"/(?:dp|gp/product|gp/aw/d)/([A-Z0-9]{10})", u, re.I)
        if m:
            return "amazon:" + m.group(1).upper()
    q = dict(parse_qsl(urlparse(u).query))
    if store in ("flipkart", "shopsy") and q.get("pid"):
        return f"{store}:{q['pid']}"
    m = re.search(r"/(?:p|buy|product)/([A-Za-z0-9_-]{6,})", urlparse(u).path)
    if m:
        return f"{store}:{m.group(1)}"
    return f"{store}:{urlparse(u).netloc}{urlparse(u).path}".rstrip("/")


# ------------------------------------------------------------- reading sources
def _telegram_json_posts(data):
    msgs = data.get("messages") if isinstance(data, dict) else None
    if msgs is None and isinstance(data, list):
        msgs = data
    for m in msgs or []:
        if not isinstance(m, dict):
            continue
        parts, links = [], []
        t = m.get("text", "")
        for part in (t if isinstance(t, list) else [t]):
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
                if part.get("href"):
                    links.append(part["href"])
        for e in m.get("text_entities", []) or []:
            if isinstance(e, dict) and e.get("href"):
                links.append(e["href"])
        txt = "".join(parts)
        yield {"text": txt + "\n" + "\n".join(links), "date": (m.get("date") or "")[:10]}


def read_posts(path: Path):
    """Yield {'text','date','source'} per post from .txt / .json / .html / .csv files."""
    raw = path.read_text(encoding="utf-8", errors="ignore")
    src = path.stem
    suf = path.suffix.lower()
    if suf == ".json":
        try:
            data = json.loads(raw)
            src = data.get("name", src) if isinstance(data, dict) else src
            for p in _telegram_json_posts(data):
                p["source"] = src
                yield p
            return
        except json.JSONDecodeError:
            pass
    if suf in (".html", ".htm"):
        # Telegram Desktop HTML export / saved deal page: split per message block when possible
        blocks = re.split(r'<div class="message default', raw) if 'class="message default' in raw else [raw]
        for b in blocks:
            links = HREF_RE.findall(b)
            text = html.unescape(re.sub(r"<[^>]+>", "\n", b))
            yield {"text": text + "\n" + "\n".join(links), "date": "", "source": src}
        return
    # plain text: WhatsApp export or pasted posts separated by blank lines
    lines = raw.splitlines()
    if sum(1 for l in lines[:50] if WA_HEAD.match(l)) >= 3:
        cur, date = [], ""
        for l in lines:
            m = WA_HEAD.match(l)
            if m:
                if cur:
                    yield {"text": "\n".join(cur), "date": date, "source": src}
                d = re.match(r"\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", l)
                date = ""
                if d:
                    dd, mm, yy = d.groups(); yy = ("20" + yy) if len(yy) == 2 else yy
                    date = f"{yy}-{int(mm):02d}-{int(dd):02d}"
                cur = [l[m.end():]]
            else:
                cur.append(l)
        if cur:
            yield {"text": "\n".join(cur), "date": date, "source": src}
        return
    for chunk in re.split(r"\n\s*\n", raw):
        if chunk.strip():
            yield {"text": chunk, "date": "", "source": src}


# ------------------------------------------------------------- post → rows
SKIP_LINE = re.compile(r"(?i)^(join|follow|share|click|buy now|buy here|link|grab|hurry|loot|deal alert|shop now|price|mrp|offer price|deal price)\b")


def _title_from(text):
    """First line that reads like a product name (no link, no price-only line, no 'join us')."""
    for l in text.splitlines():
        l = URL_RE.sub("", l)
        l = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200d]", "", l).strip(" -*_~•|:>")
        if len(l) < 8 or SKIP_LINE.match(l):
            continue
        if PRICE_RE.sub("", l).strip(" @-:/") == "":
            continue
        return l[:200]
    return ""


def _prices(text):
    mrp = None
    m = MRP_RE.search(text)
    if m:
        mrp = m.group(1).replace(",", "")
    nums = [p.replace(",", "") for p in PRICE_RE.findall(text)]
    price = next((n for n in nums if n != mrp), None)
    if price and mrp:
        try:
            if float(price) > float(mrp):
                price, mrp = mrp, price
        except ValueError:
            pass
    return price, mrp


def rows_from_post(post, detect_store, expand_links=True, cache=None):
    cache = {} if cache is None else cache
    text = post["text"]
    urls = []
    for u in URL_RE.findall(text):
        u = u.rstrip(".,;!*_~")
        if any(s in host(u) for s in SKIP_HOSTS):
            continue
        urls.append(u)
    out = []
    title = _title_from(text)
    price, mrp = _prices(text)
    one_product = len(urls) == 1
    for u in dict.fromkeys(urls):
        final = u
        if is_short(u):
            if not expand_links:
                final = None
            else:
                if u not in cache:
                    cache[u] = expand(u)
                final = cache[u]
        if not final:
            out.append({"raw_url": u, "problem": "short link not opened (run without --no-expand, or open it and paste the store link)"})
            continue
        if not any(s in host(final) for s in STORE_HINTS):
            continue  # not a store link (e.g. a blog), skip
        clean = strip_foreign(final)
        store = detect_store(clean)
        if "shopsy." in host(clean):
            store = "shopsy"
        out.append({
            "raw_url": u, "source_url": clean, "store": store,
            "key": product_key(store, clean),
            "title": title if one_product else "",
            "price_seen": price if one_product else "", "mrp_seen": mrp if one_product else "",
            "date": post.get("date", ""), "source": post.get("source", ""),
        })
    return out
