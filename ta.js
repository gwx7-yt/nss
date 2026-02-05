(function () {
  const state = {
    companies: [],
    selectedSecurityId: null,
    candles: [],
    overlaySeries: {},
    oscSeries: {},
    debounceTimer: null,
    chartsReady: false,
    priceChart: null,
    volumeChart: null,
    oscChart: null,
    candleSeries: null,
    volumeSeries: null,
    currentIndicators: new Set(),
  };

  function getApiBase() {
    return typeof API_BASE !== 'undefined' ? API_BASE : '';
  }

  async function fetchCompanyList() {
    const res = await fetch(`${getApiBase()}/SecurityList`);
    if (!res.ok) throw new Error('Failed to load company list');
    return res.json();
  }

  async function fetchTAHistory(securityId) {
    const res = await fetch(`${getApiBase()}/api/ta/history?securityId=${encodeURIComponent(securityId)}`);
    if (!res.ok) throw new Error('Failed to load TA history');
    return res.json();
  }

  async function fetchTAIndicators(securityId, indicatorsCsv) {
    const res = await fetch(`${getApiBase()}/api/ta/indicators?securityId=${encodeURIComponent(securityId)}&indicators=${encodeURIComponent(indicatorsCsv)}`);
    if (!res.ok) throw new Error('Failed to load indicators');
    return res.json();
  }

  function ensureCharts() {
    if (state.chartsReady) return;
    const common = { layout: { background: { color: '#ffffff' }, textColor: '#111827' }, grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true } };
    state.priceChart = LightweightCharts.createChart(document.getElementById('taPriceChart'), { ...common, height: 360 });
    state.volumeChart = LightweightCharts.createChart(document.getElementById('taVolumeChart'), { ...common, height: 140 });
    state.oscChart = LightweightCharts.createChart(document.getElementById('taOscChart'), { ...common, height: 220 });
    state.candleSeries = state.priceChart.addCandlestickSeries();
    state.volumeSeries = state.volumeChart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    state.chartsReady = true;
    syncCharts();
  }

  function syncCharts() {
    const charts = [state.priceChart, state.volumeChart, state.oscChart];
    charts.forEach((src) => {
      src.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        charts.forEach((target) => { if (target !== src) target.timeScale().setVisibleLogicalRange(range); });
      });
    });
  }

  function renderCandles(candles) {
    ensureCharts();
    state.candleSeries.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  }

  function renderVolume(candles) {
    ensureCharts();
    state.volumeSeries.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? '#16a34a88' : '#dc262688' })));
  }

  function clearOverlays() {
    Object.values(state.overlaySeries).forEach((series) => state.priceChart.removeSeries(series));
    state.overlaySeries = {};
    Object.values(state.oscSeries).forEach((series) => state.oscChart.removeSeries(series));
    state.oscSeries = {};
  }

  function renderOverlayLine(name, seriesData) {
    const colors = { sma20: '#2563eb', ema50: '#f59e0b' };
    const line = state.priceChart.addLineSeries({ color: colors[name] || '#4b5563', lineWidth: 2 });
    line.setData(seriesData);
    state.overlaySeries[name] = line;
  }

  function renderRSI(seriesData) {
    const rsi = state.oscChart.addLineSeries({ color: '#7c3aed', lineWidth: 2 });
    rsi.setData(seriesData);
    state.oscSeries.rsi14 = rsi;
    const overbought = state.oscChart.addLineSeries({ color: '#ef4444', lineWidth: 1, lineStyle: 2 });
    const oversold = state.oscChart.addLineSeries({ color: '#22c55e', lineWidth: 1, lineStyle: 2 });
    const guides = seriesData.map((p) => ({ time: p.time }));
    overbought.setData(guides.map((p) => ({ time: p.time, value: 70 })));
    oversold.setData(guides.map((p) => ({ time: p.time, value: 30 })));
    state.oscSeries.rsi70 = overbought;
    state.oscSeries.rsi30 = oversold;
  }

  function renderMACD(macdObj) {
    const macdLine = state.oscChart.addLineSeries({ color: '#2563eb', lineWidth: 2 });
    const signalLine = state.oscChart.addLineSeries({ color: '#f97316', lineWidth: 2 });
    const hist = state.oscChart.addHistogramSeries({ priceScaleId: '' });
    macdLine.setData(macdObj.macd || []);
    signalLine.setData(macdObj.signal || []);
    hist.setData((macdObj.hist || []).map((x) => ({ time: x.time, value: x.value, color: x.value >= 0 ? '#16a34a88' : '#dc262688' })));
    state.oscSeries.macd = macdLine;
    state.oscSeries.signal = signalLine;
    state.oscSeries.hist = hist;
  }

  function renderBollinger(bbObj) {
    ['upper', 'middle', 'lower'].forEach((k, idx) => {
      const colors = ['#0891b2', '#64748b', '#0891b2'];
      const line = state.priceChart.addLineSeries({ color: colors[idx], lineWidth: 1 });
      line.setData(bbObj[k] || []);
      state.overlaySeries[`bb20_${k}`] = line;
    });
  }

  function setLoading(show) {
    document.getElementById('taLoading').style.display = show ? 'block' : 'none';
    document.getElementById('taChartArea').style.display = show ? 'none' : 'block';
    document.getElementById('taError').style.display = 'none';
  }

  function setError(message) {
    document.getElementById('taErrorMessage').textContent = message;
    document.getElementById('taError').style.display = 'block';
    document.getElementById('taChartArea').style.display = 'none';
    document.getElementById('taLoading').style.display = 'none';
  }

  async function loadHistoryAndRender(securityId) {
    setLoading(true);
    try {
      const history = await fetchTAHistory(securityId);
      state.candles = history.candles || [];
      renderCandles(state.candles);
      renderVolume(state.candles);
      await updateIndicators();
      setLoading(false);
    } catch (e) {
      setError('Could not load chart data. Please retry.');
    }
  }

  async function updateIndicators() {
    clearOverlays();
    if (!state.currentIndicators.size) return;
    const csv = Array.from(state.currentIndicators).join(',');
    const payload = await fetchTAIndicators(state.selectedSecurityId, csv);
    const series = payload.series || {};
    if (series.sma20) renderOverlayLine('sma20', series.sma20);
    if (series.ema50) renderOverlayLine('ema50', series.ema50);
    if (series.rsi14) renderRSI(series.rsi14);
    if (series.macd) renderMACD(series.macd);
    if (series.bb20) renderBollinger(series.bb20);
  }

  function populateCompanies(companies) {
    const select = document.getElementById('taCompanySelect');
    select.innerHTML = '';
    companies.forEach((company) => {
      const opt = document.createElement('option');
      const secId = company.id ?? company.securityId;
      opt.value = secId;
      const symbol = company.symbol || company.stockSymbol || `#${secId}`;
      const name = company.companyName || company.securityName || symbol;
      opt.textContent = `${symbol} - ${name}`;
      select.appendChild(opt);
    });
  }

  function renderSearchResults(filtered) {
    const results = document.getElementById('taCompanyResults');
    if (!filtered.length) {
      results.style.display = 'none';
      return;
    }
    results.innerHTML = filtered.slice(0, 10).map((item) => { const secId = item.id ?? item.securityId; const symbol = item.symbol || item.stockSymbol || `#${secId}`; const name = item.companyName || item.securityName || symbol; return `<div class="ta-company-item" data-id="${secId}">${symbol} - ${name}</div>`; }).join('');
    results.style.display = 'block';
  }

  function initSearch() {
    const search = document.getElementById('taCompanySearch');
    const results = document.getElementById('taCompanyResults');
    search.addEventListener('input', () => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        const q = search.value.trim().toLowerCase();
        if (!q) return renderSearchResults([]);
        const filtered = state.companies.filter((c) => { const secId = c.id ?? c.securityId; if (!secId) return false; const symbol = c.symbol || c.stockSymbol || ''; const name = c.companyName || c.securityName || ''; return (`${symbol} ${name}`).toLowerCase().includes(q); });
        renderSearchResults(filtered);
      }, 300);
    });
    results.addEventListener('click', (e) => {
      const item = e.target.closest('.ta-company-item');
      if (!item) return;
      document.getElementById('taCompanySelect').value = item.dataset.id;
      results.style.display = 'none';
      onSecurityChange(item.dataset.id);
    });
  }

  function onSecurityChange(securityId) {
    state.selectedSecurityId = Number(securityId);
    loadHistoryAndRender(state.selectedSecurityId);
  }

  function initIndicatorToggles() {
    const panel = document.getElementById('taIndicatorPanel');
    panel.addEventListener('change', async (e) => {
      if (e.target.type !== 'checkbox') return;
      if (e.target.checked) state.currentIndicators.add(e.target.value);
      else state.currentIndicators.delete(e.target.value);
      try { await updateIndicators(); } catch (err) { setError('Indicator fetch failed. Retry.'); }
    });
    const mobileBtn = document.getElementById('taIndicatorToggleBtn');
    mobileBtn.addEventListener('click', () => panel.classList.toggle('open'));
  }

  async function initTA() {
    if (!document.getElementById('technical-analysis')) return;
    try {
      state.companies = await fetchCompanyList();
      populateCompanies(state.companies);
      initSearch();
      initIndicatorToggles();
      document.getElementById('taCompanySelect').addEventListener('change', (e) => onSecurityChange(e.target.value));
      document.getElementById('taRetryBtn').addEventListener('click', () => onSecurityChange(state.selectedSecurityId));
      if (state.companies.length) {
        const firstId = state.companies[0].id ?? state.companies[0].securityId;
        if (firstId) {
          document.getElementById('taCompanySelect').value = firstId;
          onSecurityChange(firstId);
        }
      }
    } catch (e) {
      setError('Unable to initialize technical analysis module.');
    }
  }

  window.fetchTAHistory = fetchTAHistory;
  window.fetchTAIndicators = fetchTAIndicators;
  window.renderCandles = renderCandles;
  window.renderVolume = renderVolume;
  window.renderOverlayLine = renderOverlayLine;
  window.renderRSI = renderRSI;
  window.renderMACD = renderMACD;
  window.renderBollinger = renderBollinger;

  document.addEventListener('DOMContentLoaded', initTA);
})();
