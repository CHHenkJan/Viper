/* ══════════════════════════════════════════
   VIPER — Signalstats API integration
   Fetches live track-record data from
   https://www.cryptohopper.com/signalstats.php
   with the trades=1 + extended=1 params.
   ══════════════════════════════════════════ */

(function () {
  const SIGNALLER_ID = 742;
  const API = 'https://www.cryptohopper.com/signalstats.php';
  const HOLD_ESTIMATE = '~1h'; // strategy fallback (1m–15m scalping)

  function formatHoldSeconds(s) {
    if (!s || s <= 0) return HOLD_ESTIMATE;
    if (s < 3600) return Math.round(s / 60) + 'm';
    if (s < 86400) return (s / 3600).toFixed(1) + 'h';
    return (s / 86400).toFixed(1) + 'd';
  }

  function formatDate(unix) {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    return d.toISOString().slice(0, 10);
  }

  function formatPct(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    const sign = n >= 0 ? '+' : '−';
    return sign + Math.abs(n).toFixed(1) + '%';
  }

  function setMetric(name, value) {
    document.querySelectorAll(`[data-metric="${name}"]`).forEach((el) => {
      el.textContent = value;
      // Strip animation hooks so the counter in main.js skips this element.
      el.removeAttribute('data-target');
      el.removeAttribute('data-suffix');
      el.removeAttribute('data-prefix');
    });
  }

  function renderTrades(trades) {
    const wrap = document.querySelector('[data-metric="recent_trades"]');
    if (!wrap || !trades || !trades.length) return;
    const tbody = wrap.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = trades
      .slice(0, 8)
      .map((t) => {
        const win = (t.result_pct || 0) >= 0;
        return `
          <tr>
            <td class="trade-asset">${t.market}</td>
            <td class="mono">${formatDate(t.entry_time)}</td>
            <td class="mono">${formatDate(t.exit_time)}</td>
            <td class="trade-result ${win ? 'trade-win' : 'trade-loss'} mono align-right">${formatPct(t.result_pct)}</td>
          </tr>`;
      })
      .join('');
  }

  function applyStats(data) {
    const ext = data.extended || {};
    const lifetime = ext.lifetime || {};
    const buyLifetime = (lifetime.buy && lifetime.buy.total_signals) || 0;

    if (buyLifetime > 0) setMetric('total_trades', buyLifetime.toLocaleString());
    if (ext.win_rate_1d_30d_pct !== null && ext.win_rate_1d_30d_pct !== undefined) {
      setMetric('win_rate', Math.round(ext.win_rate_1d_30d_pct) + '%');
    }
    setMetric('avg_hold', formatHoldSeconds(ext.avg_hold_seconds));
    if (ext.first_signal_time) {
      const weeks = Math.max(1, Math.floor((Date.now() / 1000 - ext.first_signal_time) / (7 * 86400)));
      setMetric('track_weeks', weeks + ' wks');
    }

    if (Array.isArray(data.paired_trades)) renderTrades(data.paired_trades);
  }

  async function load() {
    try {
      const url = `${API}?signal_id=${SIGNALLER_ID}&exchange=all&trades=1&extended=1`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (json.status !== 1 || !json.data) return;
      applyStats(json.data);
    } catch (err) {
      // Silent: keep static values on failure.
      // eslint-disable-next-line no-console
      console.warn('[signalstats]', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
