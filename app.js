// Swap Rate Aggregator - fully client-side.
// ChangeNOW public v1 API (keyless, CORS-open). SimpleSwap needs a key, so it
// is not included in the static version. CoinGecko gives the market rate as a
// reference so you can see how far each quote is from market.
//
// AFFILIATE IDs: once approved, paste your ChangeNOW ref id below.
const AFFILIATE_IDS = {
  changenow: "", // ChangeNOW ref id pending -> swap link becomes ?ref=yourrefid
  simpleswap: "2e1ebcccc205",
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

async function marketRate(from, to, amount) {
  const MAP = { btc:"bitcoin", eth:"ethereum", usdt:"tether", usdc:"usd-coin", sol:"solana", bnb:"binancecoin", xrp:"ripple", ada:"cardano", doge:"dogecoin", trx:"tron", ltc:"litecoin", ton:"the-open-network", dot:"polkadot", matic:"matic-network", avax:"avalanche-2" };
  const fid = MAP[from] || from, tid = MAP[to] || to;
  try {
    // CoinGecko free tier rate-limits sometimes; retry a few times
    let data = null;
    for (let i = 0; i < 4 && !data; i++) {
      try {
        data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${fid},${tid}&vs_currencies=usd`, 6000);
      } catch (e) {
        if (i === 3) throw e;
        await new Promise(r => setTimeout(r, 700 * (i + 1)));
      }
    }
    const fu = data[fid] && data[fid].usd, tu = data[tid] && data[tid].usd;
    if (!fu || !tu) return null;
    const receive = (amount * fu) / tu;
    return { name: "Market rate (reference)", receiveAmount: receive, estimatedTime: null, swapUrl: null, market: true };
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
    const mk = await marketRate(from, to, amount);
    if (mk) quotes.push(mk);
    try { quotes.push(await changenowQuote(from, to, amount)); } catch (err) {
      notesEl.innerHTML = "";
      errorEl.textContent = `No rate found for ${from} -> ${to} (${err.message}). Check the tickers.`;
      errorEl.classList.remove("hidden");
    }
    if (quotes.length) {
      quotes.sort((a, b) => b.receiveAmount - a.receiveAmount);
      const best = quotes.find(q => !q.market);
      const bestMk = quotes.find(q => q.market);
      let summaryText = `Rates for ${amount} ${from.toUpperCase()} -> ${to.toUpperCase()}, best first.`;
      if (best && bestMk && bestMk.receiveAmount > 0) {
        const diff = ((best.receiveAmount - bestMk.receiveAmount) / bestMk.receiveAmount) * 100;
        summaryText += ` ChangeNOW is ${diff >= 0 ? "" + diff.toFixed(2) + "%" : "-" + Math.abs(diff).toFixed(2) + "%"} vs the market rate.`;
      }
      rowsEl.innerHTML = quotes.map(q => `
        <tr>
          <td>${q.name}</td>
          <td class="receive">${fmt(q.receiveAmount)} ${to.toUpperCase()}</td>
          <td>${q.estimatedTime || "-"}</td>
          <td>${q.market ? '<span class="mkt">reference</span>' : `<a class="swap" href="${q.swapUrl}&link_id=a20c7c8f886c2c" target="_blank" rel="noopener">ChangeNOW</a> · <a class="swap" href="https://simpleswap.io/?ref=2e1ebcccc205" target="_blank" rel="noopener">SimpleSwap</a>`}</td>
        </tr>`).join("");
      summaryEl.textContent = summaryText + " Rates are estimates; confirm on the swap page.";
      notesEl.innerHTML = `<div class="note">SimpleSwap quotes are not included in this static version. Exolix blocks server/browser API calls. Rates are estimates only - do not move real money without checking the swap page yourself.</div>`;
      results.classList.remove("hidden");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Get rates";
  }
});
