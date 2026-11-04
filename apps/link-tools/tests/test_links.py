import csv, json, sys, tempfile, unittest, datetime as dt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import adyzio_links as L

TAG = "testtag-21"  # test value only

class T(unittest.TestCase):
    def test_detect(self):
        self.assertEqual(L.detect_store("https://www.amazon.in/x/dp/B0TESTASIN"), "amazon")
        self.assertEqual(L.detect_store("https://dl.flipkart.com/s/abc"), "flipkart")
        self.assertEqual(L.detect_store("https://www.myntra.com/123"), "myntra")
        self.assertEqual(L.detect_store("https://example.org/a"), "other")

    def test_amazon_link(self):
        u = "https://www.amazon.in/Some-Product/dp/B0TESTASIN/ref=sr_1_3?keywords=x&qid=1&th=1"
        self.assertEqual(L.amazon_affiliate(u, TAG), f"https://www.amazon.in/dp/B0TESTASIN/?tag={TAG}")
        self.assertIsNone(L.amazon_affiliate("https://www.amazon.in/s?k=earbuds", TAG))

    def test_affiliate_ok(self):
        self.assertEqual(L.affiliate_ok("https://www.amazon.in/dp/B0TESTASIN", "amazon"), "missing")
        self.assertEqual(L.affiliate_ok(f"https://www.amazon.in/dp/B0TESTASIN/?tag={TAG}", "amazon"), "ok")
        self.assertEqual(L.affiliate_ok("https://amzn.to/abc", "amazon"), "ok")
        self.assertEqual(L.affiliate_ok("https://www.flipkart.com/p/itm1?pid=X", "flipkart"), "missing")
        self.assertEqual(L.affiliate_ok("https://www.flipkart.com/p/itm1?pid=X&affid=me", "flipkart"), "ok")
        self.assertEqual(L.affiliate_ok("https://www.myntra.com/123", "myntra"), "plain")

    def _sheet(self, rows):
        d = Path(tempfile.mkdtemp()); p = d / "s.csv"
        L.write_csv(p, rows, L.SHEET_COLS); return d, p

    def test_pipeline(self):
        today = dt.date.today().isoformat()
        old = (dt.date.today() - dt.timedelta(days=5)).isoformat()
        d, p = self._sheet([
            {"source_url": "https://www.amazon.in/X/dp/B0TESTASIN?ref=abc", "title": "Earbuds", "category": "headphones-earbuds"},
            {"source_url": "https://www.flipkart.com/p/itm1?pid=X", "title": "Phone", "category": "Smartphones"},
            {"source_url": "https://www.amazon.in/X/dp/B0TESTASI2", "title": "Lamp", "category": "Lamps", },
            {"source_url": "https://www.amazon.in/X/dp/B0TESTASI3", "title": "Bag", "category": "backpacks", "price": "999", "price_checked_on": old},
            {"source_url": "https://www.amazon.in/X/dp/B0TESTASI4", "title": "Book", "category": "exam-preparation", "price": "299", "mrp": "399", "price_checked_on": today},
        ])
        L.main(["convert", str(p), "--amazon-tag", TAG, "--config", "/nonexistent"])
        rows = L.read_csv(p)
        self.assertEqual(rows[0]["status"], "CHECK")
        self.assertTrue(rows[0]["affiliate_url"].endswith(f"?tag={TAG}"))
        self.assertEqual(rows[1]["status"], "CONVERT_IN_EXTRAPE")
        out = d / "import.csv"
        L.main(["export", str(p), "-o", str(out)])
        rows = L.read_csv(p)
        self.assertEqual(rows[0]["status"], "READY")
        self.assertEqual(rows[1]["status"], "ERROR")   # not converted yet
        self.assertEqual(rows[2]["status"], "ERROR")   # unknown category
        self.assertEqual(rows[3]["status"], "READY_CHECK")  # Amazon price ignored (not exported)
        self.assertEqual(rows[4]["status"], "READY_CHECK")  # Amazon price kept in sheet only
        imp = L.read_csv(out)
        self.assertEqual(list(imp[0].keys()), L.IMPORT_COLS)
        self.assertEqual([r["title"] for r in imp], ["Earbuds", "Bag", "Book"])
        self.assertEqual(imp[0]["store"], "amazon")
        self.assertEqual(imp[2]["price"], "")  # Amazon prices never exported

    def test_bad_tag_rejected(self):
        d, p = self._sheet([{"source_url": "https://www.amazon.in/dp/B0TESTASIN"}])
        with self.assertRaises(SystemExit):
            L.main(["convert", str(p), "--amazon-tag", "not a tag", "--config", "/nonexistent"])

    def test_captions(self):
        d = Path(tempfile.mkdtemp()); p = d / "export.csv"
        with open(p, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["id", "slug", "title", "store", "features", "price", "is_deal", "is_active"])
            w.writerow(["7", "earbuds", "Earbuds", "amazon", "A | B", "", "1", "1"])
        out = d / "c.txt"
        L.main(["captions", str(p), "-o", str(out)])
        t = out.read_text()
        self.assertIn("https://www.adyzio.com/product/earbuds?src=telegram", t)
        self.assertIn("As an Amazon Associate", t)
        self.assertIn("Check latest price", t)
        self.assertNotIn("₹", t)

    def test_strip_foreign_and_keys(self):
        import deal_collect as D
        u = D.strip_foreign("https://www.amazon.in/x/dp/B0TESTASIN/ref=sr_1_1?tag=someone-21&linkCode=ll1&th=1")
        self.assertNotIn("someone-21", u); self.assertNotIn("ref=", u)
        f = D.strip_foreign("https://www.flipkart.com/x/p/itm1?pid=ABC&affid=other&affExtParam1=z")
        self.assertIn("pid=ABC", f); self.assertNotIn("affid", f)
        self.assertEqual(D.product_key("amazon", u), "amazon:B0TESTASIN")
        self.assertEqual(D.product_key("flipkart", f), "flipkart:ABC")

    def _sources(self):
        d = Path(tempfile.mkdtemp())
        (d / "wa_channel.txt").write_text(
            "02/11/26, 5:12 pm - Loot Deals: 🔥 Loot Deal\nTest Earbuds 40h Battery\nDeal ₹899 MRP ₹3,999\n"
            "https://www.amazon.in/Test/dp/B0TESTASIN/ref=x?tag=someone-21\n"
            "02/11/26, 5:20 pm - Loot Deals: Test Kurti Set\n₹649 MRP ₹2199\nhttps://www.flipkart.com/k/p/itm9?pid=KURTI1&affid=other\n"
            "02/11/26, 5:30 pm - Loot Deals: Join our channel https://t.me/somechannel\n"
            "02/11/26, 5:40 pm - Loot Deals: Short one https://amzn.to/3abcdef\n", encoding="utf-8")
        (d / "tg.json").write_text(json.dumps({"name": "Deals TG", "messages": [
            {"date": "2026-11-02T10:00:00", "text": ["Test Earbuds again ", {"type": "text_link", "text": "Buy", "href": "https://www.amazon.in/dp/B0TESTASIN?tag=x-21"}]},
            {"date": "2026-11-02T10:05:00", "text": "Steel Bottle 1L\n₹299\nhttps://www.myntra.com/bottle/123456/buy"}]}), encoding="utf-8")
        return d

    def test_collect_xlsx_and_extrape_roundtrip(self):
        src = self._sources(); sheet = src / "deals.xlsx"
        L.main(["collect", str(src), "--sheet", str(sheet), "--amazon-tag", TAG, "--no-expand", "--config", "/nonexistent"])
        rows = L.read_rows(sheet)
        stores = sorted(r.get("store", "") for r in rows if r.get("source_url"))
        self.assertEqual(stores, ["amazon", "flipkart", "myntra"])          # duplicate earbuds merged, t.me skipped
        amz = next(r for r in rows if r.get("store") == "amazon")
        self.assertEqual(amz["affiliate_url"], f"https://www.amazon.in/dp/B0TESTASIN/?tag={TAG}")
        self.assertIn("Deals TG", amz["source"]); self.assertEqual(amz["price"], "")
        self.assertEqual(amz["price_seen"], "899")
        fk = next(r for r in rows if r.get("store") == "flipkart")
        self.assertEqual(fk["status"], "CONVERT_IN_EXTRAPE"); self.assertNotIn("affid", fk["source_url"])
        self.assertEqual((fk["price"], fk["mrp"]), ("649", "2199"))
        self.assertTrue(any(r.get("status") == "OPEN_SHORT_LINK" for r in rows))
        batch = src / "b.txt"
        L.main(["extrape-out", str(sheet), "-o", str(batch)])
        lines = batch.read_text().split()
        conv = src / "conv.txt"
        conv.write_text("\n".join(f"{lines[i]} https://extp.in/abc{i}" for i in range(0, len(lines), 2)))
        L.main(["extrape-in", str(sheet), str(conv)])
        rows = L.read_rows(sheet)
        self.assertTrue(next(r for r in rows if r.get("store") == "flipkart")["affiliate_url"].startswith("https://extp.in/"))

if __name__ == "__main__":
    unittest.main()
