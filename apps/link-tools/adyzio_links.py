#!/usr/bin/env python3
"""
Adyzio link tool - turns your Link Sheet into an import file for adyzio.com.

Steps (each is one command):
  convert   Clean product links, detect the store, add your Amazon tag.
            Non-Amazon links are marked CONVERT_IN_EXTRAPE.
  validate  Check every row before import (tags, categories, prices, fields).
  export    Write the CSV that Admin -> Import / Export on adyzio.com accepts.
  captions  Make Telegram / WhatsApp / Instagram / Facebook / X / Threads /
            Pinterest text from the site's product export.

Rules built in:
  * It never invents a tracking ID. Your Amazon tag comes from config.json.
  * It never fetches or copies store pages, prices or photos. It works only
    on links and text you put in the sheet.
  * A price needs a price_checked_on date; old prices are flagged.

Python 3.8+, standard library only. Run:  python3 adyzio_links.py --help
"""
import argparse
import csv
import datetime as dt
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

# Columns of the Link Sheet (Google Sheet / CSV). Order matters only for output.
SHEET_COLS = [
    "status", "source_url", "store", "affiliate_url", "title", "category",
    "brand", "price", "mrp", "price_checked_on", "image", "gallery",
    "video_url", "short_desc", "features", "description", "is_deal",
    "is_featured", "is_active", "deal_type", "deal_ends", "added_on",
    "posted_channels", "notes",
]

# Exactly the columns admin/import.php reads (adyzio website v1.x).
IMPORT_COLS = [
    "title", "affiliate_url", "store", "category", "brand", "price", "mrp",
    "image", "gallery", "video_url", "short_desc", "features", "description",
    "is_deal", "is_featured", "is_active",
]

STORE_HOSTS = {
    "amazon": ["amazon.", "amzn.to", "amzn.in", "amzn.eu"],
    "flipkart": ["flipkart.", "fkrt.it", "fkrt.cc", "fkrt.co", "dl.flipkart"],
    "myntra": ["myntra.", "myntr.it"],
    "meesho": ["meesho."],
    "ajio": ["ajio."],
    "nykaa": ["nykaa."],
    "tatacliq": ["tatacliq."],
    "croma": ["croma."],
}
STORES = list(STORE_HOSTS) + ["other"]

# Tracking parameters that are safe to drop from a source (non-affiliate) link.
JUNK_PARAMS = {
    "ref", "ref_", "pf_rd_r", "pf_rd_p", "pf_rd_m", "pf_rd_s", "pf_rd_t",
    "pf_rd_i", "pd_rd_r", "pd_rd_w", "pd_rd_wg", "pd_rd_i", "psc", "th",
    "qid", "sr", "keywords", "crid", "sprefix", "content-id", "linkCode",
    "linkId", "language", "smid", "spLa", "dib", "dib_tag", "utm_source",
    "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid",
    "gclid", "srno", "otracker", "otracker1", "iid", "ssid", "lid",
    "marketplace", "store", "spotlightTagId", "fm", "ppt", "ppn", "cmpid",
}

ASIN_RE = re.compile(r"/(?:dp|gp/product|gp/aw/d|exec/obidos/ASIN|o/ASIN)/([A-Z0-9]{10})(?:[/?]|$)", re.I)

DISCLOSURE_EN = "As an Amazon Associate, Adyzio earns from qualifying purchases."
DISCLOSURE_GENERAL = "Affiliate link: Adyzio may earn a small commission, at no extra cost to you."
DISCLOSURE_TE = ("ఈ post లో affiliate links ఉన్నాయి. మీరు కొంటే మాకు చిన్న commission వస్తుంది, "
                 "మీకు extra cost ఉండదు.")


# ----------------------------------------------------------------- helpers
def today() -> dt.date:
    return dt.date.today()


def host_of(url: str) -> str:
    try:
        return (urlparse(url.strip()).hostname or "").lower()
    except ValueError:
        return ""


def detect_store(url: str) -> str:
    h = host_of(url)
    for store, needles in STORE_HOSTS.items():
        if any(n in h for n in needles):
            return store
    return "other"


def is_short_link(url: str) -> bool:
    """Known short-link hosts, or a very short two-part host such as a network's link domain."""
    h = host_of(url)
    if h in {"amzn.to", "amzn.in", "amzn.eu", "fkrt.it", "fkrt.cc", "fkrt.co", "myntr.it"}:
        return True
    return h.count(".") == 1 and len(h) <= 10 and detect_store(url) == "other"


def clean_url(url: str) -> str:
    """Strip tracking junk from a plain store link. Keeps product ids (pid, etc.)."""
    url = url.strip()
    if not url:
        return url
    p = urlparse(url)
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in JUNK_PARAMS]
    return urlunparse((p.scheme or "https", p.netloc, p.path, "", urlencode(q), ""))


def amazon_asin(url: str):
    m = ASIN_RE.search(urlparse(url).path + "/")
    return m.group(1).upper() if m else None


def amazon_affiliate(url: str, tag: str):
    """Clean amazon.in/dp/ASIN link with YOUR tag. Returns None if no ASIN."""
    asin = amazon_asin(url)
    if not asin:
        return None
    host = host_of(url)
    domain = host if host.startswith("www.amazon.") or host.startswith("amazon.") else "www.amazon.in"
    if not domain.startswith("www."):
        domain = "www." + domain
    return f"https://{domain}/dp/{asin}/?tag={tag}"


def affiliate_ok(link: str, store: str) -> str:
    """'ok', 'missing', 'plain' or 'unknown' - same idea as the website's check."""
    l = link.lower()
    h = host_of(link)
    if not link:
        return "missing"
    if store == "amazon":
        if h in {"amzn.to", "amzn.in", "amzn.eu"}:
            return "ok"
        return "ok" if "tag=" in l else "missing"
    if store == "flipkart":
        if h.startswith("fkrt.") or "affid=" in l:
            return "ok"
        if detect_store(link) == "flipkart":
            return "missing"  # a plain flipkart.com link earns nothing
        return "unknown"       # network short link (e.g. ExtraPe) - check by clicking
    # Myntra, AJIO, Meesho...: looks like the store's own page, maybe not converted.
    if detect_store(link) == store and not is_short_link(link):
        return "plain"
    return "unknown"  # network short link (e.g. ExtraPe) - confirm by clicking it once


def read_csv(path: Path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in r]


def write_csv(path: Path, rows, cols):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})


def load_config(path):
    cfg = {}
    if path and Path(path).exists():
        cfg = json.loads(Path(path).read_text(encoding="utf-8"))
    return cfg


def load_categories(path: Path):
    slugs, names = set(), {}
    for r in read_csv(path):
        slugs.add(r["slug"].lower())
        names[r["name"].lower()] = r["slug"].lower()
    return slugs, names


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_date(s: str):
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


# ----------------------------------------------------------------- commands
def cmd_convert(a):
    cfg = load_config(a.config)
    tag = (a.amazon_tag or cfg.get("amazon_tag", "")).strip()
    if tag and not re.fullmatch(r"[A-Za-z0-9_-]+-2\d", tag):
        sys.exit(f"Amazon tag '{tag}' does not look like an Amazon India tracking ID (e.g. yourname-21). "
                 "Copy it from Associates Central.")
    rows = read_csv(Path(a.input))
    counts = {}
    for r in rows:
        src = r.get("source_url", "")
        aff = r.get("affiliate_url", "")
        if not src and not aff:
            r["status"] = "EMPTY"
        else:
            if src:
                r["source_url"] = clean_url(src)
            store = r.get("store") or detect_store(src or aff)
            r["store"] = store if store in STORES else "other"
            if not r.get("added_on"):
                r["added_on"] = today().isoformat()
            if aff:
                st = affiliate_ok(aff, r["store"])
                r["status"] = "CHECK" if st != "missing" else "NO_TAG"
            elif r["store"] == "amazon":
                if not tag:
                    r["status"] = "NEEDS_AMAZON_TAG"
                else:
                    link = amazon_affiliate(src, tag) if not is_short_link(src) else None
                    if link:
                        r["affiliate_url"] = link
                        r["status"] = "CHECK"
                    else:
                        r["status"] = "USE_SITESTRIPE"  # short or odd link: make it in SiteStripe
            else:
                r["status"] = "CONVERT_IN_EXTRAPE"
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    out = Path(a.output or a.input)
    write_csv(out, rows, SHEET_COLS)
    print(f"Wrote {len(rows)} rows to {out}")
    for k, v in sorted(counts.items()):
        print(f"  {k:20} {v}")
    print("\nNext: paste ExtraPe links into affiliate_url for CONVERT_IN_EXTRAPE rows, "
          "fill title/category, then run validate.")


def validate_rows(rows, cat_slugs, cat_names, max_price_age):
    """Returns list of (row_no, level, message). Mutates row['status']."""
    issues = []
    seen_links = {}
    for i, r in enumerate(rows, start=2):  # row 1 = header
        if r.get("status") == "EMPTY":
            continue
        errs, warns = [], []
        if not r.get("title"):
            errs.append("title is empty")
        elif len(r["title"]) > 255:
            errs.append("title longer than 255 characters")
        store = r.get("store") or detect_store(r.get("source_url", "") or r.get("affiliate_url", ""))
        if store not in STORES:
            errs.append(f"store '{store}' is not one of {', '.join(STORES)}")
        aff = r.get("affiliate_url", "")
        if not aff:
            errs.append("affiliate_url is empty (convert it first)")
        elif not aff.lower().startswith("https://"):
            errs.append("affiliate_url must start with https://")
        else:
            st = affiliate_ok(aff, store)
            if st == "missing":
                errs.append("affiliate_url has no affiliate ID - it would earn nothing")
            elif st == "plain":
                warns.append("affiliate_url looks like the plain store page - make sure it came out of ExtraPe")
            elif st == "unknown":
                warns.append("open the affiliate link once to confirm it lands on the right product")
            if aff in seen_links:
                warns.append(f"same affiliate_url as row {seen_links[aff]}")
            seen_links.setdefault(aff, i)
        cat = r.get("category", "").lower()
        if not cat:
            errs.append("category is empty")
        elif cat not in cat_slugs and cat not in cat_names and slugify(cat) not in cat_slugs:
            errs.append(f"category '{r['category']}' is not in data/categories.csv "
                        "(the site would create a new, stray category)")
        price, mrp = r.get("price", ""), r.get("mrp", "")
        for label, v in (("price", price), ("mrp", mrp)):
            if v and not re.fullmatch(r"\d+(\.\d{1,2})?", v.replace(",", "")):
                errs.append(f"{label} '{v}' must be a plain number like 1299 (no ₹)")
        if price:
            d = parse_date(r.get("price_checked_on", ""))
            if not d:
                errs.append("price filled but price_checked_on is empty - clear the price or add the date you checked it")
            elif (today() - d).days > max_price_age:
                errs.append(f"price checked {(today() - d).days} days ago - re-check it or clear it "
                            "(the site shows 'Check latest price' when empty)")
        if price and mrp:
            try:
                if float(price.replace(",", "")) > float(mrp.replace(",", "")):
                    errs.append("price is higher than mrp")
            except ValueError:
                pass
        for f in ("is_deal", "is_featured", "is_active"):
            if r.get(f, "") not in ("", "0", "1"):
                errs.append(f"{f} must be 0 or 1")
        img = r.get("image", "")
        if img and not img.lower().startswith("https://"):
            errs.append("image must be an https:// URL (SiteStripe image link or your own upload)")
        if r.get("deal_ends"):
            d = parse_date(r["deal_ends"])
            if not d:
                errs.append("deal_ends must be a date like 2026-11-05")
            elif d < today():
                warns.append("deal_ends is in the past - set is_active to 0 or update the deal")
        r["status"] = "ERROR" if errs else ("READY" if not warns else "READY_CHECK")
        issues += [(i, "ERROR", m) for m in errs] + [(i, "warn", m) for m in warns]
    return issues


def cmd_validate(a):
    rows = read_csv(Path(a.input))
    cat_slugs, cat_names = load_categories(Path(a.categories))
    issues = validate_rows(rows, cat_slugs, cat_names, a.max_price_age)
    write_csv(Path(a.input), rows, SHEET_COLS)
    for row_no, level, msg in issues:
        print(f"row {row_no:>4}  {level:5}  {msg}")
    n_err = sum(1 for r in rows if r.get("status") == "ERROR")
    n_ok = sum(1 for r in rows if r.get("status", "").startswith("READY"))
    print(f"\n{n_ok} ready, {n_err} with errors, {len(rows)} total. Status column updated in {a.input}.")
    return 1 if n_err and a.strict else 0


def cmd_export(a):
    rows = read_csv(Path(a.input))
    cat_slugs, cat_names = load_categories(Path(a.categories))
    validate_rows(rows, cat_slugs, cat_names, a.max_price_age)
    write_csv(Path(a.input), rows, SHEET_COLS)  # keep the status column current
    ready = [r for r in rows if r.get("status", "").startswith("READY")]
    out = []
    for r in ready:
        o = {c: r.get(c, "") for c in IMPORT_COLS}
        cat = o["category"].lower()
        o["category"] = cat if cat in cat_slugs else cat_names.get(cat, slugify(cat))
        o["store"] = r.get("store") or detect_store(r.get("source_url", ""))
        o["price"] = o["price"].replace(",", "")
        o["mrp"] = o["mrp"].replace(",", "")
        o["is_active"] = o["is_active"] or "1"
        o["is_deal"] = o["is_deal"] or ("1" if r.get("deal_type") else "0")
        o["is_featured"] = o["is_featured"] or "0"
        out.append(o)
    write_csv(Path(a.output), out, IMPORT_COLS)
    skipped = len([r for r in rows if r.get("status") not in ("EMPTY",)]) - len(out)
    print(f"Wrote {len(out)} products to {a.output} ({skipped} not ready, left out).")
    print("Upload it in adyzio.com/admin -> Import / Export.")


CAPTION_TEMPLATES = {
    "telegram": "{badge}{title}\n\n{bullets}{price_line}👉 {link}\n\n{disc}",
    "whatsapp": "{badge}*{title}*\n{bullets}{price_line}👉 {link}\n\n_{disc}_",
    "facebook": "{badge}{title}\n\n{bullets}{price_line}Shop: {link}\n\n{disc} #ad",
    "instagram": "{badge}{title}\n\n{bullets}{price_line}Link in bio / story → search \"{short}\" on adyzio.com\n\n{disc} #ad #adyzio #deals",
    "x": "{badge}{short} {price_short}👉 {link} #ad #deals",
    "threads": "{badge}{short}\n{price_short}{link}\n#ad",
    "pinterest": "{title} | {first_feature} | Check latest price on Adyzio. Affiliate link (#ad).",
}


def cmd_captions(a):
    rows = read_csv(Path(a.input))
    site = a.site.rstrip("/")
    platforms = list(CAPTION_TEMPLATES) if a.platform == "all" else [a.platform]
    ids = set(x.strip() for x in a.ids.split(",")) if a.ids else None
    out_lines = []
    n = 0
    for r in rows:
        if r.get("is_active", "1") == "0":
            continue
        if ids and r.get("id") not in ids:
            continue
        if not r.get("slug"):
            sys.exit("This needs the site's full export (it has id and slug columns): "
                     "Admin -> Import / Export -> Export CSV.")
        feats = [f.strip() for f in r.get("features", "").split("|") if f.strip()][:4]
        badge = "🔥 DEAL: " if r.get("is_deal") == "1" else ""
        disc = DISCLOSURE_EN if r.get("store") == "amazon" else DISCLOSURE_GENERAL
        if a.telugu:
            disc = DISCLOSURE_TE + ("\n" + DISCLOSURE_EN if r.get("store") == "amazon" else "")
        price = r.get("price", "")
        # Price only with a date; prices change. The site stores price_updated_at.
        price_line = f"💰 ₹{price} (checked {r.get('price_updated_at','')[:10]}; price may change)\n" \
            if price and r.get("price_updated_at") else "💰 Check latest price\n"
        price_short = f"₹{price} (may change) " if price and r.get("price_updated_at") else ""
        short = r["title"][:70]
        out_lines.append(f"=== #{r.get('id')} {r['title']} ===")
        for p in platforms:
            link = f"{site}/product/{r['slug']}?src={p}"
            text = CAPTION_TEMPLATES[p].format(
                badge=badge, title=r["title"], short=short,
                bullets="".join(f"✅ {f}\n" for f in feats) + ("\n" if feats else ""),
                price_line=price_line, price_short=price_short, link=link, disc=disc,
                first_feature=feats[0] if feats else r.get("short_desc", ""),
            )
            out_lines.append(f"--- {p} ---\n{text}\n")
        n += 1
    Path(a.output).write_text("\n".join(out_lines), encoding="utf-8")
    print(f"Captions for {n} products x {len(platforms)} platforms written to {a.output}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Adyzio link tool: convert -> validate -> export -> captions")
    sub = ap.add_subparsers(dest="cmd", required=True)
    cats_default = str(REPO / "data" / "categories.csv")

    c = sub.add_parser("convert", help="clean links, detect store, add your Amazon tag")
    c.add_argument("input")
    c.add_argument("-o", "--output", help="default: overwrite input")
    c.add_argument("--config", default=str(HERE / "config.json"))
    c.add_argument("--amazon-tag", help="your Associates tracking ID, e.g. yourname-21")
    c.set_defaults(fn=cmd_convert)

    v = sub.add_parser("validate", help="check rows before import")
    v.add_argument("input")
    v.add_argument("--categories", default=cats_default)
    v.add_argument("--max-price-age", type=int, default=1, help="days a checked price stays valid (default 1)")
    v.add_argument("--strict", action="store_true", help="exit with error code if any row fails")
    v.set_defaults(fn=cmd_validate)

    e = sub.add_parser("export", help="write the adyzio.com import CSV (READY rows only)")
    e.add_argument("input")
    e.add_argument("-o", "--output", default="adyzio-import.csv")
    e.add_argument("--categories", default=cats_default)
    e.add_argument("--max-price-age", type=int, default=1)
    e.set_defaults(fn=cmd_export)

    p = sub.add_parser("captions", help="social captions from the site's product export")
    p.add_argument("input", help="CSV from Admin -> Import / Export -> Export")
    p.add_argument("-o", "--output", default="captions.txt")
    p.add_argument("--site", default="https://www.adyzio.com")
    p.add_argument("--platform", default="all", choices=["all"] + list(CAPTION_TEMPLATES))
    p.add_argument("--ids", help="only these product ids, comma separated")
    p.add_argument("--telugu", action="store_true", help="Telugu disclosure line")
    p.set_defaults(fn=cmd_captions)

    a = ap.parse_args(argv)
    return a.fn(a) or 0


if __name__ == "__main__":
    sys.exit(main())
