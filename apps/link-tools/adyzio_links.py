#!/usr/bin/env python3
"""
Adyzio link tool - turns your Link Sheet into an import file for adyzio.com.

Steps (each is one command):
  collect   Read deal posts you saved (WhatsApp/Telegram exports, copied text,
            saved deal pages), pull out store links, remove other people's
            affiliate tags, add yours, and fill the Excel/CSV Link Sheet.
  extrape-out / extrape-in
            Write the links that need ExtraPe into one text file, then read the
            converted links back into the sheet.
  convert   Clean product links, detect the store, add your Amazon tag.
            Non-Amazon links are marked CONVERT_IN_EXTRAPE.
  validate  Check every row before import (tags, categories, prices, fields).
  export    Write the CSV that Admin -> Import / Export on adyzio.com accepts.
  captions  Make Telegram / WhatsApp / Instagram / Facebook / X / Threads /
            Pinterest text from the site's product export.

Rules built in:
  * It never invents a tracking ID. Your Amazon tag comes from config.json.
  * It never fetches or copies store pages, prices or photos. It works only
    on links and text you give it. (collect may follow a short link's redirect
    to find the product it points to; it does not load the page.)
  * Amazon rule: prices and images for Amazon products are kept in the sheet
    for your own use but are NOT exported to the site (Amazon allows them only
    from its API). The site shows "Check latest price" instead.
  * Works with .xlsx (Excel) or .csv sheets. Excel needs: pip install openpyxl
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
    "posted_channels", "source", "raw_url", "price_seen", "mrp_seen", "notes",
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
    "shopsy": ["shopsy."],
    "jiomart": ["jiomart."],
    "decathlon": ["decathlon."],
    "pepperfry": ["pepperfry."],
    "snapdeal": ["snapdeal."],
    "firstcry": ["firstcry."],
    "lenskart": ["lenskart."],
    "boat": ["boat-lifestyle."],
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
    # someone else's affiliate IDs - never keep them on a source link
    "tag", "ascsubtag", "creative", "creativeASIN", "camp", "affid", "affExtParam1", "affExtParam2",
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


STATUS_FILL = {"READY": "C6EFCE", "READY_CHECK": "FFF2CC", "ERROR": "F8CBAD", "CHECK": "DDEBF7",
               "CONVERT_IN_EXTRAPE": "FCE4D6", "OPEN_SHORT_LINK": "F8CBAD", "NO_TAG": "F8CBAD",
               "USE_SITESTRIPE": "FCE4D6", "NEEDS_AMAZON_TAG": "F8CBAD"}


def _openpyxl():
    try:
        import openpyxl
        return openpyxl
    except ImportError:
        sys.exit("Excel files need one extra package. Run this once:\n    pip install openpyxl\n"
                 "(or use a .csv sheet instead)")


def read_rows(path: Path):
    """Read the Link Sheet from .xlsx or .csv."""
    path = Path(path)
    if path.suffix.lower() != ".xlsx":
        return read_csv(path)
    wb = _openpyxl().load_workbook(path, read_only=True, data_only=True)
    ws = wb["Links"] if "Links" in wb.sheetnames else wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    head = [str(h or "").strip() for h in next(it, [])]
    rows = []
    for vals in it:
        if not any(v not in (None, "") for v in vals):
            continue
        r = {}
        for k, v in zip(head, vals):
            if not k:
                continue
            if isinstance(v, (dt.datetime, dt.date)):
                v = v.strftime("%Y-%m-%d")
            elif isinstance(v, float) and v.is_integer():
                v = str(int(v))
            r[k] = "" if v is None else str(v).strip()
        rows.append(r)
    wb.close()
    return rows


def write_rows(path: Path, rows, cols):
    """Write the Link Sheet as .xlsx (formatted) or .csv."""
    path = Path(path)
    if path.suffix.lower() != ".xlsx":
        return write_csv(path, rows, cols)
    ox = _openpyxl()
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = ox.Workbook(); ws = wb.active; ws.title = "Links"
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="2A2470")
    for r in rows:
        ws.append([r.get(c, "") for c in cols])
    widths = {"status": 20, "source_url": 45, "affiliate_url": 45, "title": 45, "description": 40,
              "short_desc": 30, "features": 30, "image": 30, "notes": 40, "raw_url": 35, "source": 22}
    for i, c in enumerate(cols, start=1):
        ws.column_dimensions[ox.utils.get_column_letter(i)].width = widths.get(c, 14)
    st_col = cols.index("status") + 1 if "status" in cols else None
    if st_col:
        for row in ws.iter_rows(min_row=2, min_col=st_col, max_col=st_col):
            c = row[0]; key = str(c.value or "")
            if key in STATUS_FILL:
                c.fill = PatternFill("solid", fgColor=STATUS_FILL[key])
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)


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
    tag = amazon_tag_from(a, cfg)
    rows = read_rows(Path(a.input))
    counts = convert_rows(rows, tag)
    out = Path(a.output or a.input)
    write_rows(out, rows, SHEET_COLS)
    print(f"Wrote {len(rows)} rows to {out}")
    for k, v in sorted(counts.items()):
        print(f"  {k:20} {v}")
    print("\nNext: paste ExtraPe links into affiliate_url for CONVERT_IN_EXTRAPE rows "
          "(or use extrape-out / extrape-in), fill title/category, then run validate.")


def amazon_tag_from(a, cfg):
    tag = (getattr(a, "amazon_tag", None) or cfg.get("amazon_tag", "")).strip()
    if tag and not re.fullmatch(r"[A-Za-z0-9_-]+-2\d", tag):
        sys.exit(f"Amazon tag '{tag}' does not look like an Amazon India tracking ID (e.g. yourname-21). "
                 "Copy it from Associates Central.")
    return tag


def convert_rows(rows, tag, only=None):
    counts = {}
    for r in rows:
        if only is not None and id(r) not in only:
            continue
        if r.get("status") in ("OPEN_SHORT_LINK",):
            counts[r["status"]] = counts.get(r["status"], 0) + 1
            continue
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
    return counts


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
        if store == "amazon" and (price or mrp or r.get("image")):
            warns.append("Amazon price/image stay in the sheet only; the site shows 'Check latest price' (Amazon rule)")
            price = mrp = ""
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
        img = "" if store == "amazon" else r.get("image", "")
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
    rows = read_rows(Path(a.input))
    cat_slugs, cat_names = load_categories(Path(a.categories))
    issues = validate_rows(rows, cat_slugs, cat_names, a.max_price_age)
    write_rows(Path(a.input), rows, SHEET_COLS)
    for row_no, level, msg in issues:
        print(f"row {row_no:>4}  {level:5}  {msg}")
    n_err = sum(1 for r in rows if r.get("status") == "ERROR")
    n_ok = sum(1 for r in rows if r.get("status", "").startswith("READY"))
    print(f"\n{n_ok} ready, {n_err} with errors, {len(rows)} total. Status column updated in {a.input}.")
    return 1 if n_err and a.strict else 0


def cmd_export(a):
    rows = read_rows(Path(a.input))
    cat_slugs, cat_names = load_categories(Path(a.categories))
    validate_rows(rows, cat_slugs, cat_names, a.max_price_age)
    write_rows(Path(a.input), rows, SHEET_COLS)  # keep the status column current
    ready = [r for r in rows if r.get("status", "").startswith("READY")]
    out = []
    for r in ready:
        o = {c: r.get(c, "") for c in IMPORT_COLS}
        cat = o["category"].lower()
        o["category"] = cat if cat in cat_slugs else cat_names.get(cat, slugify(cat))
        o["store"] = r.get("store") or detect_store(r.get("source_url", ""))
        o["price"] = o["price"].replace(",", "")
        o["mrp"] = o["mrp"].replace(",", "")
        if o["store"] == "amazon":  # Amazon allows prices/images only from its own API
            o["price"] = o["mrp"] = o["image"] = o["gallery"] = ""
        o["is_active"] = o["is_active"] or "1"
        o["is_deal"] = o["is_deal"] or ("1" if r.get("deal_type") else "0")
        o["is_featured"] = o["is_featured"] or "0"
        out.append(o)
    write_csv(Path(a.output), out, IMPORT_COLS)
    skipped = len([r for r in rows if r.get("status") not in ("EMPTY",)]) - len(out)
    print(f"Wrote {len(out)} products to {a.output} ({skipped} not ready, left out).")
    print("Upload it in adyzio.com/admin -> Import / Export.")


def cmd_collect(a):
    import deal_collect as DC
    cfg = load_config(a.config)
    tag = amazon_tag_from(a, cfg)
    files = []
    for x in a.sources:
        p = Path(x)
        if p.is_dir():
            files += sorted(f for f in p.rglob("*") if f.suffix.lower() in (".txt", ".json", ".html", ".htm", ".csv", ".md"))
        elif p.exists():
            files.append(p)
        else:
            print(f"  skipped (not found): {x}")
    if not files:
        sys.exit("No source files found. Save deal posts as .txt (copied text or WhatsApp export), "
                 ".json (Telegram Desktop export) or .html (saved page) and pass the file or folder.")
    sheet = Path(a.sheet)
    rows = read_rows(sheet) if sheet.exists() else []
    by_key = {}
    for r in rows:
        u = r.get("source_url", "")
        if u:
            by_key[DC.product_key(r.get("store") or detect_store(u), u)] = r
    cache, new, merged, short_fail = {}, [], 0, 0
    posts = 0
    for f in files:
        for post in DC.read_posts(f):
            posts += 1
            for c in DC.rows_from_post(post, detect_store, expand_links=not a.no_expand, cache=cache):
                if "problem" in c:
                    short_fail += 1
                    if not any(r.get("raw_url") == c["raw_url"] for r in rows):
                        r = {"status": "OPEN_SHORT_LINK", "raw_url": c["raw_url"], "source": post.get("source", ""),
                             "added_on": today().isoformat(), "notes": c["problem"]}
                        rows.append(r)
                    continue
                k = c["key"]
                if k in by_key:
                    r = by_key[k]
                    srcs = [s for s in r.get("source", "").split(" | ") if s]
                    if c["source"] and c["source"] not in srcs:
                        r["source"] = " | ".join(srcs + [c["source"]]); merged += 1
                    for fld in ("title", "price_seen", "mrp_seen"):
                        if not r.get(fld) and c.get(fld):
                            r[fld] = c[fld]
                    continue
                r = {"source_url": c["source_url"], "store": c["store"] if c["store"] in STORES else "other",
                     "raw_url": c["raw_url"], "title": c["title"], "source": c["source"],
                     "price_seen": c["price_seen"], "mrp_seen": c["mrp_seen"],
                     "added_on": today().isoformat(), "is_active": "1"}
                if c["store"] != "amazon" and c["price_seen"]:
                    r["price"], r["mrp"] = c["price_seen"], c["mrp_seen"]
                    r["price_checked_on"] = c["date"] or today().isoformat()
                    r["notes"] = f"price from {c['source']} post - check it on the store page"
                if c.get("date"):
                    r["is_deal"] = "1"
                rows.append(r); by_key[k] = r; new.append(r)
    counts = convert_rows(rows, tag, only={id(r) for r in new})
    write_rows(sheet, rows, SHEET_COLS)
    print(f"Read {posts} posts from {len(files)} file(s).")
    print(f"  new products     {len(new)}")
    print(f"  already in sheet {merged} (source added)")
    if short_fail:
        print(f"  short links not opened {short_fail} (status OPEN_SHORT_LINK - open them and paste the store link into source_url)")
    for k, v in sorted(counts.items()):
        print(f"  {k:20} {v}")
    print(f"\nSaved: {sheet}")
    print("Next: python adyzio_links.py extrape-out " + str(sheet) + "   (then paste the batch into ExtraPe)")


EXTRAPE_LINE = re.compile(r"\bR(\d+)\b\D{0,5}(https?://\S+)")


def cmd_extrape_out(a):
    rows = read_rows(Path(a.input))
    lines = []
    for i, r in enumerate(rows, start=2):
        if r.get("status") == "CONVERT_IN_EXTRAPE" and r.get("source_url"):
            lines.append(f"R{i} {r['source_url']}")
    for start in range(0, len(lines), a.batch):
        part = lines[start:start + a.batch]
        out = Path(a.output) if len(lines) <= a.batch else Path(a.output).with_name(
            f"{Path(a.output).stem}-{start // a.batch + 1}{Path(a.output).suffix}")
        out.write_text("\n".join(part) + "\n", encoding="utf-8")
        print(f"Wrote {len(part)} links to {out}")
    if not lines:
        print("No rows waiting for ExtraPe.")
        return
    print("\nPaste each file's text into the ExtraPe converter (bot, website or app). Keep the R-numbers.\n"
          "Save ExtraPe's reply as a text file and run:\n"
          f"  python adyzio_links.py extrape-in {a.input} converted.txt")


def cmd_extrape_in(a):
    rows = read_rows(Path(a.input))
    text = Path(a.converted).read_text(encoding="utf-8", errors="ignore")
    filled = bad = 0
    for m in EXTRAPE_LINE.finditer(text):
        n, link = int(m.group(1)), m.group(2).rstrip(".,;)")
        idx = n - 2
        if not (0 <= idx < len(rows)):
            print(f"  R{n}: no such row"); bad += 1; continue
        r = rows[idx]
        if detect_store(link) == r.get("store") and affiliate_ok(link, r.get("store", "")) in ("missing", "plain"):
            print(f"  R{n}: still the plain store link - ExtraPe did not convert it"); bad += 1; continue
        r["affiliate_url"] = link
        r["status"] = "CHECK"
        filled += 1
    write_rows(Path(a.input), rows, SHEET_COLS)
    print(f"Filled {filled} affiliate links, {bad} problems. Next: validate {a.input}")


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

    co = sub.add_parser("collect", help="read saved deal posts and fill the sheet")
    co.add_argument("sources", nargs="+", help="files or folders: .txt, .json (Telegram export), .html")
    co.add_argument("--sheet", default="deals.xlsx", help="Link Sheet to fill (.xlsx or .csv), default deals.xlsx")
    co.add_argument("--config", default=str(HERE / "config.json"))
    co.add_argument("--amazon-tag", help="override the tracking ID from config.json")
    co.add_argument("--no-expand", action="store_true", help="do not open short links (amzn.to, fkrt.it...)")
    co.set_defaults(fn=cmd_collect)

    xo = sub.add_parser("extrape-out", help="write links that need ExtraPe into a text file")
    xo.add_argument("input")
    xo.add_argument("-o", "--output", default="extrape-batch.txt")
    xo.add_argument("--batch", type=int, default=25, help="links per file (default 25)")
    xo.set_defaults(fn=cmd_extrape_out)

    xi = sub.add_parser("extrape-in", help="read ExtraPe's converted links back into the sheet")
    xi.add_argument("input")
    xi.add_argument("converted", help="text file with ExtraPe's reply (lines like 'R5 https://...')")
    xi.set_defaults(fn=cmd_extrape_in)

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
