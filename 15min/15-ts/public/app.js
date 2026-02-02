(function () {
  const WS_URL = (window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host;
  let ws = null;
  let state = {
    opportunities: [],
    trades: [],
    failedTrades: [],
    marketData: null,
    stats: { opportunitiesFound: 0, tradesExecuted: 0, totalInvested: 0, totalProfit: 0 },
    running: false,
  };

  const $ = (id) => document.getElementById(id);

  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function fmtNum(n) {
    if (n == null || n === undefined) return "—";
    return Number(n).toFixed(4);
  }

  function fmtMoney(n) {
    if (n == null || n === undefined) return "—";
    return "$" + Number(n).toFixed(2);
  }

  function setWsStatus(connected) {
    const el = $("ws-status");
    if (!el) return;
    el.textContent = connected ? "Bağlı" : "Bağlantı yok";
    el.className = "badge " + (connected ? "badge-connected" : "badge-disconnected");
  }

  function updateButtons() {
    const startBtn = $("btn-start");
    const stopBtn = $("btn-stop");
    const statusEl = $("bot-status");
    if (statusEl) {
      statusEl.textContent = state.running ? "Çalışıyor" : "Durduruldu";
      statusEl.className = "bot-status " + (state.running ? "running" : "stopped");
    }
    if (startBtn) startBtn.disabled = state.running;
    if (stopBtn) stopBtn.disabled = !state.running;
  }

  function renderStats() {
    const s = state.stats;
    const set = (id, text) => {
      const el = $(id);
      if (el) el.textContent = text;
    };
    set("stat-opportunities", String(s.opportunitiesFound));
    set("stat-trades", String(s.tradesExecuted));
    set("stat-invested", fmtMoney(s.totalInvested));
    set("stat-profit", fmtMoney(s.totalProfit));
  }

  function renderMarketData() {
    const m = state.marketData;
    if (!m) {
      $("live-up").textContent = "—";
      $("live-down").textContent = "—";
      $("live-total").textContent = "—";
      $("live-balance").textContent = "—";
      return;
    }
    $("live-up").textContent = m.upPrice != null ? "$" + Number(m.upPrice).toFixed(4) : "—";
    $("live-down").textContent = m.downPrice != null ? "$" + Number(m.downPrice).toFixed(4) : "—";
    $("live-total").textContent = m.totalCost != null ? "$" + Number(m.totalCost).toFixed(4) : "—";
    $("live-balance").textContent = m.balance != null ? fmtMoney(m.balance) : "—";
    if (m.timeRemaining) $("time-remaining").textContent = "Kalan: " + m.timeRemaining;
    if (m.marketSlug) $("market-slug").textContent = m.marketSlug;
  }

  function renderOpportunities() {
    const tbody = $("opportunities-body");
    if (!tbody) return;
    const rows = state.opportunities.slice(0, 50).map((opp) => {
      return (
        "<tr class=\"new-row\">" +
        "<td>" + fmtTime(opp.timestamp) + "</td>" +
        "<td>" + fmtNum(opp.price_up) + "</td>" +
        "<td>" + fmtNum(opp.price_down) + "</td>" +
        "<td>" + fmtNum(opp.total_cost) + "</td>" +
        "<td>" + (opp.profit_pct != null ? Number(opp.profit_pct).toFixed(2) + "%" : "—") + "</td>" +
        "<td>" + fmtMoney(opp.total_investment) + "</td>" +
        "</tr>"
      );
    });
    tbody.innerHTML = rows.join("");
  }

  function renderTrades() {
    const tbody = $("trades-body");
    if (!tbody) return;
    const rows = state.trades.slice(0, 100).map((t) => {
      const opp = t.opportunity || {};
      const ids = t.orderIds || [];
      return (
        "<tr class=\"new-row row-success\">" +
        "<td>" + fmtTime(t.timestamp) + "</td>" +
        "<td>" + fmtNum(opp.price_up) + "</td>" +
        "<td>" + fmtNum(opp.price_down) + "</td>" +
        "<td>" + fmtMoney(opp.expected_profit) + "</td>" +
        "<td><code>" + (ids[0] || "—") + "</code></td>" +
        "<td><code>" + (ids[1] || "—") + "</code></td>" +
        "</tr>"
      );
    });
    tbody.innerHTML = rows.join("");
  }

  function renderFailed() {
    const tbody = $("failed-body");
    if (!tbody) return;
    const rows = state.failedTrades.slice(0, 50).map((f) => {
      const opp = f.opportunity || {};
      return (
        "<tr class=\"row-error\">" +
        "<td>" + (f.timestamp ? fmtTime(f.timestamp) : "—") + "</td>" +
        "<td>" + (f.error || "—") + "</td>" +
        "<td>" + fmtNum(opp.price_up) + "</td>" +
        "<td>" + fmtNum(opp.price_down) + "</td>" +
        "</tr>"
      );
    });
    tbody.innerHTML = rows.join("");
  }

  function applyState(newState) {
    if (newState.opportunities) state.opportunities = newState.opportunities;
    if (newState.trades) state.trades = newState.trades;
    if (newState.failedTrades) state.failedTrades = newState.failedTrades;
    if (newState.marketData) state.marketData = newState.marketData;
    if (newState.stats) state.stats = newState.stats;
    if (typeof newState.running === "boolean") state.running = newState.running;
    renderStats();
    renderMarketData();
    renderOpportunities();
    renderTrades();
    renderFailed();
    updateButtons();
  }

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => setWsStatus(true);
    ws.onclose = () => {
      setWsStatus(false);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => setWsStatus(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "initial_state" && msg.data) {
          applyState(msg.data);
          return;
        }
        if (msg.type === "opportunity" && msg.data) {
          state.opportunities.unshift(msg.data);
          state.opportunities = state.opportunities.slice(0, 50);
          state.stats.opportunitiesFound = (state.stats.opportunitiesFound || 0) + 1;
          renderStats();
          renderOpportunities();
          return;
        }
        if (msg.type === "trade" && msg.data) {
          state.trades.unshift(msg.data);
          state.trades = state.trades.slice(0, 100);
          state.stats.tradesExecuted = (state.stats.tradesExecuted || 0) + 1;
          const opp = msg.data.opportunity;
          if (opp) {
            state.stats.totalInvested = (state.stats.totalInvested || 0) + (opp.total_investment || 0);
            state.stats.totalProfit = (state.stats.totalProfit || 0) + (opp.expected_profit || 0);
          }
          renderStats();
          renderTrades();
          return;
        }
        if (msg.type === "trade_failed" && msg.data) {
          state.failedTrades.unshift(msg.data);
          state.failedTrades = state.failedTrades.slice(0, 50);
          renderFailed();
          return;
        }
        if (msg.type === "market_update" && msg.data) {
          state.marketData = msg.data;
          renderMarketData();
        }
        if (msg.type === "status" && msg.data && typeof msg.data.running === "boolean") {
          state.running = msg.data.running;
          updateButtons();
        }
      } catch (e) {
        console.warn("WS parse error", e);
      }
    };
  }

  function fetchStatus() {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        state.running = !!data.running;
        updateButtons();
      })
      .catch(() => updateButtons());
  }

  const startBtn = $("btn-start");
  const stopBtn = $("btn-stop");
  if (startBtn) {
    startBtn.addEventListener("click", function () {
      if (state.running) return;
      fetch("/api/start", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) state.running = true;
          updateButtons();
        })
        .catch(() => {});
    });
  }
  if (stopBtn) {
    stopBtn.addEventListener("click", function () {
      if (!state.running) return;
      fetch("/api/stop", { method: "POST" })
        .then((r) => r.json())
        .then(() => {
          state.running = false;
          updateButtons();
        })
        .catch(() => {});
    });
  }

  connect();
  fetchStatus();
})();
