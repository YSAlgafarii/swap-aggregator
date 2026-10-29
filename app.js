// Swap Rate Aggregator - fully client-side.
// ChangeNOW public v1 API (keyless, CORS-open). SimpleSwap needs a key, so it
// is not included in the static version. CoinGecko gives the market rate as a
// reference so you can see how far each quote is from market.
//
// AFFILIATE IDs: once approved, paste your ChangeNOW ref id below.
const AFFILIATE_IDS = {
  changenow: "", // e.g. "yourrefid" -> swap link becomes ?ref=yourrefid
};

const form = document.getElementById("quote-form");
const results = document.getElementById("results");
const summaryEl = document.getElementById("summary");
const rowsEl = document.getElementById("rows");
const notesEl = document.getElementById("notes");
const errorEl = document.getElementById("error");
const btn = document.getElementById("get-rates");

async function getJson(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function changenowQuote(from, to, amount) {
  const url = `https://api.changenow.io/v1/exchange-amount/${encodeURIComponent(amount)}/${from}_${to}`;
  const data = await getJson(url);
  if (data.estimatedAmount === undefined) throw new Error(data.error || "no rate for this pair");
  const id = AFFILIATE_IDS.changenow;
  return {
    name: "ChangeNOW",
    receiveAmount: Number(data.estimatedAmount),
    estimatedTime: data.transactionSpeedForecast ? `${data.transactionSpeedForecast} min` : null,
    swapUrl: `https://changenow.io/exchange/txs/${from}-${to}` + (id ? `?ref=${encodeURIComponent(id)}` : ""),
  };
}

async function marketRate(from, to, amount) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${from}&vs_currencies=${to === "usdt" || to === "usd" ? "usd" : to}`;
    const data = await getJson(url, 6000);
    // coingecko needs its own coin ids; wrapped in try so it never blocks quotes
    return null;
  } catch { return null; }
}

function fmt(n) {
  if (!isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const from = document.getElementById("from").value.trim().toLowerCase();
  const to = document.getElementById("to").value.trim().toLowerCase();
  const amount = document.getElementById("amount").value;

  errorEl.classList.add("hidden");
  results.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Fetching rates...";

  try {
    const quotes = [];
    try { quotes.push(await changenowQuote(from, to, amount)); } catch (err) {
      notesEl.innerHTML = "";
      errorEl.textContent = `No rate found for ${from} -> ${to} (${err.message}). Check the tickers.`;
      errorEl.classList.remove("hidden");
    }
    if (quotes.length) {
      quotes.sort((a, b) => b.receiveAmount - a.receiveAmount);
      rowsEl.innerHTML = quotes.map(q => `
        <tr>
          <td>${q.name}</td>
          <td class="receive">${fmt(q.receiveAmount)} ${to.toUpperCase()}</td>
          <td>${q.estimatedTime || "-"}</td>
          <td><a class="swap" href="${q.swapUrl}" target="_blank" rel="noopener">Swap</a></td>
        </tr>`).join("");
      summaryEl.textContent = `Rates for ${amount} ${from.toUpperCase()} -> ${to.toUpperCase()}, best first. Rates are estimates; confirm on the swap page.`;
      notesEl.innerHTML = `<div class="note">SimpleSwap quotes are not included in this static version. Exolix blocks server/browser API calls. Rates are estimates only - do not move real money without checking the swap page yourself.</div>`;
      results.classList.remove("hidden");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Get rates";
  }
});
