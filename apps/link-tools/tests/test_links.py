import csv, sys, tempfile, unittest, datetime as dt
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
        self.assertEqual(rows[3]["status"], "ERROR")   # stale price
        self.assertEqual(rows[4]["status"], "READY")
        imp = L.read_csv(out)
        self.assertEqual(list(imp[0].keys()), L.IMPORT_COLS)
        self.assertEqual([r["title"] for r in imp], ["Earbuds", "Book"])
        self.assertEqual(imp[0]["store"], "amazon")

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

if __name__ == "__main__":
    unittest.main()
