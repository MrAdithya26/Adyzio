# Adyzio link tool

Turns the **Adyzio Link Sheet** into a file you upload in adyzio.com → Admin → Import / Export, and writes social captions for every platform.

Needs only Python 3 (no installs). Works on Windows, Mac and Linux.

## One-time setup

1. Download this repo (GitHub → Code → Download ZIP) and unzip it.
2. Copy `config.example.json` to `config.json` and put your Amazon tracking ID in it (it ends in `-21`, from Associates Central). `config.json` is never uploaded to GitHub.

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
