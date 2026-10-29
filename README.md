# Swap Rate Aggregator

Compare crypto swap rates across exchanges before you swap. Fully static:
no backend, hosted on GitHub Pages.

## How it works
- ChangeNOW public v1 API returns the swap quote (no key needed).
- Swap links go to the exchange; affiliate IDs can be added in `app.js`
  (`AFFILIATE_IDS`) once approved.

## Run locally
Open `index.html` in a browser, or serve the folder with any static server.

## Notes
- Rates are estimates; confirm on the swap page before moving money.
- Amount minimums/maximums per pair still apply on the exchange side.
