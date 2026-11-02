# Adyzio link tool

Turns the **Adyzio Link Sheet** into a file you upload in adyzio.com → Admin → Import / Export, and writes social captions for every platform.

Needs only Python 3 (no installs). Works on Windows, Mac and Linux.

## One-time setup

1. Download this repo (GitHub → Code → Download ZIP) and unzip it.
2. Copy `config.example.json` to `config.json`. It already has your website tracking ID `adyzio-21`. `config.json` is never uploaded to GitHub.
3. For Excel sheets: `pip install openpyxl`.

## Collect deals into Excel (new)

You gather deal posts from WhatsApp, Telegram, Pinterest and deal websites. The tool reads them, keeps only the store links, **removes the other channel's affiliate tags**, merges the same product seen in several channels, adds **your** Amazon tag and writes everything into one Excel sheet.

One-time: `pip install openpyxl` (needed for Excel files).

### 1. Save the posts into one folder (for example `inbox/`)

| Source | How to save it |
|---|---|
| Telegram channel | Telegram Desktop → open the channel → ⋮ → **Export chat history** → untick photos/videos → format **JSON** → put `result.json` in `inbox/` (rename it, e.g. `tg-lootdeals.json`) |
| WhatsApp group or chat | ⋮ → More → **Export chat** → Without media → put the `.txt` in `inbox/` |
| WhatsApp channel | Channels have no export: long-press posts → Copy → paste into a `.txt` file, one blank line between posts |
| Pinterest | Open the pin → copy its shop link → paste into a `.txt` file (one per line, or with the pin text) |
| Deal website | Copy the deal posts into a `.txt` file, or browser → Save page as → `.html` |

The file name becomes the **source** column, so name files after the channel (`wa-dealsdhamaka.txt`).

### 2. Run the steps

```
py apps/link-tools/adyzio_links.py collect inbox --sheet deals.xlsx
py apps/link-tools/adyzio_links.py extrape-out deals.xlsx
      → paste extrape-batch.txt into the ExtraPe converter, save its reply as converted.txt
py apps/link-tools/adyzio_links.py extrape-in deals.xlsx converted.txt
      → open deals.xlsx, fill category (and fix titles), save
py apps/link-tools/adyzio_links.py validate deals.xlsx
py apps/link-tools/adyzio_links.py export deals.xlsx -o import-today.csv
      → upload import-today.csv in adyzio.com → Admin → Import / Export
```

Run `collect` again any time with new files: products already in the sheet are not added twice; their **source** column just gets the new channel name.

### What it does with each link

| Link | Result |
|---|---|
| Amazon (`amazon.in/dp/…`) | Other people's `tag=` removed, your tag added → status `CHECK` |
| Short link (`amzn.to`, `fkrt.it`, `bit.ly`…) | Followed to the real product page (only the redirect, the page is not downloaded), then cleaned. If it can't be opened → `OPEN_SHORT_LINK` |
| Flipkart, Myntra, Shopsy, Meesho, AJIO… | `affid` and other tags removed → `CONVERT_IN_EXTRAPE` |
| t.me, chat.whatsapp, Instagram, YouTube… | Skipped (not products) |

### Prices and images

- Title, price and MRP are read from the post text. **Check them on the store page** before publishing; validate rejects prices older than 1 day.
- **Amazon:** price/MRP go to `price_seen` / `mrp_seen` only, and `export` never sends Amazon prices or images to the site. Amazon allows prices and images only from its own API (Creators API), so the site shows "Check latest price". Your Amazon earnings depend on keeping to this.
- Your tracking IDs: `adyzio-21` (default, in `config.json`) and `addeals00-21`. Use `--amazon-tag addeals00-21` to tag a sheet with the other one.

## Every day

Open a terminal in the repo folder (Windows: type `cmd` in the folder's address bar).

```
python3 apps/link-tools/adyzio_links.py convert linksheet.csv
python3 apps/link-tools/adyzio_links.py validate linksheet.csv
python3 apps/link-tools/adyzio_links.py export linksheet.csv -o import-today.csv
python3 apps/link-tools/adyzio_links.py captions export.csv --ids 31,32,33 -o captions.txt
```

On Windows, type `py` instead of `python3`.

| Command | What it does |
|---|---|
| `collect` | Reads saved deal posts (.txt / Telegram .json / .html), fills the sheet, removes other people's tags, adds yours. |
| `extrape-out` / `extrape-in` | Writes links that need ExtraPe into a text file; reads ExtraPe's converted reply back into the sheet. |
| `convert` | Cleans links, detects the store, makes Amazon affiliate links with your tag. Other stores → status `CONVERT_IN_EXTRAPE` (convert them in ExtraPe and paste into `affiliate_url`). |
| `validate` | Writes `READY` / `READY_CHECK` / `ERROR` into the status column and lists every problem. |
| `export` | Writes only ready rows, in the exact columns the website imports. |
| `captions` | From the site's full export: Telegram, WhatsApp, Instagram, Facebook, X, Threads and Pinterest text with disclosure and `?src=` links. Add `--telugu` for the Telugu disclosure. |

## Status values

| Status | Meaning |
|---|---|
| `CHECK` | Converted; run validate |
| `CONVERT_IN_EXTRAPE` | Make the link in ExtraPe and paste it in `affiliate_url` |
| `USE_SITESTRIPE` | Amazon short or unusual link; make the link in SiteStripe |
| `NEEDS_AMAZON_TAG` | Add your tag to `config.json` |
| `NO_TAG` | The pasted affiliate link has no affiliate ID – it would earn nothing |
| `READY` / `READY_CHECK` | Will be exported (`READY_CHECK`: click the link once to confirm) |
| `ERROR` | Fix what validate printed |

## What it never does

- It never fetches store pages, prices or photos.
- It never invents a tracking ID or an ExtraPe link.
- It refuses a price without the date you checked it, and flags prices older than one day (`--max-price-age` to change).

## Tests

```
cd apps/link-tools && python3 -m unittest tests/test_links.py
```
