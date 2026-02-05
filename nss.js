// Store company information globally
let companyDetails = new Map();
let currentSectorFilter = 'All';
let latestSectorCounts = new Map();
const activeSellRequests = new Set();
const API_BASE = "https://nss-c26z.onrender.com";
let allStocksData = [];
let currentSortOption = 'name-asc';
let currentSearchTerm = '';
let navigationInitialized = false;
let currentPortfolioSort = 'pl';
let portfolioRenderToken = 0;
let polishIntroInitialized = false;
let tableHintInitialized = false;


// Default credits given to new users (10 lakh)
const DEFAULT_CREDITS = 1000000;


function getCurrentLanguage() {
  return localStorage.getItem('language') || 'english';
}

const sectorTranslations = {
  nepali: {
    'Commercial Banks': 'वाणिज्य बैंक',
    'Development Banks': 'विकास बैंक',
    'Finance': 'वित्त',
    'Hotels And Tourism': 'होटल तथा पर्यटन',
    'Hydro Power': 'जलविद्युत',
    'Hydropower': 'जलविद्युत',
    'Investment': 'लगानी',
    'Life Insurance': 'जीवन बीमा',
    'Manufacturing And Processing': 'उत्पादन र प्रशोधन',
    'Microfinance': 'लघुवित्त',
    'Mutual Fund': 'सामूहिक लगानी कोष',
    'Non Life Insurance': 'गैर जीवन बीमा',
    'Others': 'अन्य',
    'Tradings': 'व्यापार',
    'Corporate Debenture': 'कर्पोरेट डिबेन्चर',
    'Corporate Debentures': 'कर्पोरेट डिबेन्चर',
    'Preference Shares': 'प्राथमिकता सेयर',
    'Promoter Share': 'प्रमोटर सेयर',
    'N/A': 'उपलब्ध छैन'
  }
};

function getLocalizedSectorName(sectorName, language = getCurrentLanguage()) {
  if (isNepaliLanguage(language)) {
    return sectorTranslations.nepali[sectorName] || sectorName;
  }
  return sectorName;
}


// Loading and Tutorial Management
let currentStep = 1;
const totalSteps = 5;

// Check if this is the first visit
function isFirstVisit() {
  return !localStorage.getItem('hasVisitedBefore');
}

// Fetch and store company details
function fetchCompanyDetails() {
  fetch("https://nss-c26z.onrender.com/CompanyList")
    .then(res => res.json())
    .then(data => {
      companyDetails.clear();
      data.forEach(company => {
        companyDetails.set(company.symbol, {
          name: company.companyName,
          sector: company.sectorName,
          type: company.instrumentType
        });
      });
      // After getting company details, load stocks
      loadAllStocks();
    })
    .catch((error) => {
      console.error("⚠️ Error fetching company details:", error);
      // Still try to load stocks even if company details fail
      loadAllStocks();
    });
}

// Handle loading screen and tutorial initialization
document.addEventListener("DOMContentLoaded", () => {
  // Loading screen will automatically fade out after 4 seconds due to CSS animation
  
  // Check if this is the first visit
  if (isFirstVisit()) {
    // Show tutorial after loading screen fades
    setTimeout(() => {
      const tutorialOverlay = document.getElementById('tutorialOverlay');
      tutorialOverlay.style.display = 'flex';
      showTutorialStep(1);
    }, 4000);
  }

  // Initialize other features
  fetchCompanyDetails();
  fetchTopGainers();
  fetchTopLosers();
  initCredits();
  upgradeOldUsers();
  updatePortfolio();
  initPortfolioSortControls();
  initNavigation();
  initSortControls();
  initDigitNormalizationObserver();
  initPolishEnhancements();

});

function fetchTopGainers() {
  fetch("https://nss-c26z.onrender.com/TopGainers")
    .then(res => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      const tbody = document.querySelector("#gainersTable tbody");
      if (tbody) {
        tbody.innerHTML = "";
      data.slice(0, 10).forEach(item => {
          const row = document.createElement("tr");
          const ltpNumber = parseFloat(item.ltp);
          const percentageNumber = parseFloat(item.percentageChange);
          const currentLanguage = getCurrentLanguage();
          const ltpDisplay = Number.isFinite(ltpNumber)
            ? formatPrice(ltpNumber, currentLanguage)
            : formatPrice(item.ltp, currentLanguage);
          const percentageDisplay = Number.isFinite(percentageNumber)
            ? formatPercent(percentageNumber, currentLanguage, { decimals: 2, showSign: true })
            : formatPercent(item.percentageChange, currentLanguage, { decimals: 2, showSign: true });
          row.innerHTML = `
            <td>${item.symbol}</td>
            <td>${wrapNumberDisplay(ltpDisplay)}</td>
            <td class="gain">${wrapNumberDisplay(percentageDisplay)}</td>
          `;
          tbody.appendChild(row);
        });
      }
    })
    .catch(() => {
      console.error("⚠️ Error fetching top gainers");
    });
}

function fetchTopLosers() {
  fetch("https://nss-c26z.onrender.com/TopLosers")
    .then(res => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      const tbody = document.querySelector("#losersTable tbody");
      if (tbody) {
        tbody.innerHTML = "";
      data.slice(0, 10).forEach(item => {
          const row = document.createElement("tr");
          const ltpNumber = parseFloat(item.ltp);
          const percentageNumber = parseFloat(item.percentageChange);
          const currentLanguage = getCurrentLanguage();
          const ltpDisplay = Number.isFinite(ltpNumber)
            ? formatPrice(ltpNumber, currentLanguage)
            : formatPrice(item.ltp, currentLanguage);
          const changeClass = !Number.isNaN(percentageNumber) && percentageNumber >= 0 ? 'gain' : 'loss';
          const percentageDisplay = Number.isFinite(percentageNumber)
            ? formatPercent(percentageNumber, currentLanguage, { decimals: 2, showSign: true })
            : formatPercent(item.percentageChange, currentLanguage, { decimals: 2, showSign: true });
          row.innerHTML = `
            <td>${item.symbol}</td>
            <td>${wrapNumberDisplay(ltpDisplay)}</td>
            <td class="${changeClass}">${wrapNumberDisplay(percentageDisplay)}</td>
          `;
          tbody.appendChild(row);
        });
      }
    })
    .catch(() => {
      console.error("⚠️ Error fetching top losers");
    });
}

function initCredits() {
  const credits = parseFloat(localStorage.getItem('credits') || DEFAULT_CREDITS.toString());
  localStorage.setItem('credits', credits.toString());

  // Ensure a user object exists
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user')) || {};
  } catch (e) {
    user = {};
  }
  if (!user.credits) {
    user.credits = credits;
    localStorage.setItem('user', JSON.stringify(user));
  }

  updateCreditDisplay();
}

function updateCreditDisplay() {
  const creditBalance = document.getElementById('creditBalance');
  if (creditBalance) {
    const credits = parseFloat(localStorage.getItem('credits') || DEFAULT_CREDITS.toString());
    setNumberText(creditBalance, formatNumber(credits, { decimals: 2, useCommas: true }, getCurrentLanguage()));
  }
}

// Simple toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// Upgrade legacy users to new starter pack
function upgradeOldUsers() {
  let user;
  try {
    user = JSON.parse(localStorage.getItem('user'));
  } catch (e) {
    user = null;
  }
  if (!user) return;
  if (user.credits < DEFAULT_CREDITS && !user.updatedToNewStarterPack) {
    user.credits = DEFAULT_CREDITS;
    user.updatedToNewStarterPack = true;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('credits', user.credits.toString());
    const currentLanguage = getCurrentLanguage();
    const creditsDisplay = formatNumber(DEFAULT_CREDITS, { decimals: 2, useCommas: true }, currentLanguage);
    showToast(`🎉 You've been upgraded to ${wrapNumberDisplay(creditsDisplay)} credits!`);
  }
}

// Trade Modal Functions
let currentStockData = null;

function openTradeModal(symbol) {
  fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${symbol}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      currentStockData = data;
      const currentLanguage = getCurrentLanguage();

      // Get modal elements
      const modalStockSymbol = document.getElementById("modalStockSymbol");
      const modalStockPrice = document.getElementById("modalStockPrice");
      const modalTradeShares = document.getElementById("modalTradeShares");
      const modalPricePreview = document.getElementById("modalPricePreview");
      const modalBrokerFeePreview = document.getElementById("modalBrokerFeePreview");
      const modalSebonFeePreview = document.getElementById("modalSebonFeePreview");
      const modalDpFeePreview = document.getElementById("modalDpFeePreview");
      const modalCostPreview = document.getElementById("modalCostPreview");
      const tradeModal = document.getElementById("tradeModal");

      // Check if elements exist before setting content
      if (modalStockSymbol) modalStockSymbol.textContent = symbol;
      if (modalStockPrice) setNumberText(modalStockPrice, formatPrice(parseFloat(data.price), currentLanguage));
      if (modalTradeShares) {
        modalTradeShares.value = "";
        modalTradeShares.removeEventListener("input", updateCostPreview);
        modalTradeShares.addEventListener("input", updateCostPreview);
      }
      const zeroDisplay = formatNumber(0, { decimals: 0, useCommas: true }, currentLanguage);
      setNumberText(modalPricePreview, zeroDisplay);
      setNumberText(modalBrokerFeePreview, zeroDisplay);
      setNumberText(modalSebonFeePreview, zeroDisplay);
      setNumberText(modalDpFeePreview, zeroDisplay);
      setNumberText(modalCostPreview, zeroDisplay);
      updateCostPreview();
      if (tradeModal) {
        tradeModal.style.display = "block";
        tradeModal.setAttribute('aria-hidden', 'false');
        if (modalTradeShares) modalTradeShares.focus();
      }
    })
    .catch(error => {
      console.error("Error fetching stock price:", error);
      showToast(`❌ Error: ${error.message || 'Could not fetch stock price. Please try again.'}`);
    });
}

function closeTradeModal() {
  const tradeModal = document.getElementById("tradeModal");
  if (tradeModal) {
    tradeModal.style.display = "none";
    tradeModal.setAttribute('aria-hidden', 'true');
  }
  currentStockData = null;
}

function updateCostPreview() {
  const shares = parseFloat(document.getElementById("modalTradeShares").value) || 0;
  const price = currentStockData ? parseFloat(currentStockData.price) : 0;
  const base = shares * price;
  const brokerFee = base * 0.006;
  const sebonFee = base * 0.00015;
  const dpFee = base * 0.001;
  const total = base + brokerFee + sebonFee + dpFee;

  const pricePreview = document.getElementById("modalPricePreview");
  const brokerFeePreview = document.getElementById("modalBrokerFeePreview");
  const sebonFeePreview = document.getElementById("modalSebonFeePreview");
  const dpFeePreview = document.getElementById("modalDpFeePreview");
  const costPreview = document.getElementById("modalCostPreview");

  const currentLanguage = getCurrentLanguage();
  setNumberText(pricePreview, formatPrice(base, currentLanguage));
  setNumberText(brokerFeePreview, formatPrice(brokerFee, currentLanguage));
  setNumberText(sebonFeePreview, formatPrice(sebonFee, currentLanguage));
  setNumberText(dpFeePreview, formatPrice(dpFee, currentLanguage));
  setNumberText(costPreview, formatPrice(total, currentLanguage));
}

function confirmTrade() {
  const shares = parseFloat(document.getElementById("modalTradeShares").value);
  let credits = parseFloat(localStorage.getItem("credits")) || DEFAULT_CREDITS;

  if (!shares || shares <= 0) {
    showToast("❌ Please enter a valid number of shares!");
    return;
  }

  if (shares < 10) {
    const currentLanguage = getCurrentLanguage();
    const minSharesDisplay = formatNumber(10, { decimals: 0, useCommas: true }, currentLanguage);
    showToast(`❌ Minimum trade is ${wrapNumberDisplay(minSharesDisplay)} shares!`);

    return;
  }

  const symbol = currentStockData.symbol;
  const price = parseFloat(currentStockData.price);
  const base = shares * price;
  const brokerFee = base * 0.006;
  const sebonFee = base * 0.00015;
  const dpFee = base * 0.001;
  const total = base + brokerFee + sebonFee + dpFee;

  if (total > credits) {
    showToast("❌ Not enough credits!");
    return;
  }

  // Update credits
  const creditsBefore = credits;
  credits -= total;
  localStorage.setItem("credits", credits.toString());
  updateCreditDisplay();

  // Save investment
  const investment = {
    symbol,
    amount: total.toString(),
    price: price.toString(),
    quantity: shares.toString(),
    date: new Date().toLocaleDateString()
  };

      const investments = JSON.parse(localStorage.getItem("investments")) || [];
      investments.push(investment);
      localStorage.setItem("investments", JSON.stringify(investments));

  recordTransaction({
    type: "BUY",
    symbol,
    quantity: shares.toString(),
    price: price.toString(),
    total: total.toString(),
    timestampISO: new Date().toISOString(),
    creditsBefore: creditsBefore.toString(),
    creditsAfter: credits.toString()
  });

  // Update UI
  updatePortfolio();
  closeTradeModal();
  const currentLanguage = getCurrentLanguage();
  const sharesDisplay = formatNumber(shares, { decimals: 0, useCommas: true }, currentLanguage);
  const totalDisplay = formatNumber(total, { decimals: 2, useCommas: true }, currentLanguage);
  showToast(`✅ Purchased ${wrapNumberDisplay(sharesDisplay)} shares of ${symbol} for ${wrapNumberDisplay(totalDisplay)} credits!`);
}

// Update search result click handler
function handleSearchResultClick(symbol) {
  const stockRow = document.querySelector(`#allStocksTable tr[data-symbol="${symbol}"]`);
  if (stockRow) {
    stockRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    stockRow.classList.add('highlight');
    setTimeout(() => stockRow.classList.remove('highlight'), 2000);
  }
  openTradeModal(symbol);
}

function parsePercentChange(stock) {
  const rawPercent = stock.changePercent ?? stock.percentageChange ?? stock.percentChange;
  if (rawPercent !== undefined && rawPercent !== null) {
    const cleaned = String(rawPercent).replace('%', '').trim();
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const changeValue = parseFloat(stock.change);
  const priceValue = parseFloat(stock.price ?? stock.ltp);
  if (Number.isFinite(changeValue) && Number.isFinite(priceValue)) {
    const base = priceValue - changeValue;
    if (base !== 0) {
      const calculated = (changeValue / base) * 100;
      if (Number.isFinite(calculated)) {
        return calculated;
      }
    }
  }

  return null;
}

function computeSectorAverages(stocks) {
  const sums = new Map();
  const counts = new Map();

  stocks.forEach(stock => {
    if (!Number.isFinite(stock.percentChange)) {
      return;
    }
    const sector = stock.sectorName || 'N/A';
    sums.set(sector, (sums.get(sector) || 0) + stock.percentChange);
    counts.set(sector, (counts.get(sector) || 0) + 1);
  });

  const averages = new Map();
  sums.forEach((sum, sector) => {
    const count = counts.get(sector) || 0;
    averages.set(sector, count >= 2 ? sum / count : null);
  });

  return averages;
}

function formatRelativeStrength(value, language) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const prefix = value > 0 ? '+' : '';
  const formatted = formatNumber(value, { decimals: 1 }, language);
  return `${prefix}${formatted}`;
}

function getFilteredStocks() {
  const searchActive = currentSearchTerm.length >= 2;
  const searchLower = currentSearchTerm.toLowerCase();

  return allStocksData.filter(stock => {
    const sectorMatch = currentSectorFilter === 'All' || stock.sectorName === currentSectorFilter;
    if (!sectorMatch) {
      return false;
    }

    if (!searchActive) {
      return true;
    }

    const symbolMatch = stock.symbol.toLowerCase().includes(searchLower);
    const nameMatch = (stock.companyName || '').toLowerCase().includes(searchLower);
    return symbolMatch || nameMatch;
  });
}

function compareNumericWithNulls(aValue, bValue, direction = 'desc') {
  const aValid = Number.isFinite(aValue);
  const bValid = Number.isFinite(bValue);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return direction === 'asc' ? aValue - bValue : bValue - aValue;
}

function getSortableName(stock) {
  const rawName = stock.companyName ?? '';
  const trimmedName = typeof rawName === 'string' ? rawName.trim() : String(rawName).trim();
  const effectiveName = trimmedName.length > 0 ? trimmedName : stock.symbol || '';
  return effectiveName.toLowerCase();
}

function sortStocks(stocks) {
  const mapped = stocks.map((stock, index) => ({ stock, index }));

  mapped.sort((a, b) => {
    const aStock = a.stock;
    const bStock = b.stock;
    let result = 0;

    switch (currentSortOption) {
      case 'name-asc': {
        const nameA = getSortableName(aStock);
        const nameB = getSortableName(bStock);
        result = nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
        break;
      }
      case 'name-desc': {
        const nameA = getSortableName(aStock);
        const nameB = getSortableName(bStock);
        result = nameB.localeCompare(nameA, 'en', { sensitivity: 'base' });
        break;
      }
      case 'change-asc':
        result = compareNumericWithNulls(aStock.percentChange, bStock.percentChange, 'asc');
        break;
      case 'change-desc':
        result = compareNumericWithNulls(aStock.percentChange, bStock.percentChange, 'desc');
        break;
      case 'rs-asc':
        result = compareNumericWithNulls(aStock.relativeStrength, bStock.relativeStrength, 'asc');
        break;
      case 'rs-desc':
        result = compareNumericWithNulls(aStock.relativeStrength, bStock.relativeStrength, 'desc');
        break;
      default:
        result = 0;
    }

    if (result === 0) {
      result = a.index - b.index;
    }
    return result;
  });

  return mapped.map(item => item.stock);
}

function renderAllStocksTable() {
  const tbody = document.querySelector("#allStocksTable tbody");
  if (!tbody) return;

  const currentLanguage = getCurrentLanguage();
  const filteredStocks = getFilteredStocks();
  const sortedStocks = sortStocks(filteredStocks);

  tbody.innerHTML = "";

  sortedStocks.forEach(stock => {
    const row = document.createElement("tr");
    row.setAttribute('data-symbol', stock.symbol);
    row.dataset.sector = stock.sectorName || 'N/A';

    const priceDisplay = Number.isFinite(stock.priceNumber)
      ? formatPrice(stock.priceNumber, currentLanguage)
      : formatPrice(stock.priceRaw, currentLanguage);

    let changeClass = 'gain';
    let changeDisplay = '—';
    if (Number.isFinite(stock.percentChange)) {
      changeClass = stock.percentChange >= 0 ? 'gain' : 'loss';
      changeDisplay = formatPercent(stock.percentChange, currentLanguage, { decimals: 2, showSign: true });
    } else if (stock.changeRaw) {
      const rawChange = String(stock.changeRaw).trim();
      changeClass = rawChange.startsWith('-') ? 'loss' : 'gain';
      changeDisplay = formatPercent(rawChange, currentLanguage, { decimals: 2, showSign: true });
    }

    const rsDisplay = formatRelativeStrength(stock.relativeStrength, currentLanguage);
    const rsClass = Number.isFinite(stock.relativeStrength)
      ? (stock.relativeStrength > 0 ? 'gain' : stock.relativeStrength < 0 ? 'loss' : '')
      : '';
    const tradeLabel = getTranslationValue('trade', 'Trade');

    row.innerHTML = `
      <td>${stock.symbol}</td>
      <td>${companyNameForLang(stock.companyName, currentLanguage)}</td>
      <td>${getLocalizedSectorName(stock.sectorName || 'N/A', currentLanguage)}</td>
      <td>${wrapNumberDisplay(priceDisplay)}</td>
      <td class="${changeClass}">${wrapNumberDisplay(changeDisplay)}</td>
      <td class="${rsClass}">${wrapNumberDisplay(rsDisplay)}</td>
      <td><button onclick="openTradeModal('${stock.symbol}')" class="trade-btn">${tradeLabel}</button></td>
    `;
    tbody.appendChild(row);
  });

  const emptyState = document.getElementById('sectorEmptyState');
  if (emptyState) {
    emptyState.style.display = filteredStocks.length === 0 ? 'block' : 'none';
    if (filteredStocks.length === 0) {
      emptyState.textContent = getTranslationValue('noSectorResults', 'No stocks found for this sector.');
    }
  }

  updateSelectedSectorLabel();
}

function updateSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(button => {
    const isActive = button.dataset.sort === currentSortOption;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function initSortControls() {
  const sortButtons = document.querySelectorAll('.sort-btn');
  if (!sortButtons.length) {
    return;
  }

  sortButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sortValue = button.dataset.sort;
      if (!sortValue || sortValue === currentSortOption) {
        return;
      }
      currentSortOption = sortValue;
      updateSortButtons();
      renderAllStocksTable();
    });
  });

  updateSortButtons();
}

// Update loadAllStocks function to add data attributes and new trade button
function loadAllStocks() {
  fetch("https://nss-c26z.onrender.com/AllStocks")
    .then(res => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      const tbody = document.querySelector("#allStocksTable tbody");
      if (tbody) {
        const sectorCounts = new Map();
        allStocksData = data.map(stock => {
          const companyInfo = companyDetails.get(stock.symbol) || { name: stock.symbol, sector: 'N/A' };
          const sectorName = companyInfo.sector || 'N/A';
          sectorCounts.set(sectorName, (sectorCounts.get(sectorName) || 0) + 1);

          const priceNumber = parseFloat(stock.price);
          const percentChange = parsePercentChange(stock);

          return {
            symbol: stock.symbol,
            companyName: companyInfo.name,
            sectorName,
            priceNumber: Number.isFinite(priceNumber) ? priceNumber : null,
            priceRaw: stock.price,
            changeRaw: stock.changePercent,
            percentChange
          };
        });

        const sectorAverages = computeSectorAverages(allStocksData);
        allStocksData = allStocksData.map(stock => {
          const sectorAverage = sectorAverages.get(stock.sectorName);
          const relativeStrength = Number.isFinite(stock.percentChange) && Number.isFinite(sectorAverage)
            ? stock.percentChange - sectorAverage
            : null;
          return {
            ...stock,
            relativeStrength
          };
        });

        latestSectorCounts = new Map(sectorCounts);
        renderSectorFilters(latestSectorCounts);
        renderAllStocksTable();
      }
    })
    .catch(() => {
      console.error("⚠️ Error loading all stocks");
    });
}

function getTranslationValue(key, fallback = '') {
  const currentLanguage = getCurrentLanguage();
  const languageTexts = translations[currentLanguage] || {};
  return languageTexts[key] || fallback;
}

function toNum(value) {
  return Number(String(value ?? '').replace(/,/g, ''));
}

function wrapNumberDisplay(value) {
  return `<span class="np-number">${value}</span>`;
}

function setNumberText(element, value) {
  if (!element) {
    return;
  }
  element.textContent = value;
  element.classList.add('np-number');
}

function getNumberFontFamily(language = getCurrentLanguage()) {
  if (isNepaliLanguage(language)) {
    return '"Noto Sans Devanagari", "Mukta", "Hind", sans-serif';
  }
  return '"Inter", "Poppins", "Roboto", sans-serif';
}

function normalizeNumberNodes(language) {
  const nodes = document.querySelectorAll('.np-number');
  if (!nodes.length) {
    return;
  }
  const isNepali = isNepaliLanguage(language);
  nodes.forEach(node => {
    if (!node.textContent) {
      return;
    }
    const baseText = typeof toEnglishNumerals === 'function'
      ? toEnglishNumerals(node.textContent)
      : node.textContent;
    node.textContent = isNepali ? toNepaliNumerals(baseText) : baseText;
  });
}

const homeDashboardState = {
  sectorChart: null,
  latestPriceVolume: null,
  latestSectorOverview: null,
  lastBreadth: null,
  lastSectorMetrics: null,
  lastTimeLabel: null,
  marketOpen: null
};

function initializeHomeDashboard() {
  const sectorCanvas = document.getElementById('homeSectorChart');
  if (!sectorCanvas) {
    return;
  }

  tickHomeDashboard();
  setInterval(tickHomeDashboard, 20000);
}

async function tickHomeDashboard() {
  const now = new Date();
  const timeLabel = formatKathmanduTime(now);
  const marketOpen = isMarketOpenKathmandu(now);
  homeDashboardState.lastTimeLabel = timeLabel;
  homeDashboardState.marketOpen = marketOpen;

  updateMarketStatus(marketOpen, timeLabel);

  let priceVolume = null;
  let sectorOverview = null;
  let dataUpdated = false;

  try {
    [priceVolume, sectorOverview] = await Promise.all([
      fetchHomeData(`${API_BASE}/PriceVolume`),
      fetchHomeData(`${API_BASE}/SectorOverview`)
    ]);
    homeDashboardState.latestPriceVolume = priceVolume;
    homeDashboardState.latestSectorOverview = sectorOverview;
    dataUpdated = true;
  } catch (error) {
    priceVolume = homeDashboardState.latestPriceVolume;
    sectorOverview = homeDashboardState.latestSectorOverview;
  }

  if (priceVolume && sectorOverview && dataUpdated) {
    const breadth = calculateBreadth(priceVolume);
    const sectorMetrics = calculateSectorPerformance(sectorOverview, priceVolume);
    homeDashboardState.lastBreadth = breadth;
    homeDashboardState.lastSectorMetrics = sectorMetrics;
    renderBreadth(breadth);
    updateSectorChart(sectorMetrics);
    updateUpdatedStamp('homeSectorUpdated', timeLabel);
  }

  updateTodayCard({
    marketOpen,
    breadth: homeDashboardState.lastBreadth,
    sectorMetrics: homeDashboardState.lastSectorMetrics,
    indexChange: null
  });

  renderHotToday(priceVolume);
}

function refreshHomeDashboardLocale() {
  const timeLabel = homeDashboardState.lastTimeLabel;
  if (timeLabel !== null) {
    updateMarketStatus(homeDashboardState.marketOpen, timeLabel);
    updateUpdatedStamp('homeSectorUpdated', timeLabel);
  }

  if (homeDashboardState.lastBreadth) {
    renderBreadth(homeDashboardState.lastBreadth);
  }

  if (homeDashboardState.lastSectorMetrics) {
    updateSectorChart(homeDashboardState.lastSectorMetrics);
  }

  if (homeDashboardState.lastBreadth || homeDashboardState.lastSectorMetrics) {
    updateTodayCard({
      marketOpen: homeDashboardState.marketOpen,
      breadth: homeDashboardState.lastBreadth,
      sectorMetrics: homeDashboardState.lastSectorMetrics,
      indexChange: null
    });
  }

  if (homeDashboardState.latestPriceVolume) {
    renderHotToday(homeDashboardState.latestPriceVolume);
  }
}

function fetchHomeData(url) {
  return fetch(url, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response.json();
    });
}

function formatKathmanduTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatTimeLabel(value, language = getCurrentLanguage()) {
  return isNepaliLanguage(language) ? toNepaliNumerals(value) : value;
}

function getKathmanduTimeParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const dayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    day: dayMap[parts.weekday],
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10)
  };
}

function isMarketOpenKathmandu(date) {
  const { day, hour, minute } = getKathmanduTimeParts(date);
  if (day === 6) {
    return false;
  }
  if (hour < 11 || hour > 15) {
    return false;
  }
  if (hour === 15 && minute > 0) {
    return false;
  }
  return true;
}

function updateMarketStatus(isOpen, timeLabel) {
  const marketState = document.getElementById('homeMarketState');
  const lastUpdated = document.getElementById('homeLastUpdated');
  if (marketState) {
    marketState.textContent = getTranslationValue(isOpen ? 'open' : 'closed', isOpen ? 'OPEN' : 'CLOSED');
  }
  if (lastUpdated) {
    setNumberText(lastUpdated, formatTimeLabel(timeLabel, getCurrentLanguage()));
  }
}

function updateUpdatedStamp(id, timeLabel) {
  const element = document.getElementById(id);
  if (element) {
    setNumberText(element, formatTimeLabel(timeLabel, getCurrentLanguage()));
  }
}

function calculateBreadth(priceVolume) {
  if (!Array.isArray(priceVolume)) {
    return { adv: 0, dec: 0, unch: 0, total: 0 };
  }
  let adv = 0;
  let dec = 0;
  let unch = 0;

  priceVolume.forEach(row => {
    const change = parseFloat(row?.percentageChange ?? row?.changePercent ?? row?.percentage_change ?? row?.change);
    if (!Number.isFinite(change)) {
      return;
    }
    if (change > 0) {
      adv += 1;
    } else if (change < 0) {
      dec += 1;
    } else {
      unch += 1;
    }
  });

  return {
    adv,
    dec,
    unch,
    total: adv + dec + unch
  };
}

function renderBreadth(breadth) {
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      setNumberText(element, formatNumber(value, { decimals: 0, useCommas: true }, getCurrentLanguage()));
    }
  };

  setValue('homeAdv', breadth.adv);
  setValue('homeDec', breadth.dec);
  setValue('homeUnch', breadth.unch);
  setValue('homeTotal', breadth.total);
}

function calculateSectorPerformance(sectorOverview, priceVolume) {
  const sectors = Array.isArray(sectorOverview) ? sectorOverview : sectorOverview?.sectors || [];
  if (!Array.isArray(sectors)) {
    return [];
  }
  const quantityMap = new Map();
  const pctSamples = [];
  if (Array.isArray(priceVolume)) {
    priceVolume.forEach(row => {
      const symbol = row?.symbol || row?.companySymbol;
      if (!symbol) {
        return;
      }
      const qtyRaw = row?.totalTradeQuantity ?? row?.totalTradedQuantity;
      const qty = toNum(qtyRaw);
      if (Number.isFinite(qty)) {
        quantityMap.set(symbol, qty);
      }
    });
  }

  sectors.forEach(sector => {
    const companies = sector?.companies || sector?.companyList || sector?.items || [];
    companies.forEach(company => {
      const pct = toNum(company?.percentageChange ?? company?.changePercent ?? company?.percentage_change ?? company?.change);
      if (Number.isFinite(pct) && pct !== 0) {
        pctSamples.push(pct);
      }
    });
  });

  const sampleCount = pctSamples.length;
  const fractionalCount = pctSamples.filter(value => Math.abs(value) > 0 && Math.abs(value) < 0.5).length;
  const conversionFactor = sampleCount > 0 && fractionalCount / sampleCount > 0.6 ? 100 : 1;

  const sectorValues = sectors.map(sector => {
    const companies = sector?.companies || sector?.companyList || sector?.items || [];
    let weightedSum = 0;
    let totalQty = 0;
    let simpleSum = 0;
    let count = 0;

    companies.forEach(company => {
      const symbol = company?.symbol || company?.companySymbol;
      const rawPct = toNum(company?.percentageChange ?? company?.changePercent ?? company?.percentage_change ?? company?.change);
      const pct = Number.isFinite(rawPct) ? rawPct * conversionFactor : NaN;
      if (!Number.isFinite(pct)) {
        return;
      }
      const qty = symbol ? quantityMap.get(symbol) : null;
      if (qty && qty > 0) {
        weightedSum += qty * pct;
        totalQty += qty;
      }
      simpleSum += pct;
      count += 1;
    });

    if (count === 0) {
      return null;
    }

    const usedFallback = totalQty === 0;
    const value = usedFallback ? simpleSum / count : weightedSum / totalQty;
    return {
      sector: sector?.sectorName || sector?.name || sector?.sector || 'N/A',
      value,
      usedFallback
    };
  }).filter(Boolean);

  console.debug('Sector sample conversion factor:', conversionFactor);
  console.debug(
    'Sector values preview:',
    sectorValues.slice(0, 3).map(item => ({
      sector: item.sector,
      value: item.value,
      usedFallback: item.usedFallback
    }))
  );

  return sectorValues.map(({ sector, value }) => ({ sector, value }));
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    primary: styles.getPropertyValue('--primary-color').trim() || '#00b4d8',
    text: styles.getPropertyValue('--text-color').trim() || '#111111',
    muted: styles.getPropertyValue('--text-muted').trim() || '#666666',
    success: styles.getPropertyValue('--success-color').trim() || '#2ecc71',
    error: styles.getPropertyValue('--error-color').trim() || '#e74c3c'
  };
}

function updateSectorChart(sectorMetrics) {
  const canvas = document.getElementById('homeSectorChart');
  if (!canvas) {
    return;
  }

  const labels = sectorMetrics.map(item => getLocalizedSectorName(item.sector, getCurrentLanguage()));
  const values = sectorMetrics.map(item => Number(item.value.toFixed(2)));
  const colors = getChartColors();
  const barColors = values.map(value => (value >= 0 ? colors.success : colors.error));

  if (!homeDashboardState.sectorChart) {
    homeDashboardState.sectorChart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: barColors,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            bodyFont: {
              family: getNumberFontFamily(getCurrentLanguage())
            },
            callbacks: {
              label: context => `${formatNumber(context.parsed.y, { decimals: 2, useCommas: true }, getCurrentLanguage())}%`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: colors.text },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: colors.text,
              font: {
                family: getNumberFontFamily(getCurrentLanguage())
              },
              callback: value => `${formatNumber(value, { decimals: 0, useCommas: true }, getCurrentLanguage())}%`
            },
            grid: { color: colors.muted }
          }
        }
      }
    });
  } else {
    homeDashboardState.sectorChart.data.labels = labels;
    homeDashboardState.sectorChart.data.datasets[0].data = values;
    homeDashboardState.sectorChart.data.datasets[0].backgroundColor = barColors;
    homeDashboardState.sectorChart.options.plugins.tooltip.bodyFont.family = getNumberFontFamily(getCurrentLanguage());
    homeDashboardState.sectorChart.options.scales.y.ticks.font = {
      family: getNumberFontFamily(getCurrentLanguage())
    };
    homeDashboardState.sectorChart.update();
  }
}

function updateTodayCard({ marketOpen, breadth, sectorMetrics, indexChange }) {
  const textEl = document.getElementById('homeTodayCardText');
  const badgeEl = document.getElementById('homeTodayBadge');
  if (!textEl || !badgeEl) {
    return;
  }

  const adv = breadth?.adv ?? 0;
  const dec = breadth?.dec ?? 0;
  const topSector = getTopSectorLabel(sectorMetrics);
  const hasIndexChange = Number.isFinite(indexChange);

  let sentiment = 'mixed';
  if (adv > dec && (!hasIndexChange || indexChange >= 0)) {
    sentiment = 'bullish';
  } else if (dec > adv && (!hasIndexChange || indexChange <= 0)) {
    sentiment = 'bearish';
  }

  let sentence = '';
  const currentLanguage = getCurrentLanguage();
  const isNepali = isNepaliLanguage(currentLanguage);

  if (marketOpen) {
    if (sentiment === 'bullish') {
      sentence = topSector
        ? (isNepali
          ? `बजार आज सकारात्मक छ, ${topSector} मा बलियो खरिद देखिएको छ।`
          : `Markets are up so far today with broad buying and strength in ${topSector}.`)
        : (isNepali
          ? 'बजार आज सकारात्मक छ र व्यापक खरिद देखिएको छ।'
          : 'Markets are up so far today with broad buying.');
    } else if (sentiment === 'bearish') {
      sentence = isNepali
        ? 'बजार आज दबाबमा छ, बेच्ने दबाब बढी छ।'
        : 'Markets are under pressure today as selling outweighs buying.';
    } else {
      sentence = isNepali
        ? 'बजार आज मिश्रित छ, स्पष्ट दिशा छैन।'
        : 'Markets are mixed today with no clear direction yet.';
    }
  } else {
    if (sentiment === 'bullish') {
      sentence = topSector
        ? (isNepali
          ? `बजार आज उच्च बन्द भयो, ${topSector} ले नेतृत्व गर्‍यो।`
          : `The market closed higher today, led by strength in ${topSector}.`)
        : (isNepali
          ? 'बजार आज उच्च बन्द भयो।'
          : 'The market closed higher today.');
    } else if (sentiment === 'bearish') {
      sentence = isNepali
        ? 'बजार आज घटेर बन्द भयो, बेच्ने दबाब हाबी रह्यो।'
        : 'The market closed lower today amid broad selling pressure.';
    } else {
      sentence = isNepali
        ? 'बजार आज मिश्रित अवस्थामा बन्द भयो।'
        : 'The market ended mixed today with no clear directional conviction.';
    }
  }

  textEl.textContent = sentence || (isNepali
    ? 'बजार आज मिश्रित छ, स्पष्ट दिशा छैन।'
    : 'Markets are mixed today with no clear direction yet.');
  badgeEl.textContent = getTranslationValue(sentiment, sentiment);
  badgeEl.classList.remove('bullish', 'bearish', 'mixed');
  badgeEl.classList.add(sentiment);
}

function computeHotScore(stock) {
  const volume = toNum(stock?.totalTradeQuantity ?? stock?.totalTradedQuantity ?? 0);
  const change = toNum(stock?.percentageChange ?? stock?.changePercent ?? stock?.percentage_change ?? stock?.change ?? 0);
  const safeVolume = Number.isFinite(volume) ? volume : 0;
  const safeChange = Number.isFinite(change) ? Math.abs(change) : 0;
  const score = Math.log10(safeVolume + 1) * (safeChange + 0.2);
  return Number.isFinite(score) ? score : 0;
}

function getHotToday(stocks, count = 6) {
  if (!Array.isArray(stocks)) {
    return [];
  }
  const mapped = stocks.map((stock, index) => ({
    stock,
    index,
    score: computeHotScore(stock)
  }));
  mapped.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });
  return mapped.slice(0, count).map(item => item.stock);
}

function formatCompactNumber(value) {
  const numeric = toNum(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  const abs = Math.abs(numeric);
  let divisor = 1;
  let suffix = '';
  if (abs >= 1_000_000_000) {
    divisor = 1_000_000_000;
    suffix = 'B';
  } else if (abs >= 1_000_000) {
    divisor = 1_000_000;
    suffix = 'M';
  } else if (abs >= 1_000) {
    divisor = 1_000;
    suffix = 'K';
  }

  const currentLanguage = getCurrentLanguage();
  if (!suffix) {
    return formatNumber(numeric, { decimals: 0, useCommas: true }, currentLanguage);
  }
  const scaled = numeric / divisor;
  const formatted = formatNumber(scaled, { decimals: 1, useCommas: true }, currentLanguage);
  return `${formatted.replace(/\\.0$/, '')}${suffix}`;
}

function renderHotToday(stocks) {
  const container = document.getElementById('hot-today');
  const grid = document.getElementById('hotTodayContent');
  if (!container || !grid) {
    return;
  }

  const viewLink = document.getElementById('hotTodayViewMarket');
  if (viewLink) {
    const marketSection = document.getElementById('market');
    if (!marketSection) {
      viewLink.style.display = 'none';
    } else {
      viewLink.style.display = 'inline-flex';
      if (!viewLink.dataset.bound) {
        viewLink.dataset.bound = 'true';
        viewLink.addEventListener('click', (event) => {
          if (typeof showSection === 'function') {
            event.preventDefault();
            showSection('market');
            if (typeof updateActiveSection === 'function') {
              updateActiveSection('market');
            }
          }
        });
      }
    }
  }

  const items = getHotToday(stocks, 6);
  grid.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'home-muted';
    empty.textContent = 'No market data available.';
    grid.appendChild(empty);
    return;
  }

  items.forEach(stock => {
    const symbol = stock?.symbol || stock?.companySymbol || '—';
    const name = stock?.securityName || stock?.companyName || stock?.name || symbol;
    const ltpRaw = stock?.lastTradedPrice ?? stock?.ltp ?? stock?.price;
    const ltp = ltpRaw === null || ltpRaw === undefined || ltpRaw === '' ? NaN : toNum(ltpRaw);
    const pct = toNum(stock?.percentageChange ?? stock?.changePercent ?? stock?.percentage_change ?? stock?.change ?? 0);
    const volume = stock?.totalTradeQuantity ?? stock?.totalTradedQuantity ?? 0;

    const pctClass = Number.isFinite(pct)
      ? (Math.abs(pct) < 0.05 ? 'neutral' : pct > 0 ? 'gain' : pct < 0 ? 'loss' : 'neutral')
      : 'neutral';
    const pctDisplay = Number.isFinite(pct)
      ? formatPercent(pct, getCurrentLanguage(), { decimals: 2, showSign: true })
      : '—';

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'hot-today-item';
    card.title = 'Ranked by volume + movement today';
    card.innerHTML = `
      <div class="hot-today-top">
        <span class="hot-today-symbol">${symbol}</span>
        <span class="hot-today-chip">HOT</span>
      </div>
      <div class="hot-today-name">${name}</div>
      <div class="hot-today-stats">
        <div class="hot-today-stat">
          <span class="hot-today-stat-label">LTP</span>
          <span class="np-number">${Number.isFinite(ltp) ? formatPrice(ltp, getCurrentLanguage()) : '—'}</span>
        </div>
        <div class="hot-today-stat hot-today-change ${pctClass}">
          <span class="np-number">${pctDisplay}</span>
        </div>
        <div class="hot-today-stat">
          <span class="hot-today-stat-label">Vol</span>
          <span class="np-number">${formatCompactNumber(volume)}</span>
        </div>
      </div>
    `;

    if (symbol && typeof openTradeModal === 'function') {
      card.addEventListener('click', () => openTradeModal(symbol));
    } else if (symbol) {
      card.addEventListener('click', () => {
        if (typeof showSection === 'function') {
          showSection('market');
          if (typeof updateActiveSection === 'function') {
            updateActiveSection('market');
          }
        } else {
          window.location.hash = '#market';
        }
      });
    }

    grid.appendChild(card);
  });
}

function getTopSectorLabel(sectorMetrics) {
  if (!Array.isArray(sectorMetrics) || sectorMetrics.length === 0) {
    return '';
  }
  const bestSector = sectorMetrics.reduce((best, current) => {
    if (!best) {
      return current;
    }
    return current.value > best.value ? current : best;
  }, null);
  if (!bestSector) {
    return '';
  }
  return getLocalizedSectorName(bestSector.sector, getCurrentLanguage());
}

function renderSectorFilters(sectorCounts) {
  const container = document.getElementById('sectorFilters');
  if (!container) return;

  const countsMap = sectorCounts instanceof Map ? sectorCounts : new Map(sectorCounts);

  if (currentSectorFilter !== 'All' && !countsMap.has(currentSectorFilter)) {
    currentSectorFilter = 'All';
  }

  const totalCount = Array.from(countsMap.values()).reduce((sum, value) => sum + value, 0);
  container.innerHTML = '';

  const currentLanguage = getCurrentLanguage();

  const createChip = (label, count, value) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sector-chip';
    chip.dataset.sector = value;
    chip.innerHTML = `
      <span class="chip-label">${label}</span>
      <span class="chip-count np-number">${formatNumber(count, { decimals: 0, useCommas: true }, currentLanguage)}</span>
    `;

    if (value === currentSectorFilter) {
      chip.classList.add('active');
    }

    chip.addEventListener('click', () => {
      currentSectorFilter = value;
      document.querySelectorAll('.sector-chip').forEach(item => item.classList.remove('active'));
      chip.classList.add('active');
      applySectorFilter();
    });

    container.appendChild(chip);
  };

  createChip(getTranslationValue('allSectors', 'All Sectors'), totalCount, 'All');

  Array.from(countsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([sector, count]) => {
      const label = getLocalizedSectorName(sector, currentLanguage);
      createChip(label, count, sector);
    });

  updateSelectedSectorLabel();
}

function updateSelectedSectorLabel() {
  const label = document.getElementById('selectedSectorLabel');
  if (!label) return;

  const currentLanguage = getCurrentLanguage();
  if (currentSectorFilter === 'All') {
    label.textContent = getTranslationValue('allSectors', 'All Sectors');
  } else {
    label.textContent = getLocalizedSectorName(currentSectorFilter, currentLanguage);
  }
}

function applySectorFilter() {
  renderAllStocksTable();
}

// Update search functionality
const stockSearchInput = document.getElementById("stockSearch");
if (stockSearchInput) {
  stockSearchInput.addEventListener("input", (e) => {
    const resultsDiv = document.getElementById("searchResults");
    if (!resultsDiv) {
      return;
    }
    const searchTerm = e.target.value.toLowerCase();

    currentSearchTerm = searchTerm;
    renderAllStocksTable();

    if (searchTerm.length < 2) {
      resultsDiv.style.display = "none";
      return;
    }

    if (!allStocksData.length) {
      resultsDiv.style.display = "none";
      return;
    }

    const currentLanguage = getCurrentLanguage();
    const matches = allStocksData.filter(stock => {
      return stock.symbol.toLowerCase().includes(searchTerm) ||
        (stock.companyName && stock.companyName.toLowerCase().includes(searchTerm));
    });

    if (matches.length > 0) {
      resultsDiv.innerHTML = matches.slice(0, 5).map(stock => {
        const priceDisplay = Number.isFinite(stock.priceNumber)
          ? formatPrice(stock.priceNumber, currentLanguage)
          : formatPrice(stock.priceRaw, currentLanguage);

        let changeClass = 'gain';
        let percentageDisplay = '—';
        if (Number.isFinite(stock.percentChange)) {
          changeClass = stock.percentChange >= 0 ? 'gain' : 'loss';
          percentageDisplay = formatPercent(stock.percentChange, currentLanguage, { decimals: 2, showSign: true });
        } else if (stock.changeRaw) {
          const rawChange = String(stock.changeRaw).trim();
          changeClass = rawChange.startsWith('-') ? 'loss' : 'gain';
          percentageDisplay = formatPercent(rawChange, currentLanguage, { decimals: 2, showSign: true });
        }

        const displaySector = getLocalizedSectorName(stock.sectorName || 'N/A', currentLanguage);
        return `
          <div class="search-result" onclick="handleSearchResultClick('${stock.symbol}')">
            <div class="stock-info">
              <strong>${stock.symbol}</strong>
              <span>${companyNameForLang(stock.companyName, currentLanguage)}</span>
              <small>${displaySector}</small>
            </div>
            <div class="stock-price ${changeClass}">
              ${wrapNumberDisplay(priceDisplay)}
              (${wrapNumberDisplay(percentageDisplay)})
            </div>
          </div>
        `;
      }).join('');
      resultsDiv.style.display = "block";
    } else {
      resultsDiv.innerHTML = '<div class="no-results">No matches found</div>';
      resultsDiv.style.display = "block";
    }
  });
}

// Add event listener for trade amount input
document.addEventListener('DOMContentLoaded', () => {
  const modalTradeShares = document.getElementById("modalTradeShares");
  const tradeModal = document.getElementById("tradeModal");
  
  if (modalTradeShares) {
    modalTradeShares.addEventListener("input", updateCostPreview);
  }
  
  if (tradeModal) {
    tradeModal.addEventListener("click", (e) => {
      if (e.target.classList.contains("trade-modal")) {
        closeTradeModal();
      }
    });
  }
  
  initializeHomeDashboard();
});

function initNavigation() {
  if (navigationInitialized) {
    return;
  }
  navigationInitialized = true;
  // Set home as active by default
  updateActiveSection('home');

  // Add click handlers to navigation links
  document.querySelectorAll('.nav-icon').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('href').substring(1); // Remove # from href
      showSection(section);
      updateActiveSection(section);
    });
  });
}

function updateActiveSection(sectionId) {
  // Remove active class from all nav items
  document.querySelectorAll('.nav-icon').forEach(link => {
    link.classList.remove('active');
  });
  
  // Add active class to current section's nav item
  const activeNav = document.querySelector(`.nav-icon[href="#${sectionId}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
  }
}

function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('main > section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show selected section
  const selectedSection = document.getElementById(sectionId);
  if (selectedSection) {
    selectedSection.style.display = 'block';
  }
}

function getStoredTransactions() {
  const stored = localStorage.getItem("transactions");
  if (!stored) {
    const emptyList = [];
    localStorage.setItem("transactions", JSON.stringify(emptyList));
    return emptyList;
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("⚠️ Error parsing transactions:", error);
    const emptyList = [];
    localStorage.setItem("transactions", JSON.stringify(emptyList));
    return emptyList;
  }
}

function recordTransaction(transaction) {
  const transactions = getStoredTransactions();
  transactions.push(transaction);
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function computeHoldings(investments, transactions) {
  const bySymbol = new Map();

  investments.forEach((investment) => {
    if (!investment || !investment.symbol) {
      return;
    }
    const quantity = parseFloat(investment.quantity) || 0;
    const amount = parseFloat(investment.amount) || 0;
    if (quantity <= 0) {
      return;
    }
    if (!bySymbol.has(investment.symbol)) {
      bySymbol.set(investment.symbol, { totalBoughtQty: 0, totalBoughtValue: 0, totalSoldQty: 0 });
    }
    const entry = bySymbol.get(investment.symbol);
    entry.totalBoughtQty += quantity;
    entry.totalBoughtValue += amount;
  });

  transactions.forEach((transaction) => {
    if (!transaction || transaction.type !== "SELL") {
      return;
    }
    const symbol = transaction.symbol;
    if (!symbol) {
      return;
    }
    const quantity = parseFloat(transaction.quantity) || 0;
    if (quantity <= 0) {
      return;
    }
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, { totalBoughtQty: 0, totalBoughtValue: 0, totalSoldQty: 0 });
    }
    const entry = bySymbol.get(symbol);
    entry.totalSoldQty += quantity;
  });

  const holdings = [];
  bySymbol.forEach((data, symbol) => {
    const netQuantity = Math.max(0, data.totalBoughtQty - data.totalSoldQty);
    if (netQuantity <= 0) {
      return;
    }
    const avgBuyPrice = data.totalBoughtQty > 0 ? data.totalBoughtValue / data.totalBoughtQty : 0;
    const investedValue = avgBuyPrice * netQuantity;
    holdings.push({
      symbol,
      netQuantity,
      avgBuyPrice,
      investedValue,
      totalBoughtQty: data.totalBoughtQty
    });
  });

  return holdings;
}

function formatPortfolioQuantity(quantity, language) {
  const decimals = Number.isInteger(quantity) ? 0 : 4;
  return formatNumber(quantity, { decimals, useCommas: true }, language);
}

function getPortfolioHistory() {
  const stored = localStorage.getItem("portfolioHistory");
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("⚠️ Error parsing portfolio history:", error);
    return [];
  }
}

function recordPortfolioSnapshot(totalValue, totalInvested) {
  const today = new Date().toISOString().slice(0, 10);
  const history = getPortfolioHistory();
  const latest = history[history.length - 1];

  if (latest && latest.date === today) {
    latest.totalValue = totalValue;
    latest.totalInvested = totalInvested;
  } else {
    history.push({
      date: today,
      totalValue,
      totalInvested
    });
  }

  const trimmedHistory = history.slice(-90);
  localStorage.setItem("portfolioHistory", JSON.stringify(trimmedHistory));
  return trimmedHistory;
}

function renderPortfolioGraph(history) {
  const container = document.getElementById("portfolioGraph");
  if (!container) {
    return;
  }
  container.innerHTML = "";

  if (!Array.isArray(history) || history.length < 2) {
    if (!history || history.length === 0) {
      const empty = document.createElement("div");
      empty.className = "portfolio-graph-empty";
      empty.textContent = getTranslationValue(
        'portfolioPerformanceEmpty',
        'Performance graph will appear after you use the simulator for at least a day.'
      );
      container.appendChild(empty);
      return;
    }
  }

  const currentLanguage = getCurrentLanguage();
  const width = 600;
  const height = 200;
  const padding = 24;

  const values = history.map((entry) => Number(entry.totalValue) || 0);
  const invested = history.map((entry) => Number(entry.totalInvested) || 0);
  const minValue = Math.min(...values, ...invested);
  const maxValue = Math.max(...values, ...invested);
  const range = maxValue - minValue || 1;

  const scaleX = (index) => {
    if (history.length === 1) {
      return width / 2;
    }
    return padding + (index / (history.length - 1)) * (width - padding * 2);
  };
  const scaleY = (value) => height - padding - ((value - minValue) / range) * (height - padding * 2);

  const buildPath = (series) =>
    series
      .map((value, index) => `${index === 0 ? 'M' : 'L'}${scaleX(index)} ${scaleY(value)}`)
      .join(' ');

  const valuePath = buildPath(values);
  const investedPath = buildPath(invested);

  const latestValue = values[values.length - 1];
  const latestLabel = formatNumber(latestValue, { decimals: 2, useCommas: true }, currentLanguage);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "portfolio-graph-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const investedLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  investedLine.setAttribute("d", investedPath);
  investedLine.setAttribute("fill", "none");
  investedLine.setAttribute("stroke", "rgba(156, 163, 175, 0.85)");
  investedLine.setAttribute("stroke-width", "2");

  const valueLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  valueLine.setAttribute("d", valuePath);
  valueLine.setAttribute("fill", "none");
  valueLine.setAttribute("stroke", "rgba(0, 180, 216, 0.9)");
  valueLine.setAttribute("stroke-width", "3");

  const latestText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  latestText.setAttribute("x", width - padding);
  latestText.setAttribute("y", Math.max(padding, scaleY(latestValue) - 6));
  latestText.setAttribute("text-anchor", "end");
  latestText.setAttribute("class", "portfolio-graph-label");
  latestText.textContent = latestLabel;

  svg.appendChild(investedLine);
  svg.appendChild(valueLine);
  svg.appendChild(latestText);
  container.appendChild(svg);

  if (history.length === 1) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", scaleX(0));
    dot.setAttribute("cy", scaleY(values[0]));
    dot.setAttribute("r", "4");
    dot.setAttribute("fill", "rgba(0, 180, 216, 0.9)");
    svg.appendChild(dot);

    const dateLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dateLabel.setAttribute("x", scaleX(0));
    dateLabel.setAttribute("y", height - 6);
    dateLabel.setAttribute("text-anchor", "middle");
    dateLabel.setAttribute("class", "portfolio-graph-label");
    dateLabel.textContent = history[0].date;
    svg.appendChild(dateLabel);

    const helper = document.createElement("div");
    helper.className = "portfolio-graph-helper";
    helper.textContent = getTranslationValue(
      'portfolioPerformanceHelper',
      'Tracking portfolio value from today. History will build over time.'
    );
    container.appendChild(helper);
  }
}

function updatePortfolioSortControls() {
  document.querySelectorAll('.portfolio-sort-btn').forEach((button) => {
    const sortKey = button.getAttribute('data-sort');
    button.classList.toggle('is-active', sortKey === currentPortfolioSort);
  });
}

function initPortfolioSortControls() {
  if (typeof window !== 'undefined' && window.__portfolioSortInitDone) {
    return;
  }
  if (typeof window !== 'undefined') {
    window.__portfolioSortInitDone = true;
  }
  const buttons = document.querySelectorAll('.portfolio-sort-btn');
  if (!buttons.length) {
    return;
  }
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const sortKey = button.getAttribute('data-sort');
      if (sortKey) {
        currentPortfolioSort = sortKey;
        updatePortfolioSortControls();
        updatePortfolio();
      }
    });
  });
  updatePortfolioSortControls();
}

async function updatePortfolio() {
  const renderToken = ++portfolioRenderToken;
  const investments = JSON.parse(localStorage.getItem("investments")) || [];
  const transactions = getStoredTransactions();
  const holdings = computeHoldings(investments, transactions);
  const tableBody = document.getElementById("investmentHistory")?.getElementsByTagName('tbody')[0];
  const tableContainer = document.querySelector(".table-container");
  const summaryContainer = document.querySelector(".portfolio-summary");
  const controlsContainer = document.querySelector(".portfolio-controls");
  const actionsContainer = document.querySelector(".portfolio-actions");
  const noteElement = document.querySelector(".portfolio-note");
  const emptyState = document.querySelector(".portfolio-empty-state");
  const transactionsContainer = document.getElementById("portfolioTransactions");
  const transactionsWrapper = document.querySelector(".portfolio-transactions");
  
  if (!tableBody) return;
  
  tableBody.innerHTML = "";

  if (holdings.length === 0) {
    if (tableContainer) {
      tableContainer.style.display = "none";
    }
    if (summaryContainer) {
      summaryContainer.style.display = "none";
    }
    if (controlsContainer) {
      controlsContainer.style.display = "none";
    }
    if (actionsContainer) {
      actionsContainer.style.display = "none";
    }
    if (noteElement) {
      noteElement.style.display = "none";
    }
    if (transactionsContainer) {
      transactionsContainer.innerHTML = "";
    }
    if (transactionsWrapper) {
      transactionsWrapper.style.display = "none";
    }
    if (emptyState) {
      emptyState.style.display = "block";
    }
    return;
  }

  if (tableContainer) {
    tableContainer.style.display = "block";
  }
  if (summaryContainer) {
    summaryContainer.style.display = "grid";
  }
  if (controlsContainer) {
    controlsContainer.style.display = "flex";
  }
  if (actionsContainer) {
    actionsContainer.style.display = "flex";
  }
  if (noteElement) {
    noteElement.style.display = "block";
  }
  if (transactionsWrapper) {
    transactionsWrapper.style.display = "block";
  }
  if (emptyState) {
    emptyState.style.display = "none";
  }

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const currentLanguage = getCurrentLanguage();
  const holdingsWithPrices = [];

  for (let i = 0; i < holdings.length; i += 1) {
    const holding = holdings[i];
    try {
      const response = await fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${holding.symbol}`);
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.error) {
        console.error("Error fetching price for", holding.symbol, ":", data.error);
        continue;
      }
      if (renderToken !== portfolioRenderToken) {
        return;
      }

      const currentPrice = parseFloat(data.price);
      const quantity = holding.netQuantity;
      const currentValue = quantity * currentPrice;
      const investedValue = holding.investedValue;
      const profitLossAmount = currentValue - investedValue;
      const profitLossPercent = investedValue > 0 ? (profitLossAmount / investedValue) * 100 : 0;

      totalInvested += investedValue;
      totalCurrentValue += currentValue;

      holdingsWithPrices.push({
        symbol: holding.symbol,
        avgBuyPrice: holding.avgBuyPrice,
        currentPrice,
        quantity,
        investedValue,
        currentValue,
        profitLossAmount,
        profitLossPercent
      });
    } catch (error) {
      console.error("Error processing investment:", error);
    }
  }

  if (renderToken !== portfolioRenderToken) {
    return;
  }

  holdingsWithPrices.sort((a, b) => {
    switch (currentPortfolioSort) {
      case 'value':
        return b.currentValue - a.currentValue;
      case 'qty':
        return b.quantity - a.quantity;
      case 'symbol':
        return a.symbol.localeCompare(b.symbol);
      case 'pl':
      default:
        return b.profitLossAmount - a.profitLossAmount;
    }
  });

  holdingsWithPrices.forEach((holding) => {
    if (renderToken !== portfolioRenderToken) {
      return;
    }
    const row = document.createElement("tr");
    const profitLossClass = holding.profitLossAmount > 0 ? 'gain' : holding.profitLossAmount < 0 ? 'loss' : 'portfolio-neutral';
    const profitLossSymbol = holding.profitLossAmount > 0 ? '📈' : holding.profitLossAmount < 0 ? '📉' : '➖';
    const avgBuyDisplay = formatNumber(holding.avgBuyPrice, { decimals: 2, useCommas: true }, currentLanguage);
    const currentPriceDisplay = formatNumber(holding.currentPrice, { decimals: 2, useCommas: true }, currentLanguage);
    const valueDisplay = formatNumber(holding.currentValue, { decimals: 2, useCommas: true }, currentLanguage);
    const quantityDisplay = formatPortfolioQuantity(holding.quantity, currentLanguage);
    const profitLossAmountDisplay = formatNumber(
      holding.profitLossAmount,
      { decimals: 2, useCommas: true, prefix: holding.profitLossAmount >= 0 ? '+' : '' },
      currentLanguage
    );
    const profitLossPercentDisplay = formatPercent(holding.profitLossPercent, currentLanguage, { decimals: 2, showSign: true });
    const sellLabel = getTranslationValue('sell', 'Sell');

    row.innerHTML = `
      <td><strong>${holding.symbol}</strong></td>
      <td class="portfolio-align-right">${wrapNumberDisplay(avgBuyDisplay)} 💰</td>
      <td class="portfolio-align-right">${wrapNumberDisplay(currentPriceDisplay)} 📊</td>
      <td class="portfolio-align-right">${wrapNumberDisplay(quantityDisplay)}</td>
      <td class="portfolio-align-right">${wrapNumberDisplay(valueDisplay)} 💸</td>
      <td class="portfolio-align-right ${profitLossClass}">
        <div class="portfolio-pl">
          <span>${wrapNumberDisplay(profitLossAmountDisplay)} ${profitLossSymbol}</span>
          <span>(${wrapNumberDisplay(profitLossPercentDisplay)})</span>
        </div>
      </td>
      <td><button onclick="sellInvestment('${holding.symbol}', this)" class="sell-btn">${sellLabel}</button></td>
    `;
    tableBody.appendChild(row);
  });

  if (renderToken !== portfolioRenderToken) {
    return;
  }

  updatePortfolioSortControls();

  const totalValueElement = document.getElementById("portfolioTotalValue");
  const totalInvestedElement = document.getElementById("portfolioTotalInvested");
  const overallPlElement = document.getElementById("portfolioOverallPl");
  const positionsElement = document.getElementById("portfolioPositionsCount");

  if (totalValueElement) {
    setNumberText(totalValueElement, formatNumber(totalCurrentValue, { decimals: 2, useCommas: true }, currentLanguage));
  }
  if (totalInvestedElement) {
    setNumberText(totalInvestedElement, formatNumber(totalInvested, { decimals: 2, useCommas: true }, currentLanguage));
  }
  if (overallPlElement) {
    const overallPl = totalCurrentValue - totalInvested;
    const overallPlPercent = totalInvested > 0 ? (overallPl / totalInvested) * 100 : 0;
    const overallPlDisplay = formatNumber(
      overallPl,
      { decimals: 2, useCommas: true, prefix: overallPl >= 0 ? '+' : '' },
      currentLanguage
    );
    const overallPlPercentDisplay = formatPercent(overallPlPercent, currentLanguage, { decimals: 2, showSign: true });
    setNumberText(overallPlElement, `${overallPlDisplay} (${overallPlPercentDisplay})`);
    overallPlElement.classList.remove('gain', 'loss', 'neutral');
    overallPlElement.classList.add(overallPl > 0 ? 'gain' : overallPl < 0 ? 'loss' : 'neutral');
  }
  if (positionsElement) {
    const positionsCount = holdingsWithPrices.length;
    const positionsDisplay = formatNumber(positionsCount, { decimals: 0, useCommas: true }, currentLanguage);
    setNumberText(positionsElement, positionsDisplay);
    positionsElement.classList.remove('gain', 'loss', 'neutral');
    positionsElement.classList.add('neutral');
  }

  const history = recordPortfolioSnapshot(totalCurrentValue, totalInvested);
  renderPortfolioGraph(history);

  // Update summary stats in the home section
  const netWorth = document.getElementById("netWorth");
  const totalInvestedHomeElement = document.getElementById("totalInvested");
  const totalProfit = document.getElementById("totalProfit");

  if (netWorth) {
    const netWorthValue = (parseFloat(localStorage.getItem("credits")) || 0) + totalCurrentValue;
    setNumberText(netWorth, formatNumber(netWorthValue, { decimals: 2, useCommas: true }, currentLanguage));
  }
  if (totalInvestedHomeElement) {
    setNumberText(totalInvestedHomeElement, formatNumber(totalInvested, { decimals: 2, useCommas: true }, currentLanguage));
  }
  if (totalProfit) {
    const profitValue = totalCurrentValue - totalInvested;
    setNumberText(totalProfit, formatNumber(profitValue, { decimals: 2, useCommas: true, prefix: profitValue >= 0 ? '+' : '' }, currentLanguage));
    totalProfit.className = profitValue >= 0 ? 'stat-value gain' : 'stat-value loss';
  }

  if (transactionsContainer) {
    const recentTransactions = [...transactions].slice(-5).reverse();
    transactionsContainer.innerHTML = "";
    if (recentTransactions.length === 0) {
      const emptyItem = document.createElement("div");
      emptyItem.className = "portfolio-transaction-item";
      emptyItem.innerHTML = `<span class="portfolio-transaction-secondary">${getTranslationValue('portfolioNoTransactions', 'No recent transactions yet.')}</span>`;
      transactionsContainer.appendChild(emptyItem);
    } else {
      recentTransactions.forEach((transaction) => {
        const item = document.createElement("div");
        item.className = "portfolio-transaction-item";
        const badgeClass = transaction.type === 'SELL' ? 'sell' : 'buy';
        const quantity = parseFloat(transaction.quantity) || 0;
        const price = parseFloat(transaction.price) || 0;
        const total = parseFloat(transaction.total) || 0;
        const creditsBefore = parseFloat(transaction.creditsBefore);
        const creditsAfter = parseFloat(transaction.creditsAfter);
        const quantityDisplay = formatPortfolioQuantity(quantity, currentLanguage);
        const priceDisplay = formatNumber(price, { decimals: 2, useCommas: true }, currentLanguage);
        const totalDisplay = formatNumber(total, { decimals: 2, useCommas: true }, currentLanguage);
        const timeDisplay = transaction.timestampISO
          ? new Date(transaction.timestampISO).toLocaleString()
          : '';
        const creditsDisplay = Number.isFinite(creditsBefore) && Number.isFinite(creditsAfter)
          ? `${wrapNumberDisplay(formatNumber(creditsBefore, { decimals: 2, useCommas: true }, currentLanguage))} → ${wrapNumberDisplay(formatNumber(creditsAfter, { decimals: 2, useCommas: true }, currentLanguage))}`
          : '';

        item.innerHTML = `
          <div class="portfolio-transaction-left">
            <span class="portfolio-transaction-badge ${badgeClass}">${transaction.type}</span>
            <div>
              <div class="portfolio-transaction-primary">
                ${transaction.symbol} · ${wrapNumberDisplay(quantityDisplay)} @ ${wrapNumberDisplay(priceDisplay)}
              </div>
              <div class="portfolio-transaction-secondary">
                Total: ${wrapNumberDisplay(totalDisplay)} ${creditsDisplay ? `· ${creditsDisplay}` : ''}
              </div>
            </div>
          </div>
          <div class="portfolio-transaction-time">${timeDisplay}</div>
        `;
        transactionsContainer.appendChild(item);
      });
    }
  }
}

function sellInvestment(symbol, buttonElement) {
  const investments = JSON.parse(localStorage.getItem("investments") || "[]");
  const transactions = getStoredTransactions();
  const holdings = computeHoldings(investments, transactions);
  const holding = holdings.find((item) => item.symbol === symbol);

  if (!holding || !holding.netQuantity) {
    console.error("❌ Invalid holding data:", holding);
    showToast("❌ Investment or quantity missing. Please check your portfolio.");
    return;
  }

  const saleKey = `${symbol}-${holding.netQuantity}`;
  if (activeSellRequests.has(saleKey)) {
    return;
  }
  activeSellRequests.add(saleKey);

  if (buttonElement) {
    buttonElement.disabled = true;
  }

  // Fetch current stock price
  fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${symbol}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        throw new Error("PRICE_FETCH_ERROR");
      }

      const currentPrice = parseFloat(data.price);
      const quantity = holding.netQuantity;
      const sellAmount = quantity * currentPrice;

      // Add sell amount to credits
      const creditsBefore = parseFloat(localStorage.getItem("credits")) || 0;
      let credits = creditsBefore;
      credits += sellAmount;
      localStorage.setItem("credits", credits.toString());
      updateCreditDisplay();

      recordTransaction({
        type: "SELL",
        symbol,
        quantity: quantity.toString(),
        price: currentPrice.toString(),
        total: sellAmount.toString(),
        timestampISO: new Date().toISOString(),
        creditsBefore: creditsBefore.toString(),
        creditsAfter: credits.toString()
      });

      updatePortfolio();
      const currentLanguage = getCurrentLanguage();
      const sellAmountDisplay = formatNumber(sellAmount, { decimals: 2, useCommas: true }, currentLanguage);
      showToast(`✅ Sold ${symbol} for ${wrapNumberDisplay(sellAmountDisplay)} credits!`);
    })
    .catch((error) => {
      if (error && error.message === "PRICE_FETCH_ERROR") {
        showToast("❌ Error fetching current price. Please try again.");
      } else {
        console.error("❌ Error completing sale:", error);
        showToast("❌ Could not fetch the stock price. Please try again.");
      }
    })
    .finally(() => {
      activeSellRequests.delete(saleKey);
      if (buttonElement) {
        buttonElement.disabled = false;
      }
    });
}

// For testing purposes, let's add some sample users
function addSampleUsers() {
  // Clear existing users
  localStorage.setItem('allUsers', JSON.stringify([
    'John Doe',
    'Jane Smith',
    'Bob Wilson',
    'Alice Brown',
    'Charlie Davis',
    'Eva Martinez',
    'Frank Johnson',
    'Grace Lee',
    'Henry Taylor',
    'Iris Wang'
  ]));

  // Set some sample investments and credits for each user
  const users = JSON.parse(localStorage.getItem('allUsers'));
  users.forEach((user, index) => {
    // Give each user different credits and investments for testing
    localStorage.setItem(`credits_${user}`, (5000 + (index * 1000)).toString());
    
    // Sample investments
    const sampleInvestments = [
      {
        symbol: 'NABIL',
        quantity: '10',
        price: '1000',
        amount: '10000'
      },
      {
        symbol: 'NTC',
        quantity: '5',
        price: '800',
        amount: '4000'
      }
    ];
    
    localStorage.setItem(`investments_${user}`, JSON.stringify(sampleInvestments));
  });
}

// Settings functionality
const translations = {
    english: {
        welcome: 'Welcome, {name}!',
        netWorth: 'Net Worth',
        netWorthDesc: 'The total value of all your stocks and leftover credits combined.',
        totalProfit: 'Total Profit',
        totalProfitDesc: 'How much money you\'ve gained or lost by trading stocks.',
        invested: 'Invested',
        investedDesc: 'The total amount of credits you\'ve spent buying stocks.',
        marketOverviewIntraday: 'Market Overview (Intraday)',
        intradayResetsOnRefresh: 'Intraday session chart resets when you refresh.',
        marketStatus: 'Market',
        open: 'OPEN',
        closed: 'CLOSED',
        lastUpdated: 'Last updated',
        advancers: 'Advancers',
        decliners: 'Decliners',
        unchanged: 'Unchanged',
        total: 'Total',
        todayInMarket: 'Today in the Market',
        bullish: 'Bullish',
        bearish: 'Bearish',
        mixed: 'Mixed',
        hotTodayTitle: 'Hot Today',
        hotTodaySubtitle: 'Active and moving stocks',
        hotTodayView: 'View Market',
        sectorPerformance: 'Sector Performance',
        updated: 'Updated',
        market: 'Market',
        portfolio: 'Portfolio',
        settings: 'Settings',
        about: 'About',
        teamNav: 'Our Team',
        playgroundNav: 'Playground',
        credits: 'Credits',
        add: 'Add',
        home: 'Home',
        searchStocks: 'Search stocks...',
        gainers: 'Top Gainers',
        losers: 'Top Losers',
        allStocks: 'All Stocks',
        symbol: 'Symbol',
        companyName: 'Company Name',
        sector: 'Sector',
        price: 'Price',
        ltp: 'LTP',
        change: 'Change',
        relativeStrength: 'RS',
        action: 'Action',
        trade: 'Trade',
        buyPrice: 'Buy Price',
        currentPrice: 'Current Price',
        creditsInvested: 'Credits Invested',
        creditsNow: 'Credits Now',
        quantity: 'Quantity',
        plAmount: 'P/L Amount',
        plPercent: 'P/L %',
        sell: 'Sell',
        themeMode: 'Theme Mode',
        lightMode: 'Light Mode',
        darkMode: 'Dark Mode',
        textSize: 'Text Size',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        language: 'Language',
        english: 'English',
        nepali: 'Nepali',
        tradeStock: 'Trade Stock',
        back: 'Back',
        confirm: 'Confirm Trade',
        settingsSaved: 'Settings saved automatically',
        settingsInfo: 'Your preferences will be saved and applied across all sessions',
        motivation: 'Doing good so far investor!',
        noInvestments: 'No investments yet!',
        startInvesting: 'Start Investing Now',
        startInvestingDesc: 'Head over to the Market section to start your investment journey!',
        buyMore: 'Buy More Stocks',
        searchPlaceholder: '🔍 Search by company name or symbol...',
        portfolioTitle: 'My Investment Portfolio',
        portfolioDesc: 'Track your investments and their performance',
        portfolioBrokerFeeNote: '🔍 Note: Portfolio shows slight initial loss due to broker fees',
        portfolioTotalValue: 'Total Value',
        portfolioTotalInvested: 'Total Invested',
        portfolioOverallPl: 'Overall P/L',
        portfolioPositions: 'Positions',
        portfolioSortBy: 'Sort by',
        portfolioSortPl: 'P/L',
        portfolioSortValue: 'Value',
        portfolioSortQty: 'Qty',
        portfolioSortSymbol: 'Symbol',
        portfolioAvgBuy: 'Avg Buy',
        portfolioLtp: 'LTP',
        portfolioQty: 'Qty',
        portfolioValue: 'Value',
        portfolioPl: 'P/L',
        portfolioPerformanceTitle: 'Performance',
        portfolioPerformanceValue: 'Value',
        portfolioPerformanceInvested: 'Invested',
        portfolioPerformanceEmpty: 'Performance graph will appear after you use the simulator for at least a day.',
        portfolioPerformanceHelper: 'Tracking portfolio value from today. History will build over time.',
        portfolioRecentTransactions: 'Recent Transactions',
        portfolioNoTransactions: 'No recent transactions yet.',
        portfolioEmpty: 'No investments yet!',
        portfolioEmptyDesc: 'Start your investment journey by trading stocks in the market section.',
        portfolioStats: 'Portfolio Statistics',
        portfolioStatsDesc: 'Overview of your investment performance',
        portfolioHistory: 'Investment History',
        portfolioHistoryDesc: 'Detailed record of all your trades',
        portfolioActions: 'Portfolio Actions',
        portfolioActionsDesc: 'Manage your investments',
        portfolioPerformance: 'Portfolio Performance',
        portfolioPerformanceDesc: 'Track your gains and losses',
        portfolioDiversity: 'Portfolio Diversity',
        portfolioDiversityDesc: 'Spread of your investments across different sectors',
        portfolioRisk: 'Risk Assessment',
        portfolioRiskDesc: 'Evaluate your investment risk level',
        portfolioRecommendations: 'Investment Recommendations',
        portfolioRecommendationsDesc: 'Get personalized investment suggestions',
        portfolioAlerts: 'Portfolio Alerts',
        portfolioAlertsDesc: 'Stay updated on your investments',
        portfolioReports: 'Portfolio Reports',
        portfolioReportsDesc: 'Detailed analysis of your portfolio',
        portfolioGoals: 'Investment Goals',
        portfolioGoalsDesc: 'Set and track your investment objectives',
        portfolioAnalysis: 'Portfolio Analysis',
        portfolioAnalysisDesc: 'In-depth analysis of your investment strategy',
        browseBySector: 'Browse by Sector',
        allSectors: 'All Sectors',
        noSectorResults: 'No stocks found for this sector.',
        aboutKickerNot: 'What this is not',
        aboutTitle: 'A simulator built for learning, not hype.',
        aboutLead: 'Arthyq helps you understand how markets behave, how decisions feel, and why discipline matters. It is a safe place to practice before real money is on the line.',
        aboutCard1Title: 'Not a trading app',
        aboutCard1Text: 'You cannot place real orders here. This is practice, not execution.',
        aboutCard2Title: 'Not a get rich quick scheme',
        aboutCard2Text: 'If someone promises guaranteed returns, run. This platform teaches process, not shortcuts.',
        aboutCard3Title: 'Not financial advice',
        aboutCard3Text: 'We do not tell you what to buy or sell. You learn to think, research, and decide.',
        aboutCard4Title: 'Not gambling',
        aboutCard4Text: 'We focus on reasoning and risk management. Random bets are the fastest way to lose.',
        aboutCard5Title: 'No real money required',
        aboutCard5Text: 'You start with credits. Your wallet stays untouched. Your lessons do not have to be expensive.',
        aboutSmirk: 'Lose fake money here so you do not lose real money later.',
        aboutFounderKicker: 'About the Founder',
        aboutFounderName: 'Subigya Raj Kharel',
        aboutFounderNameNepali: 'सुबिज्ञ राज खरेल',
        aboutFounderRole: 'Founder of Arthyq',
        aboutFounderBio: 'I am a student developer focused on making finance education simple, practical, and accessible for Nepali learners. Arthyq is built to help beginners practice investing concepts with clarity, confidence, and zero real world risk.',
        aboutContactLabel: 'Contact',
        aboutLinksLabel: 'Links',
        aboutNssLabel: 'Arthyq',
        aboutLinkedIn: 'LinkedIn',
        aboutEmailButton: 'Email',
        aboutCallButton: 'Call',
        aboutInstagram: 'Instagram',
        aboutYouTube: 'YouTube',
        nssTitle: "Arthyq",
        nssDesc: "A virtual stock trading platform designed to help beginners learn about the Nepal Stock Exchange (NEPSE) in a risk-free environment. Practice trading with virtual credits and track your portfolio performance.",
        feature1: "Virtual Trading",
        feature1Desc: "Trade with virtual credits, no real money involved",
        feature2: "Real-time Data",
        feature2Desc: "Access live NEPSE stock prices and market data",
        feature3: "Learning Tools",
        feature3Desc: "Educational resources for stock market beginners",
        founderTitle: "About the Founder",
        founderName: "Subigya Raj Kharel",
        founderRole: "Student Developer",
        founderBio: "Subigya Raj Kharel is a student developer from Kathmandu, Nepal. Currently studying in grade 9, Subigya loves to code and make different kinds of websites and apps.",
        connectTitle: "Connect With Us",
        instagram: "Instagram",
        youtube: "YouTube",
        playgroundTitle: "Playground",
        playgroundDescription: "Practice faster with mini games built for NSE trading intuition.",
        quizTitle: "NEPSE Quick Quiz",
        quizDescription: "Test your NEPSE basics in quick bites.",
        quizBody: "Quiz experience goes here.",
        chartGameTitle: "Chart Trading Game",
        chartGameSubtitle: "Press and hold to buy, release to sell",
        chartGameDescription: "Master the press-and-hold trading rhythm with simulated NEPSE charts.",
        chartGameHowtoLine1: "Press and hold on the chart to buy at the current price.",
        chartGameHowtoLine2: "Keep holding while the price moves.",
        chartGameHowtoLine3: "Release to sell. Beat the Buy & Hold score.",
        chartGamePlayButton: "Play me!",
        chartGameModalTitle: "Chart Trading Game",
        chartGameProgressLabel: "Progress",
        chartGameCurrentReturnLabel: "Current Return",
        chartGameTotalReturnLabel: "Total Return",
        chartGameHint: "Press & hold to buy",
        chartGameResultsTitle: "Round Results",
        chartGameYourReturnLabel: "Your return",
        chartGameBuyHoldLabel: "Buy & Hold",
        chartGameRestart: "Restart round",
        chartGameNewRound: "New round",
        chartGameExit: "Exit to Playground",
        chartGameMessageGreat: "Outstanding timing! You beat the market rhythm.",
        chartGameMessageGood: "Nice trade control. You kept pace with the chart.",
        chartGameMessageTry: "Keep practicing. The next round is yours.",
        chartGameSectorBank: "Simulated Bank",
        chartGameSectorHydro: "Simulated Hydro",
        chartGameSectorFinance: "Simulated Finance",
        teamTitle: "Our Team",
        teamDescription: "Meet the passionate people guiding Arthyq and supporting our community of investors.",
        playgroundTitle: "Playground",
        playgroundSubtitle: "Explore interactive learning experiences crafted for NEPSE beginners.",
        managementLabel: "Management & Operations",
        researchLabel: "Research & Development",
        financeLabel: "Finances",
        marketingLabel: "Marketing & Communications",
        ceoRole: "Chief Executive Officer",
        ceoName: "Subigya Raj Kharel",
        cooRole: "Chief Operating Officer",
        cooName: "Agraj Rijal",
        mdRole: "Managing Director",
        mdName: "Nayan Shakya",
        dcooRole: "Deputy Chief Operating Officer",
        dcooName: "Abhinav Pyakurel",
        croRole: "Chief Research Officer",
        croName: "Aarohan Timsina",
        ctoRole: "Chief Technology Officer",
        ctoName: "Agrim Rijal",
        researchVpRole: "VP of Research",
        researchVpName: "Syon Lama",
        cfoRole: "Chief Financial Officer",
        cfoName: "Rachit Bhattarai",
        cmoRole: "Chief Marketing Officer",
        cmoName: "Rushka Sapkota",
        contentRole: "Chief Communication Officer",
        contentName: "Sanskar Sharma",
        communicationsVpRole: "VP of Communications",
        communicationsVpName: "Aarav Dahal"
    },
    nepali: {
        welcome: 'स्वागत छ, {name}!',
        netWorth: 'कुल सम्पत्ति',
        netWorthDesc: 'तपाईंको सबै स्टक र बाँकी क्रेडिटको कुल मूल्य।',
        totalProfit: 'कुल नाफा',
        totalProfitDesc: 'स्टक ट्रेडिङबाट कति नाफा वा नोक्सान भयो।',
        invested: 'लगानी गरिएको',
        investedDesc: 'स्टक किन्न खर्च गरिएको कुल क्रेडिट रकम।',
        marketOverviewIntraday: 'बजार अवलोकन (इन्ट्राडे)',
        intradayResetsOnRefresh: 'रिफ्रेश गर्दा इन्ट्राडे चार्ट रिसेट हुन्छ।',
        marketStatus: 'बजार',
        open: 'खुला',
        closed: 'बन्द',
        lastUpdated: 'अन्तिम अपडेट',
        advancers: 'बढ्ने',
        decliners: 'घट्ने',
        unchanged: 'अपरिवर्तित',
        total: 'जम्मा',
        todayInMarket: 'आजको बजार',
        bullish: 'बुलिश',
        bearish: 'बेयरिश',
        mixed: 'मिश्रित',
        hotTodayTitle: 'आज सक्रिय',
        hotTodaySubtitle: 'आजका सक्रिय र चलायमान स्टकहरू',
        hotTodayView: 'बजार हेर्नुहोस्',
        sectorPerformance: 'क्षेत्रगत प्रदर्शन',
        updated: 'अपडेट',
        market: 'बजार',
        portfolio: 'पोर्टफोलियो',
        settings: 'सेटिङ',
        about: 'बारेमा',
        teamNav: 'हाम्रो टीम',
        playgroundNav: 'प्लेग्राउन्ड',
        credits: 'क्रेडिट',
        add: 'थप्नुहोस्',
        home: 'गृह',
        searchStocks: 'शेयर खोज्नुहोस्...',
        gainers: 'आज बढेका',
        losers: 'आज घटेका',
        allStocks: 'सबै शेयर',
        symbol: 'प्रतीक',
        companyName: 'कम्पनी',
        sector: 'सेक्टर',
        price: 'मूल्य',
        ltp: 'अन्तिम मूल्य',
        change: 'परिवर्तन',
        relativeStrength: 'आरएस',
        action: 'कार्य',
        trade: 'बेचौं',
        buyPrice: 'किन्दाको मूल्य',
        currentPrice: 'हालको मूल्य',
        creditsInvested: 'लगानी गर्दाको क्रेडिट',
        creditsNow: 'हालको क्रेडिट',
        quantity: 'सङ्ख्या',
        plAmount: 'नाफा/नोक्सान',
        plPercent: 'नाफा/नोक्सान%',
        sell: 'बेचौं',
        themeMode: 'थीम',
        lightMode: 'लाइट मोड',
        darkMode: 'डार्क मोड',
        textSize: 'अक्षर',
        small: 'सानो',
        medium: 'मध्यम',
        large: 'ठूलो',
        language: 'भाषा',
        english: 'अंग्रेजी',
        nepali: 'नेपाली',
        tradeStock: 'शेयर व्यापार',
        back: 'पछाडि',
        confirm: 'व्यापार पुष्टि गर्नुहोस्',
        settingsSaved: 'सेटिङ  सेभ भयो',
        settingsInfo: 'तपाईंको प्राथमिकताहरू सेभ हुनेछ र सबै सत्रहरूमा लागू हुनेछ',
        motivation: 'राम्रो गर्दै हुनुहुन्छ लगानीकर्ता!',
        noInvestments: 'अहिलेसम्म कुनै लगानी छैन!',
        startInvesting: 'लगानी सुरु गर्नुहोस्',
        startInvestingDesc: 'बजार सेक्सनमा जानुहोस् र आफ्नो लगानी यात्रा सुरु गर्नुहोस्!',
        buyMore: 'थप स्टक किन्नुहोस्',
        searchPlaceholder: '🔍 कम्पनीको नाम वा प्रतीक खोज्नुहोस्...',
        portfolioTitle: 'मेरो लगानी पोर्टफोलियो',
        portfolioDesc: 'आफ्नो लगानी र तिनीहरूको प्रदर्शन ट्र्याक गर्नुहोस्',
        portfolioBrokerFeeNote: 'ब्रोकर शुल्कका कारण सुरुआतमा पोर्टफोलियोमा सानो घाटा देखिन सक्छ।',
        portfolioTotalValue: 'कुल मूल्य',
        portfolioTotalInvested: 'कुल लगानी',
        portfolioOverallPl: 'समग्र नाफा/नोक्सान',
        portfolioPositions: 'होल्डिङ्स',
        portfolioSortBy: 'क्रमबद्ध गर्नुहोस्',
        portfolioSortPl: 'नाफा/नोक्सान',
        portfolioSortValue: 'मूल्य',
        portfolioSortQty: 'परिमाण',
        portfolioSortSymbol: 'सिम्बल',
        portfolioAvgBuy: 'औसत खरिद',
        portfolioLtp: 'एलटीपी',
        portfolioQty: 'परिमाण',
        portfolioValue: 'मूल्य',
        portfolioPl: 'नाफा/नोक्सान',
        portfolioPerformanceTitle: 'प्रदर्शन',
        portfolioPerformanceValue: 'मूल्य',
        portfolioPerformanceInvested: 'लगानी',
        portfolioPerformanceEmpty: 'कम्तीमा एक दिन सिमुलेटर प्रयोग गरेपछि प्रदर्शन ग्राफ देखिनेछ।',
        portfolioPerformanceHelper: 'आजदेखि पोर्टफोलियो मूल्य ट्र्याक गर्दैछौं। समयसँगै इतिहास थपिनेछ।',
        portfolioRecentTransactions: 'हालका कारोबार',
        portfolioNoTransactions: 'हाल कुनै कारोबार छैन।',
        portfolioEmpty: 'अहिलेसम्म कुनै लगानी छैन!',
        portfolioEmptyDesc: 'बजार सेक्सनमा स्टक व्यापार गरेर आफ्नो लगानी यात्रा सुरु गर्नुहोस्।',
        portfolioStats: 'पोर्टफोलियो तथ्याङ्क',
        portfolioStatsDesc: 'तपाईंको लगानी प्रदर्शनको अवलोकन',
        portfolioHistory: 'लगानी इतिहास',
        portfolioHistoryDesc: 'तपाईंको सबै व्यापारहरूको विस्तृत रेकर्ड',
        portfolioActions: 'पोर्टफोलियो कार्यहरू',
        portfolioActionsDesc: 'आफ्नो लगानीहरू व्यवस्थापन गर्नुहोस्',
        portfolioPerformance: 'पोर्टफोलियो प्रदर्शन',
        portfolioPerformanceDesc: 'आफ्नो नाफा र नोक्सान ट्र्याक गर्नुहोस्',
        portfolioDiversity: 'पोर्टफोलियो विविधता',
        portfolioDiversityDesc: 'विभिन्न सेक्टरहरूमा तपाईंको लगानीको फैलावट',
        portfolioRisk: 'जोखिम मूल्यांकन',
        portfolioRiskDesc: 'आफ्नो लगानी जोखिम स्तर मूल्यांकन गर्नुहोस्',
        portfolioRecommendations: 'लगानी सिफारिसहरू',
        portfolioRecommendationsDesc: 'व्यक्तिगत लगानी सुझावहरू प्राप्त गर्नुहोस्',
        portfolioAlerts: 'पोर्टफोलियो अलर्टहरू',
        portfolioAlertsDesc: 'आफ्नो लगानीहरूमा अपडेट रहनुहोस्',
        portfolioReports: 'पोर्टफोलियो रिपोर्टहरू',
        portfolioReportsDesc: 'तपाईंको पोर्टफोलियोको विस्तृत विश्लेषण',
        portfolioGoals: 'लगानी लक्ष्यहरू',
        portfolioGoalsDesc: 'आफ्नो लगानी उद्देश्यहरू सेट र ट्र्याक गर्नुहोस्',
        portfolioAnalysis: 'पोर्टफोलियो विश्लेषण',
        portfolioAnalysisDesc: 'तपाईंको लगानी रणनीतिको गहिरो विश्लेषण',
        browseBySector: 'सेक्टर अनुसार हेर्नुहोस्',
        allSectors: 'सबै सेक्टर',
        noSectorResults: 'यस सेक्टरमा कुनै शेयर भेटिएन।',
        aboutKickerNot: 'यो के होइन',
        aboutTitle: 'शिक्षाका लागि बनेको सिमुलेटर, हाइपका लागि होइन।',
        aboutLead: 'Arthyq ले बजार कसरी चल्छ, निर्णय कस्तो लाग्छ, र अनुशासन किन महत्त्वपूर्ण छ भन्ने बुझ्न मद्दत गर्छ। वास्तविक पैसा जोखिममा राख्नु अघि अभ्यास गर्ने सुरक्षित ठाउँ हो।',
        aboutCard1Title: 'ट्रेडिङ एप होइन',
        aboutCard1Text: 'यहाँ वास्तविक अर्डर राख्न मिल्दैन। यो अभ्यास हो, कार्यान्वयन होइन।',
        aboutCard2Title: 'छिटो धनी हुने योजना होइन',
        aboutCard2Text: 'कसैले पक्का फाइदा भन्छ भने, टाढा बस्नुहोस्। यो प्लेटफर्मले प्रक्रियामाथि ध्यान दिन सिकाउँछ, छोटकरी होइन।',
        aboutCard3Title: 'आर्थिक सल्लाह होइन',
        aboutCard3Text: 'हामी के किन्ने वा बेच्ने भन्दैनौं। तपाईंले सोच्न, अनुसन्धान गर्न, र निर्णय गर्न सिक्नुहुन्छ।',
        aboutCard4Title: 'जुवा होइन',
        aboutCard4Text: 'हामी तर्क र जोखिम व्यवस्थापनमा ध्यान दिन्छौं। अनियमित बाजी हार्ने सबैभन्दा छिटो तरिका हो।',
        aboutCard5Title: 'वास्तविक पैसा आवश्यक छैन',
        aboutCard5Text: 'तपाईं क्रेडिटबाट सुरु गर्नुहुन्छ। तपाईंको वालेट सुरक्षित रहन्छ। सिकाइ महँगो हुनुपर्दैन।',
        aboutSmirk: 'यहाँ नक्कली पैसा गुमाउनुहोस् ताकि पछि वास्तविक पैसा नगुमाओस्।',
        aboutFounderKicker: 'संस्थापकको बारेमा',
        aboutFounderName: 'सुबिज्ञ राज खरेल',
        aboutFounderNameNepali: 'सुबिज्ञ राज खरेल',
        aboutFounderRole: 'Arthyq का संस्थापक',
        aboutFounderBio: 'म नेपालका सिकाइकर्ताका लागि वित्त शिक्षा सरल, व्यावहारिक, र पहुँचयोग्य बनाउने विद्यार्थी डेभलपर हुँ। Arthyq ले शुरुआतीहरूलाई स्पष्टता, आत्मविश्वास, र शून्य वास्तविक जोखिमसहित लगानी अभ्यास गर्न मद्दत गर्छ।',
        aboutContactLabel: 'सम्पर्क',
        aboutLinksLabel: 'लिङ्कहरू',
        aboutNssLabel: 'Arthyq',
        aboutLinkedIn: 'LinkedIn',
        aboutEmailButton: 'इमेल',
        aboutCallButton: 'कल',
        aboutInstagram: 'इन्स्टाग्राम',
        aboutYouTube: 'युट्युब',
        nssTitle: "Arthyq",
        nssDesc: "जोखिम-मुक्त वातावरणमा नेपाल स्टक एक्सचेन्ज (NEPSE) को बारेमा सिक्न सुरुवात गर्नेहरूलाई मद्दत गर्न डिजाइन गरिएको एक आभासी स्टक ट्रेडिङ प्लेटफर्म। आभासी क्रेडिटहरूसँग अभ्यास गर्नुहोस् र आफ्नो पोर्टफोलियोको प्रदर्शन ट्र्याक गर्नुहोस्।",
        feature1: "आभासी ट्रेडिङ",
        feature1Desc: "आभासी क्रेडिटहरूसँग ट्रेड गर्नुहोस्, वास्तविक पैसा होइन",
        feature2: "रियल-टाइम डाटा",
        feature2Desc: "NEPSE स्टक मूल्य र बजार डाटामा पहुँच",
        feature3: "सिक्ने टूल्स",
        feature3Desc: "स्टक मार्केट सुरुवात गर्नेहरूका लागि शैक्षिक स्रोतहरू",
        founderTitle: "संस्थापकको बारेमा",
        founderName: "सुबिज्ञ राज खरेल",
        founderRole: "विद्यार्थी डेभलपर",
        founderBio: "सुबिज्ञ राज खरेल काठमाडौं, नेपालका एक विद्यार्थी डेभलपर हुन्। हाल कक्षा ९ मा अध्ययनरत सुबिज्ञलाई कोडिङ र विभिन्न वेबसाइट र एपहरू बनाउन मन पर्छ।",
        connectTitle: "हामीसँग जोडिनुहोस्",
        instagram: "इन्स्टाग्राम",
        youtube: "युट्युब",
        playgroundTitle: "प्लेग्राउन्ड",
        playgroundDescription: "एनएसई ट्रेडिङ बुझाइका लागि साना खेलमार्फत छिटो अभ्यास गर्नुहोस्।",
        quizTitle: "NEPSE क्विक क्विज",
        quizDescription: "NEPSE का आधारभूत कुरा छोटो प्रश्नमा जाँच्नुहोस्।",
        quizBody: "क्विज अनुभूति यहाँ देखाइनेछ।",
        chartGameTitle: "चार्ट ट्रेडिङ खेल",
        chartGameSubtitle: "किन्न थिचेर राख्नुहोस्, बेच्न छोड्नुहोस्",
        chartGameDescription: "सिमुलेटेड NEPSE चार्टसँग प्रेस-एन्ड-होल्ड ट्रेडिङको लय सिक्नुहोस्।",
        chartGameHowtoLine1: "चार्टमा थिचेर राख्दा सोही क्षणको मूल्यमा किन्नु हुन्छ।",
        chartGameHowtoLine2: "मूल्य चलिरहँदा थिचिराख्नुहोस्।",
        chartGameHowtoLine3: "छोड्दा बेचिन्छ। Buy & Hold भन्दा राम्रो स्कोर बनाउनुहोस्।",
        chartGamePlayButton: "खेल्नुस्!",
        chartGameModalTitle: "चार्ट ट्रेडिङ खेल",
        chartGameProgressLabel: "प्रगति",
        chartGameCurrentReturnLabel: "हालको रिटर्न",
        chartGameTotalReturnLabel: "कुल रिटर्न",
        chartGameHint: "किन्न थिचेर राख्नुहोस्",
        chartGameResultsTitle: "राउण्ड नतिजा",
        chartGameYourReturnLabel: "तपाईंको रिटर्न",
        chartGameBuyHoldLabel: "Buy & Hold",
        chartGameRestart: "राउण्ड पुनः सुरु",
        chartGameNewRound: "नयाँ राउण्ड",
        chartGameExit: "प्लेग्राउन्डमा फर्कनुहोस्",
        chartGameMessageGreat: "उत्कृष्ट टाइमिङ! बजारको लय जित्नुभयो।",
        chartGameMessageGood: "राम्रो नियन्त्रण। चार्टसँगै रहनुभयो।",
        chartGameMessageTry: "अझै अभ्यास गर्नुहोस्। अर्को राउण्ड तपाईंको हो।",
        chartGameSectorBank: "सिमुलेटेड बैंक",
        chartGameSectorHydro: "सिमुलेटेड हाइड्रो",
        chartGameSectorFinance: "सिमुलेटेड फाइनान्स",
        teamTitle: "हाम्रो टीम",
        teamDescription: "आर्थिक लाई मार्गदर्शन गर्ने र हाम्रो लगानीकर्ता समुदायलाई समर्थन गर्ने समर्पित टोलीलाई भेट्नुहोस्।",
        playgroundTitle: "प्लेग्राउन्ड",
        playgroundSubtitle: "NEPSE का सुरुवाती सिकाइका लागि बनाइएका अन्तरक्रियात्मक अनुभवहरू।",
        managementLabel: "व्यवस्थापन र सञ्चालन",
        researchLabel: "अनुसन्धान र विकास",
        financeLabel: "वित्त",
        marketingLabel: "मार्केटिङ र सञ्चार",
        ceoRole: "प्रमुख कार्यकारी अधिकृत",
        ceoName: "सुबिज्ञ राज खरेल",
        cooRole: "प्रमुख सञ्चालन अधिकृत",
        cooName: "अग्रज रिजाल",
        mdRole: "प्रबन्ध निर्देशक",
        mdName: "नयन शाक्य",
        dcooRole: "सञ्चालन उपाध्यक्ष",
        dcooName: "अभिनव प्याकुरेल",
        croRole: "प्रमुख अनुसन्धान अधिकृत",
        croName: "आरोहन तिम्सिना",
        ctoRole: "प्रमुख प्रविधि अधिकृत",
        ctoName: "अग्रिम रिजाल",
        researchVpRole: "अनुसन्धान उपाध्यक्ष",
        researchVpName: "सायोन लामा",
        cfoRole: "प्रमुख अर्थ अधिकृत",
        cfoName: "रचित भट्टराई",
        cmoRole: "प्रमुख मार्केटिङ अधिकृत",
        cmoName: "रुष्का सापकोटा",
        contentRole: "प्रमुख सञ्चार अधिकृत",
        contentName: "संस्कार शर्मा",
        communicationsVpRole: "सञ्चार उपाध्यक्ष",
        communicationsVpName: "आरव दाहाल"
    }
};

const quizTranslations = {
    english: {
        quizTitle: "NEPSE Quick Quiz",
        quizSubtitle: "Answer 10 quick questions to test your market basics.",
        quizIntroTitle: "NEPSE Quick Quiz",
        quizIntroDesc: "A short, interactive quiz to warm up your stock market fundamentals before trading.",
        quizLaunch: "Test your knowledge!",
        startQuiz: "Start Quiz",
        nextQuestion: "Next",
        restartQuiz: "Restart Quiz",
        tryTrading: "Try Trading",
        correctLabel: "Correct ✓",
        wrongLabel: "Wrong ✗",
        questionProgress: "Question {current} / {total}",
        scoreLine: "Your score: {score} / {total}",
        scoreMessageLow: "Keep learning—your basics will sharpen with practice.",
        scoreMessageMid: "Nice progress! A little more practice will help.",
        scoreMessageHigh: "Excellent! Your NEPSE fundamentals look strong."
    },
    nepali: {
        quizTitle: "NEPSE छिटो क्विज",
        quizSubtitle: "बजारका आधारभूत कुरा जाँच्न १० छोटा प्रश्नहरू।",
        quizIntroTitle: "NEPSE छिटो क्विज",
        quizIntroDesc: "ट्रेडिङ अघि बजारका आधारभूत कुरा तातो बनाउन छोटो र अन्तरक्रियात्मक क्विज।",
        quizLaunch: "आफ्नो ज्ञान परीक्षण गर्नुहोस्!",
        startQuiz: "क्विज सुरु गर्नुहोस्",
        nextQuestion: "अर्को",
        restartQuiz: "क्विज पुनः सुरु गर्नुहोस्",
        tryTrading: "ट्रेडिङ प्रयास गर्नुहोस्",
        correctLabel: "सही ✓",
        wrongLabel: "गलत ✗",
        questionProgress: "प्रश्न {current} / {total}",
        scoreLine: "तपाईंको स्कोर: {score} / {total}",
        scoreMessageLow: "अझै अभ्यास गर्नुपर्छ—आधारभूत कुरा बलियो बनाऔँ।",
        scoreMessageMid: "राम्रो प्रगति! अलि बढी अभ्यास उपयोगी हुन्छ।",
        scoreMessageHigh: "उत्कृष्ट! तपाईंको NEPSE आधार बलियो छ।"
    }
};

const quizQuestions = [
    {
        prompt: {
            english: "NEPSE stands for",
            nepali: "NEPSE को पूरा रूप के हो"
        },
        options: {
            english: ["Nepal Stock Exchange", "Nepal Securities Exchange Program", "National Equity and Price System"],
            nepali: ["नेपाल स्टक एक्सचेन्ज", "नेपाल सेक्युरिटीज एक्सचेन्ज प्रोग्राम", "नेशनल इक्विटी एन्ड प्राइस सिस्टम"]
        },
        correctIndex: 0,
        explanation: {
            english: "NEPSE is Nepal Stock Exchange, the national stock exchange.",
            nepali: "NEPSE भनेको नेपालको स्टक एक्सचेन्ज हो।"
        }
    },
    {
        prompt: {
            english: "What is the official regulator of the securities market in Nepal",
            nepali: "नेपालमा धितोपत्र बजारको नियामक निकाय कुन हो"
        },
        options: {
            english: ["NRB", "SEBON", "MoF"],
            nepali: ["नेपाल राष्ट्र बैंक", "सेबोन", "अर्थ मन्त्रालय"]
        },
        correctIndex: 1,
        explanation: {
            english: "SEBON regulates Nepal's securities market.",
            nepali: "नेपालको धितोपत्र बजारको नियामक निकाय सेबोन हो।"
        }
    },
    {
        prompt: {
            english: "A share traded on NEPSE is primarily traded in which market",
            nepali: "NEPSE मा कारोबार हुने शेयर मुख्यतया कुन बजारमा पर्छ"
        },
        options: {
            english: ["Primary market", "Black market", "Secondary market"],
            nepali: ["प्राथमिक बजार", "कालो बजार", "द्वितीयक बजार"]
        },
        correctIndex: 2,
        explanation: {
            english: "NEPSE is a secondary market for trading listed shares.",
            nepali: "NEPSE मा सूचीबद्ध शेयरहरूको द्वितीयक बजारमा कारोबार हुन्छ।"
        }
    },
    {
        prompt: {
            english: "IPO stands for",
            nepali: "IPO को पूरा रूप के हो"
        },
        options: {
            english: ["International Price Option", "Initial Public Offering", "Investor Profit Output"],
            nepali: ["अन्तर्राष्ट्रिय मूल्य विकल्प", "प्रारम्भिक सार्वजनिक निष्कासन", "लगानीकर्ता नाफा नतिजा"]
        },
        correctIndex: 1,
        explanation: {
            english: "IPO means Initial Public Offering.",
            nepali: "IPO भनेको प्रारम्भिक सार्वजनिक निष्कासन हो।"
        }
    },
    {
        prompt: {
            english: "In Nepal, most IPO applications are submitted through",
            nepali: "नेपालमा अधिकांश IPO आवेदन कुन माध्यमबाट गरिन्छ"
        },
        options: {
            english: ["ePassport", "Nagarik App only", "MeroShare"],
            nepali: ["इ पासपोर्ट", "केवल नागरिक एप", "मेरोशेयर"]
        },
        correctIndex: 2,
        explanation: {
            english: "Most IPO applications are submitted through MeroShare.",
            nepali: "अधिकांश IPO आवेदन मेरोशेयरबाट गरिन्छ।"
        }
    },
    {
        prompt: {
            english: "What does a Demat account mainly do",
            nepali: "डिम्याट खाता मुख्यतया के का लागि प्रयोग हुन्छ"
        },
        options: {
            english: ["Gives loans to investors", "Sets the share price", "Holds shares in electronic form"],
            nepali: ["लगानीकर्तालाई ऋण दिन", "शेयरको मूल्य तोक्न", "शेयरलाई डिजिटल रूपमा राख्न"]
        },
        correctIndex: 2,
        explanation: {
            english: "A Demat account holds shares in electronic form.",
            nepali: "डिम्याट खाताले शेयरलाई डिजिटल रूपमा राख्छ।"
        }
    },
    {
        prompt: {
            english: "Which term best describes the NEPSE Index",
            nepali: "NEPSE सूचकांक के जनाउँछ"
        },
        options: {
            english: ["A list of only bank shares", "A measure of overall market movement", "A company’s profit report"],
            nepali: ["केवल बैंक शेयरको सूची", "बजारको समग्र चालको मापन", "कम्पनीको नाफा प्रतिवेदन"]
        },
        correctIndex: 1,
        explanation: {
            english: "The NEPSE Index reflects overall market movement.",
            nepali: "NEPSE सूचकांकले बजारको समग्र चाल देखाउँछ।"
        }
    },
    {
        prompt: {
            english: "If more people want to buy a stock than sell it, the price usually",
            nepali: "यदि किन्ने चाहना बेच्नेभन्दा बढी भयो भने मूल्य सामान्यतया"
        },
        options: {
            english: ["Goes up", "Goes down", "Stays fixed"],
            nepali: ["बढ्छ", "घट्छ", "उस्तै रहन्छ"]
        },
        correctIndex: 0,
        explanation: {
            english: "Higher demand than supply generally pushes the price up.",
            nepali: "किन्ने चाहना बढी भए मूल्य सामान्यतया बढ्छ।"
        }
    },
    {
        prompt: {
            english: "The money you deposit to buy shares is generally kept in",
            nepali: "शेयर किन्नका लागि राखिने पैसा सामान्यतया कहाँ हुन्छ"
        },
        options: {
            english: ["Demat account", "Share certificate file", "Bank account"],
            nepali: ["डिम्याट खातामा", "शेयर प्रमाणपत्र फाइलमा", "बैंक खातामा"]
        },
        correctIndex: 2,
        explanation: {
            english: "Funds for buying shares are kept in the linked bank account.",
            nepali: "शेयर किन्नका लागि राखिने पैसा बैंक खातामा हुन्छ।"
        }
    },
    {
        prompt: {
            english: "Diversification means",
            nepali: "विविधीकरण भन्नाले के बुझिन्छ"
        },
        options: {
            english: ["Putting all money in one stock", "Investing in different companies or sectors", "Buying and selling daily without plan"],
            nepali: ["सबै पैसा एउटै शेयरमा राख्नु", "विभिन्न कम्पनी वा क्षेत्रहरुमा लगानी गर्नु", "योजना बिना दैनिक किनबेच गर्नु"]
        },
        correctIndex: 1,
        explanation: {
            english: "Diversification is investing across multiple companies or sectors.",
            nepali: "विविधीकरण भनेको विभिन्न कम्पनी वा क्षेत्रमा लगानी गर्नु हो।"
        }
    }
];

const quizState = {
    isOpen: false,
    isStarted: false,
    isFinished: false,
    currentQuestionIndex: 0,
    selectedOptionIndex: null,
    score: 0,
    hasAnswered: false,
    answers: Array.from({ length: quizQuestions.length }, () => null)
};

let lastQuizView = null;
let lastQuizQuestionIndex = null;

function formatQuizNumber(value, language = getCurrentLanguage()) {
    return formatNumber(value, { decimals: 0, useCommas: true }, language);
}

function getQuizTranslations(language = getCurrentLanguage()) {
    return quizTranslations[language] || quizTranslations.english;
}

function resetQuizState() {
    quizState.isStarted = false;
    quizState.isFinished = false;
    quizState.currentQuestionIndex = 0;
    quizState.selectedOptionIndex = null;
    quizState.score = 0;
    quizState.hasAnswered = false;
    quizState.answers = Array.from({ length: quizQuestions.length }, () => null);
    lastQuizView = null;
    lastQuizQuestionIndex = null;
}

function revealQuiz() {
    resetQuizState();
    quizState.isOpen = true;
    quizState.isStarted = true;
    renderQuiz();
}

function startQuiz() {
    resetQuizState();
    quizState.isOpen = true;
    quizState.isStarted = true;
    renderQuiz();
}

function restartQuiz() {
    startQuiz();
}

function updateQuizTranslations(language = getCurrentLanguage()) {
    const texts = getQuizTranslations(language);
    document.querySelectorAll('[data-quiz-translate]').forEach(element => {
        const key = element.getAttribute('data-quiz-translate');
        if (texts[key]) {
            element.textContent = texts[key];
        }
    });
    renderQuiz();
}

function handleOptionSelection(selectedIndex) {
    if (quizState.hasAnswered) {
        return;
    }
    const currentQuestion = quizQuestions[quizState.currentQuestionIndex];
    quizState.selectedOptionIndex = selectedIndex;
    quizState.hasAnswered = true;
    quizState.answers[quizState.currentQuestionIndex] = selectedIndex;
    if (selectedIndex === currentQuestion.correctIndex) {
        quizState.score += 1;
    }
    renderQuiz();
}

function handleNextQuestion() {
    const nextIndex = quizState.currentQuestionIndex + 1;
    if (nextIndex >= quizQuestions.length) {
        quizState.isFinished = true;
    } else {
        quizState.currentQuestionIndex = nextIndex;
    }
    const selectedIndex = quizState.answers[quizState.currentQuestionIndex];
    quizState.selectedOptionIndex = selectedIndex;
    quizState.hasAnswered = selectedIndex !== null && selectedIndex !== undefined;
    renderQuiz();
}

function getScoreMessage(score, texts) {
    if (score <= 3) {
        return texts.scoreMessageLow;
    }
    if (score <= 7) {
        return texts.scoreMessageMid;
    }
    return texts.scoreMessageHigh;
}

function renderQuiz() {
    const container = document.getElementById('quizContent');
    if (!container) {
        return;
    }

    const introPanel = document.querySelector('.playground-quiz-intro');
    if (!quizState.isOpen) {
        container.innerHTML = '';
        container.classList.add('is-hidden');
        if (introPanel) {
            introPanel.classList.remove('is-hidden');
        }
        return;
    }

    container.classList.remove('is-hidden');
    if (introPanel) {
        introPanel.classList.add('is-hidden');
    }

    const language = getCurrentLanguage();
    const texts = getQuizTranslations(language);
    const totalQuestions = quizQuestions.length;
    container.innerHTML = '';

    const view = quizState.isFinished ? 'result' : (quizState.isStarted ? 'question' : 'start');
const shouldAnimate =
  view !== lastQuizView ||
  (view === 'question' && quizState.currentQuestionIndex !== lastQuizQuestionIndex);

if (!quizState.isStarted) {
  const startPanel = document.createElement('div');
  startPanel.className = 'quiz-panel quiz-start';

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'quiz-primary-btn';
  startButton.textContent = texts.startQuiz;

  // IMPORTANT: mark started only when the user actually clicks start
  startButton.addEventListener('click', () => {
    quizState.isStarted = true;
    startQuiz();
  });

  startPanel.appendChild(startButton);
  container.appendChild(startPanel);

  if (shouldAnimate) {
    requestAnimationFrame(() => startPanel.classList.add('is-visible'));
  } else {
    startPanel.classList.add('is-visible');
  }

  lastQuizView = view;
  return;
}

    if (quizState.isFinished) {
        const resultPanel = document.createElement('div');
        resultPanel.className = 'quiz-panel quiz-result';

        const scoreLine = document.createElement('div');
        scoreLine.className = 'quiz-result-score';
        scoreLine.innerHTML = texts.scoreLine
            .replace('{score}', wrapNumberDisplay(formatQuizNumber(quizState.score, language)))
            .replace('{total}', wrapNumberDisplay(formatQuizNumber(totalQuestions, language)));

        const scoreMessage = document.createElement('div');
        scoreMessage.className = 'quiz-result-message';
        scoreMessage.textContent = getScoreMessage(quizState.score, texts);

        const actions = document.createElement('div');
        actions.className = 'quiz-actions';

        const tradeButton = document.createElement('button');
        tradeButton.type = 'button';
        tradeButton.className = 'quiz-primary-btn';
        tradeButton.textContent = texts.tryTrading;
        tradeButton.addEventListener('click', () => {
            showSection('market');
            updateActiveSection('market');
        });

        const restartButton = document.createElement('button');
        restartButton.type = 'button';
        restartButton.className = 'quiz-secondary-btn';
        restartButton.textContent = texts.restartQuiz;
        restartButton.addEventListener('click', restartQuiz);

        actions.appendChild(tradeButton);
        actions.appendChild(restartButton);

        resultPanel.appendChild(scoreLine);
        resultPanel.appendChild(scoreMessage);
        resultPanel.appendChild(actions);
        container.appendChild(resultPanel);

        if (shouldAnimate) {
            requestAnimationFrame(() => resultPanel.classList.add('is-visible'));
        } else {
            resultPanel.classList.add('is-visible');
        }
        lastQuizView = view;
        return;
    }

    const currentQuestion = quizQuestions[quizState.currentQuestionIndex];
    const selectedIndex = quizState.answers[quizState.currentQuestionIndex];
    quizState.selectedOptionIndex = selectedIndex;
    quizState.hasAnswered = selectedIndex !== null && selectedIndex !== undefined;

    const questionPanel = document.createElement('div');
    questionPanel.className = 'quiz-panel quiz-question';

    const progressMeta = document.createElement('div');
    progressMeta.className = 'quiz-progress-meta';

    const progressLabel = document.createElement('span');
    progressLabel.innerHTML = texts.questionProgress
        .replace('{current}', wrapNumberDisplay(formatQuizNumber(quizState.currentQuestionIndex + 1, language)))
        .replace('{total}', wrapNumberDisplay(formatQuizNumber(totalQuestions, language)));

    progressMeta.appendChild(progressLabel);

    const progressBar = document.createElement('div');
    progressBar.className = 'quiz-progress';

    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'quiz-progress-bar';
    progressIndicator.style.width = `${((quizState.currentQuestionIndex + 1) / totalQuestions) * 100}%`;
    progressBar.appendChild(progressIndicator);

const questionCard = document.createElement('div');
questionCard.className = 'quiz-question-card';

const questionText = document.createElement('div');
questionText.className = 'quiz-question-text';
questionText.textContent = currentQuestion.prompt[language];

questionCard.appendChild(questionText);


    const optionsWrapper = document.createElement('div');
    optionsWrapper.className = 'quiz-options';

    currentQuestion.options[language].forEach((option, index) => {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'quiz-option';
        const optionText = document.createElement('span');
        optionText.className = 'quiz-option-text';
        optionText.textContent = option;
        optionButton.appendChild(optionText);
        optionButton.setAttribute('aria-pressed', selectedIndex === index ? 'true' : 'false');
        if (quizState.hasAnswered) {
            optionButton.disabled = true;
            if (index === currentQuestion.correctIndex) {
                optionButton.classList.add('is-correct');
                const correctIcon = document.createElement('span');
                correctIcon.className = 'quiz-option-icon';
                correctIcon.textContent = '✔';
                correctIcon.setAttribute('aria-hidden', 'true');
                optionButton.appendChild(correctIcon);
            }
            if (index === selectedIndex && selectedIndex !== currentQuestion.correctIndex) {
                optionButton.classList.add('is-wrong');
                const wrongIcon = document.createElement('span');
                wrongIcon.className = 'quiz-option-icon';
                wrongIcon.textContent = '✖';
                wrongIcon.setAttribute('aria-hidden', 'true');
                optionButton.appendChild(wrongIcon);
            }
        } else {
            optionButton.addEventListener('click', () => handleOptionSelection(index));
        }
        optionsWrapper.appendChild(optionButton);
    });

    questionPanel.appendChild(progressMeta);
    questionPanel.appendChild(progressBar);
    questionPanel.appendChild(questionCard);
    questionPanel.appendChild(optionsWrapper);

    if (quizState.hasAnswered) {
        const feedback = document.createElement('div');
        const isCorrect = selectedIndex === currentQuestion.correctIndex;
        feedback.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;

        const feedbackTitle = document.createElement('strong');
        feedbackTitle.textContent = isCorrect ? texts.correctLabel : texts.wrongLabel;

        const feedbackText = document.createElement('span');
        feedbackText.textContent = currentQuestion.explanation[language];

        feedback.appendChild(feedbackTitle);
        feedback.appendChild(feedbackText);

        const actions = document.createElement('div');
        actions.className = 'quiz-actions';

        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.className = 'quiz-primary-btn';
        nextButton.textContent = texts.nextQuestion;
        nextButton.addEventListener('click', handleNextQuestion);

        actions.appendChild(nextButton);

        questionPanel.appendChild(feedback);
        questionPanel.appendChild(actions);
    }

    container.appendChild(questionPanel);

    if (shouldAnimate) {
        requestAnimationFrame(() => questionPanel.classList.add('is-visible'));
    } else {
        questionPanel.classList.add('is-visible');
    }

    const feedbackPanel = questionPanel.querySelector('.quiz-feedback');
    if (feedbackPanel) {
        requestAnimationFrame(() => feedbackPanel.classList.add('is-visible'));
    }

    lastQuizView = view;
    lastQuizQuestionIndex = quizState.currentQuestionIndex;
}

document.addEventListener('DOMContentLoaded', () => {
    const launchButton = document.getElementById('quizLaunch');
    if (launchButton) {
        launchButton.addEventListener('click', () => {
            revealQuiz();
            const quizContent = document.getElementById('quizContent');
            if (quizContent) {
                quizContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
});

// Initialize settings from localStorage or set defaults
function initializeSettings() {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeButton = document.getElementById(savedTheme + 'Mode');
    if (themeButton) {
        themeButton.classList.add('active');
    }

    // Text Size
    const savedTextSize = localStorage.getItem('textSize') || 'medium';
    document.documentElement.setAttribute('data-text-size', savedTextSize);
    const textSizeButton = document.getElementById(savedTextSize + 'Text');
    if (textSizeButton) {
        textSizeButton.classList.add('active');
    }

    // Language - Set English as default
    const savedLanguage = localStorage.getItem('language') || 'english';
    const languageButton = document.getElementById(savedLanguage + 'Lang');
    if (languageButton) {
        languageButton.classList.add('active');
    }
    updateLanguage(savedLanguage);
}

// Theme toggle
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.id.replace('Mode', '');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update active state
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Text size toggle
document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const size = btn.id.replace('Text', '');
        document.documentElement.setAttribute('data-text-size', size.toLowerCase());
        localStorage.setItem('textSize', size.toLowerCase());
        
        // Update active state
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Language toggle
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.id.replace('Lang', '');
        localStorage.setItem('language', lang);
        
        // Update active state
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        updateLanguage(lang);
    });
});

// Update text content based on selected language
function updateLanguage(language) {
    const texts = translations[language];
    document.documentElement.lang = isNepaliLanguage(language) ? 'ne' : 'en';
    
    // Update all translatable elements
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (texts[key]) {
            if (key === 'welcome') {
                const investorName = localStorage.getItem('investorName');
                if (investorName) {
                    if (language === 'english') {
                        element.textContent = `Welcome, ${investorName}!`;
                    } else {
                        element.textContent = `स्वागत छ, ${investorName}!`;
                    }
                } else {
                    element.textContent = texts[key];
                }
            } else if (element.tagName === 'INPUT') {
                element.value = texts[key];
            } else {
                element.textContent = texts[key];
            }
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (texts[key]) {
            element.placeholder = texts[key];
        }
    });

    // Update dynamic content
    updateDynamicContent(language);
    updateChartGameText(language);

    // Update quiz content
    updateQuizTranslations(language);

    // Localize static numbers in the UI
    localizeStaticNumbers(language);
    normalizeNumberNodes(language);
    normalizeAllTextDigits(language);
    refreshHomeDashboardLocale();
}

const localizedNumberNodes = new WeakMap();
let isDigitNormalizationRunning = false;
let digitNormalizationObserverInitialized = false;

function localizeStaticNumbers(language) {
    document.querySelectorAll('[data-localize-numbers]').forEach(element => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            if (!localizedNumberNodes.has(node)) {
                localizedNumberNodes.set(node, node.nodeValue);
            }
            const baseText = localizedNumberNodes.get(node);
            node.nodeValue = isNepaliLanguage(language) ? toNepaliNumerals(baseText) : baseText;
        }
    });
}

function normalizeAllTextDigits(language) {
    if (isDigitNormalizationRunning) {
        return;
    }
    const root = document.body;
    if (!root) {
        return;
    }
    const normalizeToNepali = isNepaliLanguage(language);
    isDigitNormalizationRunning = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            if (!node.nodeValue || !/[0-9०-९]/.test(node.nodeValue)) {
                return NodeFilter.FILTER_SKIP;
            }
            const parent = node.parentElement;
            if (!parent) {
                return NodeFilter.FILTER_SKIP;
            }
            const tagName = parent.tagName;
            if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(tagName)) {
                return NodeFilter.FILTER_REJECT;
            }
            if (parent.closest('[data-no-localize]')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let node;
    while ((node = walker.nextNode())) {
        const baseText = normalizeToNepali
            ? (typeof toEnglishNumerals === 'function' ? toEnglishNumerals(node.nodeValue) : node.nodeValue)
            : node.nodeValue;
        node.nodeValue = normalizeToNepali ? toNepaliNumerals(baseText) : toEnglishNumerals(baseText);
    }
    isDigitNormalizationRunning = false;
}

function initDigitNormalizationObserver() {
    if (digitNormalizationObserverInitialized) {
        return;
    }
    digitNormalizationObserverInitialized = true;
    let pending = null;
    const observer = new MutationObserver(() => {
        if (pending) {
            clearTimeout(pending);
        }
        pending = setTimeout(() => {
            normalizeAllTextDigits(getCurrentLanguage());
        }, 0);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

// Update dynamic content that's added through JavaScript
function updateDynamicContent(language) {
    const texts = translations[language];

    // Update trade modal content if it exists
    const tradeModal = document.getElementById('tradeModal');
    if (tradeModal) {
        const modalTitle = tradeModal.querySelector('h2');
        if (modalTitle) modalTitle.textContent = texts.tradeStock || 'Trade Stock';


        const backBtn = tradeModal.querySelector('.modal-btn.back');
        if (backBtn) backBtn.textContent = texts.back || 'Back';

        const confirmBtn = tradeModal.querySelector('.modal-btn.confirm');
        if (confirmBtn) confirmBtn.textContent = texts.confirm || 'Confirm Trade';
    }

    // Update table headers dynamically
    updateTableHeaders(language);

    // Refresh data-driven sections to apply locale formatting
    fetchTopGainers();
    fetchTopLosers();
    loadAllStocks();
    updatePortfolio();
    updateCreditDisplay();

    // Update sector filters with translated labels
    renderSectorFilters(latestSectorCounts);
    applySectorFilter();
}

// Update table headers with translations
function updateTableHeaders(language) {
    const texts = translations[language];

    // Update gainers table
    const gainersTable = document.getElementById('gainersTable');
    if (gainersTable) {
        const headers = gainersTable.querySelectorAll('th');
        headers[0].textContent = texts.symbol || 'Symbol';
        headers[1].textContent = texts.price || 'Price';
        headers[2].textContent = texts.change || 'Change';
    }

    // Update losers table
    const losersTable = document.getElementById('losersTable');
    if (losersTable) {
        const headers = losersTable.querySelectorAll('th');
        headers[0].textContent = texts.symbol || 'Symbol';
        headers[1].textContent = texts.price || 'Price';
        headers[2].textContent = texts.change || 'Change';
    }

    // Update all stocks table
    const allStocksTable = document.getElementById('allStocksTable');
    if (allStocksTable) {
        const headers = allStocksTable.querySelectorAll('th');
        headers[0].textContent = texts.symbol || 'Symbol';
        headers[1].textContent = texts.companyName || 'Company Name';
        headers[2].textContent = texts.sector || 'Sector';
        headers[3].textContent = texts.ltp || 'LTP';
        headers[4].textContent = texts.change || 'Change';
        headers[5].textContent = texts.relativeStrength || 'RS';
        headers[6].textContent = texts.action || 'Action';
    }

    // Update investment history table
    const investmentHistory = document.getElementById('investmentHistory');
    if (investmentHistory) {
        const headers = investmentHistory.querySelectorAll('th');
        if (headers.length > 0) {
            headers[0].textContent = texts.symbol;
            headers[1].textContent = texts.portfolioAvgBuy;
            headers[2].textContent = texts.portfolioLtp;
            headers[3].textContent = texts.portfolioQty;
            headers[4].textContent = texts.portfolioValue;
            headers[5].textContent = texts.portfolioPl + ' 📊';
            headers[6].textContent = texts.action + ' ⚡';
        }
    }
}

// Add translation data attributes to HTML elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize settings
    initializeSettings();

    // Apply initial translation
    const currentLanguage = localStorage.getItem('language') || 'english';
    updateLanguage(currentLanguage);
});

// Tutorial Navigation
function showTutorialStep(step) {
  // Hide all steps
  document.querySelectorAll('.tutorial-step').forEach(el => {
    el.classList.remove('active');
  });
  
  // Show current step
  const currentStepElement = document.querySelector(`[data-step="${step}"]`);
  if (currentStepElement) {
    currentStepElement.classList.add('active');
  }
  
  // Update navigation buttons
  const nextButton = document.getElementById('tutorialNext');
  const startButton = document.getElementById('tutorialStart');
  
  if (step === totalSteps) {
    nextButton.style.display = 'none';
    startButton.style.display = 'inline-block';
  } else {
    nextButton.style.display = 'inline-block';
    startButton.style.display = 'none';
  }
}

// Handle tutorial navigation
document.getElementById('tutorialNext')?.addEventListener('click', () => {
  if (currentStep < totalSteps) {
    currentStep++;
    showTutorialStep(currentStep);
  }
});

// Handle tutorial completion
document.getElementById('tutorialStart')?.addEventListener('click', () => {
  const nameInput = document.getElementById('investorName');
  const investorName = nameInput.value.trim();
  
  if (!investorName) {
    showToast('Please enter your name to continue!');
    return;
  }
  
  // Save investor name
  localStorage.setItem('investorName', investorName);
  localStorage.setItem('hasVisitedBefore', 'true');
  
  // Hide tutorial
  document.getElementById('tutorialOverlay').style.display = 'none';
  
  // Initialize the app
  initializeApp();
});

// Initialize app after tutorial
function initializeApp() {
  // Show home section
  showSection('home');
  updateActiveSection('home');
  
  // Update welcome message with investor name
  const investorName = localStorage.getItem('investorName');
  if (investorName) {
    const welcomeMessage = document.querySelector('[data-translate="welcome"]');
    if (welcomeMessage) {
      welcomeMessage.textContent = `Welcome, ${investorName}!`;
    }
  }
}

const chartGameState = {
  data: null,
  candles: [],
  currentIndex: 0,
  inPosition: false,
  entryPrice: 0,
  currentReturnPercent: 0,
  totalReturnPercent: 0,
  buyHoldPercent: 0,
  initialEquity: 10000,
  equity: 10000,
  playing: false,
  isComplete: false,
  animationFrame: null,
  lastStepTime: 0,
  tickInterval: 220,
  elements: {}
};

const chartGameFiles = {
  bank: Array.from({ length: 20 }, (_, i) => `mockdata/bank_round_${String(i + 1).padStart(2, '0')}.json`),
  hydro: Array.from({ length: 20 }, (_, i) => `mockdata/hydro_round_${String(i + 1).padStart(2, '0')}.json`),
  finance: Array.from({ length: 20 }, (_, i) => `mockdata/finance_round_${String(i + 1).padStart(2, '0')}.json`)
};

function setupChartTradingGame() {
  const modal = document.getElementById('chartGameModal');
  const openBtn = document.getElementById('openChartGame');
  if (!modal || !openBtn) return;

  chartGameState.elements = {
    modal,
    openBtn,
    closeBtn: document.getElementById('chartGameClose'),
    exitBtn: document.getElementById('chartGameExit'),
    restartBtn: document.getElementById('chartGameRestart'),
    newRoundBtn: document.getElementById('chartGameNewRound'),
    progress: document.getElementById('chartGameProgress'),
    currentReturn: document.getElementById('chartGameCurrentReturn'),
    totalReturn: document.getElementById('chartGameTotalReturn'),
    yourReturn: document.getElementById('chartGameYourReturn'),
    buyHold: document.getElementById('chartGameBuyHold'),
    statusMessage: document.getElementById('chartGameStatusMessage'),
    meta: document.getElementById('chartGameMeta'),
    chartArea: document.getElementById('chartGameChartArea'),
    canvas: document.getElementById('chartGameCanvas'),
    results: document.getElementById('chartGameResults')
  };

  openBtn.addEventListener('click', () => {
    openChartGame();
  });

  chartGameState.elements.closeBtn?.addEventListener('click', closeChartGame);
  chartGameState.elements.exitBtn?.addEventListener('click', closeChartGame);
  chartGameState.elements.restartBtn?.addEventListener('click', restartChartGameRound);
  chartGameState.elements.newRoundBtn?.addEventListener('click', startNewChartGameRound);

  chartGameState.elements.chartArea?.addEventListener('pointerdown', handleChartPressStart);
  chartGameState.elements.chartArea?.addEventListener('pointerup', handleChartPressEnd);
  chartGameState.elements.chartArea?.addEventListener('pointerleave', handleChartPressEnd);
  chartGameState.elements.chartArea?.addEventListener('pointercancel', handleChartPressEnd);

  window.addEventListener('resize', () => {
    drawChartGame();
  });

  const howtoBoxes = document.querySelectorAll('[data-animate="howto"]');
  if (howtoBoxes.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.2 });
    howtoBoxes.forEach((box) => observer.observe(box));
  }
}

function openChartGame() {
  const { modal } = chartGameState.elements;
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (!chartGameState.data) {
    startNewChartGameRound();
  } else {
    resumeChartGame();
  }
  updateChartGameText(getCurrentLanguage());
}

function closeChartGame() {
  const { modal } = chartGameState.elements;
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  stopChartGame();
}

function stopChartGame() {
  chartGameState.playing = false;
  if (chartGameState.animationFrame) {
    cancelAnimationFrame(chartGameState.animationFrame);
    chartGameState.animationFrame = null;
  }
}

function resumeChartGame() {
  if (chartGameState.isComplete) {
    drawChartGame();
    return;
  }
  if (!chartGameState.playing) {
    chartGameState.playing = true;
    chartGameState.lastStepTime = 0;
    chartGameState.animationFrame = requestAnimationFrame(runChartGameLoop);
  }
}

function restartChartGameRound() {
  if (!chartGameState.data) {
    startNewChartGameRound();
    return;
  }
  initializeChartGameRound(chartGameState.data);
}

async function startNewChartGameRound() {
  const sectorKeys = Object.keys(chartGameFiles);
  const randomSector = sectorKeys[Math.floor(Math.random() * sectorKeys.length)];
  const files = chartGameFiles[randomSector];
  const file = files[Math.floor(Math.random() * files.length)];
  await loadChartGameData(file);
}

async function loadChartGameData(path) {
  try {
    const response = await fetch(path);
    const data = await response.json();
    initializeChartGameRound(data);
  } catch (error) {
    console.error('Failed to load chart game data', error);
  }
}

function initializeChartGameRound(data) {
  chartGameState.data = data;
  chartGameState.candles = data.candles || [];
  chartGameState.currentIndex = 0;
  chartGameState.inPosition = false;
  chartGameState.entryPrice = 0;
  chartGameState.currentReturnPercent = 0;
  chartGameState.totalReturnPercent = 0;
  chartGameState.buyHoldPercent = 0;
  chartGameState.equity = chartGameState.initialEquity;
  chartGameState.isComplete = false;
  chartGameState.lastStepTime = 0;
  chartGameState.elements.results?.classList.remove('active');
  chartGameState.elements.results?.setAttribute('aria-hidden', 'true');
  resumeChartGame();
  updateChartGameText(getCurrentLanguage());
  drawChartGame();
}

function runChartGameLoop(timestamp) {
  if (!chartGameState.playing) return;
  if (!chartGameState.lastStepTime) {
    chartGameState.lastStepTime = timestamp;
  }
  const elapsed = timestamp - chartGameState.lastStepTime;
  if (elapsed >= chartGameState.tickInterval) {
    chartGameState.lastStepTime = timestamp;
    advanceChartGame();
  }
  drawChartGame();
  chartGameState.animationFrame = requestAnimationFrame(runChartGameLoop);
}

function advanceChartGame() {
  if (chartGameState.currentIndex < chartGameState.candles.length - 1) {
    chartGameState.currentIndex += 1;
    updateChartGameReturns();
  } else {
    completeChartGameRound();
  }
}

function handleChartPressStart(event) {
  if (chartGameState.isComplete || chartGameState.inPosition || !chartGameState.playing) return;
  event.preventDefault();
  const currentPrice = getCurrentChartPrice();
  if (!currentPrice) return;
  chartGameState.inPosition = true;
  chartGameState.entryPrice = currentPrice;
  chartGameState.elements.chartArea?.classList.add('is-pressing');
  updateChartGameReturns();
}

function handleChartPressEnd() {
  if (!chartGameState.inPosition) return;
  const currentPrice = getCurrentChartPrice();
  if (!currentPrice) return;
  const tradeReturn = (currentPrice - chartGameState.entryPrice) / chartGameState.entryPrice;
  chartGameState.equity *= (1 + tradeReturn);
  chartGameState.totalReturnPercent = ((chartGameState.equity / chartGameState.initialEquity) - 1) * 100;
  chartGameState.inPosition = false;
  chartGameState.entryPrice = 0;
  chartGameState.currentReturnPercent = 0;
  chartGameState.elements.chartArea?.classList.remove('is-pressing');
  updateChartGameNumbers();
}

function updateChartGameReturns() {
  if (chartGameState.inPosition) {
    const currentPrice = getCurrentChartPrice();
    if (currentPrice && chartGameState.entryPrice) {
      chartGameState.currentReturnPercent = ((currentPrice - chartGameState.entryPrice) / chartGameState.entryPrice) * 100;
    }
  } else {
    chartGameState.currentReturnPercent = 0;
  }
  updateChartGameNumbers();
}

function getCurrentChartPrice() {
  const candle = chartGameState.candles[chartGameState.currentIndex];
  return candle ? candle.c : 0;
}

function completeChartGameRound() {
  if (chartGameState.isComplete) return;
  chartGameState.isComplete = true;
  chartGameState.playing = false;
  if (chartGameState.inPosition) {
    handleChartPressEnd();
  }
  const first = chartGameState.candles[0];
  const last = chartGameState.candles[chartGameState.candles.length - 1];
  if (first && last) {
    chartGameState.buyHoldPercent = ((last.c - first.o) / first.o) * 100;
  }
  updateChartGameNumbers();
  updateChartGameStatusMessage();
  chartGameState.elements.results?.classList.add('active');
  chartGameState.elements.results?.setAttribute('aria-hidden', 'false');
}

function updateChartGameNumbers() {
  const language = getCurrentLanguage();
  const { progress, currentReturn, totalReturn, yourReturn, buyHold } = chartGameState.elements;
  if (progress) {
    progress.textContent = formatChartGameProgress(language);
  }
  if (currentReturn) {
    currentReturn.textContent = formatChartGamePercent(chartGameState.currentReturnPercent, language);
  }
  if (totalReturn) {
    totalReturn.textContent = formatChartGamePercent(chartGameState.totalReturnPercent, language);
  }
  if (yourReturn) {
    yourReturn.textContent = formatChartGamePercent(chartGameState.totalReturnPercent, language);
  }
  if (buyHold) {
    buyHold.textContent = formatChartGamePercent(chartGameState.buyHoldPercent, language);
  }
}

function updateChartGameStatusMessage() {
  const language = getCurrentLanguage();
  const texts = translations[language] || translations.english;
  const messageEl = chartGameState.elements.statusMessage;
  if (!messageEl) return;
  if (!chartGameState.isComplete) {
    messageEl.textContent = '';
    return;
  }
  if (chartGameState.totalReturnPercent >= chartGameState.buyHoldPercent + 2) {
    messageEl.textContent = texts.chartGameMessageGreat;
  } else if (chartGameState.totalReturnPercent >= chartGameState.buyHoldPercent - 2) {
    messageEl.textContent = texts.chartGameMessageGood;
  } else {
    messageEl.textContent = texts.chartGameMessageTry;
  }
}

function updateChartGameText(language) {
  if (!chartGameState.elements.modal) return;
  const texts = translations[language] || translations.english;
  if (chartGameState.data && chartGameState.elements.meta) {
    const symbol = chartGameState.data.symbol_en || chartGameState.data.symbol || chartGameState.data.symbol_np;
    const sectorLabel = getChartGameSectorLabel(chartGameState.data.sector, texts);
    chartGameState.elements.meta.textContent = `${symbol} • ${sectorLabel}`;
  } else if (chartGameState.elements.meta) {
    chartGameState.elements.meta.textContent = '';
  }
  updateChartGameNumbers();
  updateChartGameStatusMessage();
}

function getChartGameSectorLabel(sector, texts) {
  if (!sector) return '';
  if (sector.includes('Bank')) return texts.chartGameSectorBank;
  if (sector.includes('Hydro')) return texts.chartGameSectorHydro;
  if (sector.includes('Finance')) return texts.chartGameSectorFinance;
  return sector;
}

function formatChartGameProgress(language) {
  const current = chartGameState.candles.length ? chartGameState.currentIndex + 1 : 0;
  const total = chartGameState.candles.length || 0;
  const currentDisplay = formatNumber(current, { decimals: 0, useCommas: true }, language);
  const totalDisplay = formatNumber(total, { decimals: 0, useCommas: true }, language);
  return `${currentDisplay}/${totalDisplay}`;
}

function formatChartGamePercent(value, language) {
  const sign = value > 0 ? '+' : '';
  const formatted = formatNumber(value, { decimals: 2, useCommas: true }, language);
  return `${sign}${formatted}%`;
}

function drawChartGame() {
  const canvas = chartGameState.elements.canvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, width, height);
  if (!chartGameState.candles.length) return;

  const visible = chartGameState.candles.slice(0, chartGameState.currentIndex + 1);
  const prices = visible.map((candle) => candle.c);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const padding = { top: 24, right: 24, bottom: 32, left: 32 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xStep = visible.length > 1 ? chartWidth / (visible.length - 1) : 0;

  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue('--primary-color').trim() || '#3498db';
  const glowColor = styles.getPropertyValue('--secondary-color').trim() || '#2ecc71';

  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  visible.forEach((candle, index) => {
    const x = padding.left + index * xStep;
    const y = padding.top + (maxPrice - candle.c) / range * chartHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = lineColor;
  ctx.stroke();

  const lastIndex = visible.length - 1;
  const lastCandle = visible[lastIndex];
  const lastX = padding.left + lastIndex * xStep;
  const lastY = padding.top + (maxPrice - lastCandle.c) / range * chartHeight;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
  ctx.fillStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
}

document.addEventListener('DOMContentLoaded', () => {
  setupChartTradingGame();
});

let aboutRevealInitialized = false;

const initAboutReveal = () => {
  if (aboutRevealInitialized) {
    return;
  }
  aboutRevealInitialized = true;

  const aboutSection = document.querySelector('.nss-about');
  if (!aboutSection) {
    return;
  }

  const revealItems = aboutSection.querySelectorAll('[data-reveal]');
  if (!revealItems.length) {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px'
    }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 60, 240)}ms`;
    observer.observe(item);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initAboutReveal();
});

function initPolishEnhancements() {
  if (polishIntroInitialized) {
    return;
  }
  polishIntroInitialized = true;

  const body = document.body;
  if (body && !sessionStorage.getItem('polishIntroDone')) {
    body.classList.add('polish-enter');
    sessionStorage.setItem('polishIntroDone', 'true');
    window.setTimeout(() => {
      body.classList.remove('polish-enter');
    }, 900);
  }

  initTableScrollHints();
}

function initTableScrollHints() {
  if (tableHintInitialized) {
    return;
  }
  tableHintInitialized = true;

  const containers = Array.from(document.querySelectorAll('.table-container, .all-stocks'));
  if (!containers.length) {
    return;
  }

  const updateHintState = (container) => {
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const hasOverflow = maxScrollLeft > 2;
    const atEnd = container.scrollLeft >= maxScrollLeft - 2;
    container.classList.toggle('scroll-hint', hasOverflow && !atEnd);
  };

  const updateHints = () => {
    containers.forEach(updateHintState);
  };

  updateHints();
  window.setTimeout(updateHints, 800);
  window.addEventListener(
    'resize',
    () => {
      window.requestAnimationFrame(updateHints);
    },
    { passive: true }
  );
  containers.forEach((container) => {
    container.addEventListener(
      'scroll',
      () => {
        window.requestAnimationFrame(() => updateHintState(container));
      },
      { passive: true }
    );
  });
}
