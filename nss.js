document.addEventListener("DOMContentLoaded", async () => {
  fetchSummary();
  fetchTopGainers();
  fetchTopLosers();
  fetchNepseIndex();
  initCredits();
  updateCreditDisplay();
  loadAllStocks();
  initTheme();
  initSettings();
  initAuth();
  await updatePortfolio();
  
  // Add event listeners for credit actions
  const claimDailyBonusBtn = document.getElementById('claimDailyBonus');
  const watchAdBtn = document.getElementById('watchAd');
  const weeklySpinBtn = document.getElementById('weeklySpin');
  
  if (claimDailyBonusBtn) claimDailyBonusBtn.addEventListener('click', claimDailyBonus);
  if (watchAdBtn) watchAdBtn.addEventListener('click', watchAd);
  if (weeklySpinBtn) weeklySpinBtn.addEventListener('click', weeklySpin);
});

function fetchSummary() {
  fetch("https://nss-c26z.onrender.com/Summary")
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("summaryTable");
      table.innerHTML = "<tr><th>📋 Detail</th><th>📊 Value</th></tr>";
      for (let key in data) {
        table.innerHTML += `<tr><td>${key}</td><td>${data[key]}</td></tr>`;
      }
    })
    .catch(() => {
      console.error("⚠️ Error fetching summary data.");
    });
}

function fetchTopGainers() {
  fetch("https://nss-c26z.onrender.com/TopGainers")
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("gainersTable");
      table.innerHTML = "<tr><th>📈 Symbol</th><th>🔼 Change (%)</th></tr>";
      data.slice(0, 10).forEach(item => {
        table.innerHTML += `<tr><td>${item.symbol}</td><td class="gain">+${item.percentageChange}%</td></tr>`;
      });
    })
    .catch(() => {
      console.error("⚠️ Error fetching top gainers.");
    });
}

function fetchTopLosers() {
  fetch("https://nss-c26z.onrender.com/TopLosers")
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("losersTable");
      table.innerHTML = "<tr><th>📉 Symbol</th><th>🔽 Change (%)</th></tr>";
      data.slice(0, 10).forEach(item => {
        table.innerHTML += `<tr><td>${item.symbol}</td><td class="loss">${item.percentageChange}%</td></tr>`;
      });
    })
    .catch(() => {
      console.error("⚠️ Error fetching top losers.");
    });
}

function fetchNepseIndex() {
  fetch("https://nss-c26z.onrender.com/Summary")
    .then(res => res.json())
    .then(data => {
      const ctx = document.getElementById("indexChart").getContext("2d");
      new Chart(ctx, {
        type: "line",
        data: {
          labels: Object.keys(data),
          datasets: [{
            label: "📊 NEPSE Index Summary (daily)",
            data: Object.values(data).map(Number),
            fill: false,
            borderColor: "#00b4d8",
            tension: 0.1
          }]
        }
      });
    })
    .catch(() => {
      console.error("⚠️ Error fetching NEPSE index data.");
    });
}

function initCredits() {
  const credits = parseInt(localStorage.getItem('credits') || '2000');
  updateCreditDisplay();

  // Add credits button functionality
  const addCreditsBtn = document.querySelector('.add-credits-btn');
  addCreditsBtn.addEventListener('click', () => {
    document.getElementById('creditsSection').style.display = 'block';
  });

  // Update weekly spin to be available any day
  const weeklySpin = document.getElementById('weeklySpin');
  weeklySpin.addEventListener('click', () => {
    const lastSpin = localStorage.getItem('lastSpin');
    const now = new Date();
    const canSpin = !lastSpin || (now - new Date(lastSpin)) >= 24 * 60 * 60 * 1000;

    if (canSpin) {
      const prizes = [0, 100, 200, 500, 1000, 2000, 5000];
      const prize = prizes[Math.floor(Math.random() * prizes.length)];
      
      const currentCredits = parseInt(localStorage.getItem('credits') || '2000');
      localStorage.setItem('credits', (currentCredits + prize).toString());
      localStorage.setItem('lastSpin', now.toString());
      
      updateCreditDisplay();
      alert(`Congratulations! You won ${prize} credits!`);
    } else {
      alert('You can spin again in 24 hours!');
    }
  });

  // Initialize last bonus claim date if not exists
  if (!localStorage.getItem('lastBonusClaim')) {
    localStorage.setItem('lastBonusClaim', new Date().toISOString());
  }

  // Initialize last spin date if not exists
  if (!localStorage.getItem('lastSpinDate')) {
    localStorage.setItem('lastSpinDate', new Date().toISOString());
  }

  // Initialize ad watch count if not exists
  if (!localStorage.getItem('adWatchCount')) {
    localStorage.setItem('adWatchCount', '0');
  }

  updateBonusStatus();
  updateSpinStatus();
}

function updateCreditDisplay() {
  const credits = localStorage.getItem('credits');
  document.getElementById('creditBalance').textContent = credits;
}

function updateBonusStatus() {
  const lastClaim = new Date(localStorage.getItem('lastBonusClaim'));
  const now = new Date();
  const dailyBonusStatus = document.getElementById('dailyBonusStatus');
  
  // Check if 24 hours have passed since last claim
  if (now - lastClaim >= 24 * 60 * 60 * 1000) {
    dailyBonusStatus.textContent = '🎁 Daily bonus available!';
    dailyBonusStatus.style.color = 'var(--gain-color)';
  } else {
    const hoursLeft = Math.ceil((24 - (now - lastClaim) / (60 * 60 * 1000)));
    dailyBonusStatus.textContent = `⏳ Next bonus in ${hoursLeft}h`;
    dailyBonusStatus.style.color = 'var(--text-color)';
  }
}

function updateSpinStatus() {
  const lastSpin = new Date(localStorage.getItem('lastSpinDate'));
  const now = new Date();
  const weeklySpinStatus = document.getElementById('weeklySpinStatus');
  
  // Check if it's weekend and spin hasn't been used this week
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isNewWeek = now - lastSpin >= 7 * 24 * 60 * 60 * 1000;
  
  if (isWeekend && isNewWeek) {
    weeklySpinStatus.textContent = '🎰 Weekly spin available!';
    weeklySpinStatus.style.color = 'var(--gain-color)';
  } else {
    weeklySpinStatus.textContent = '⏳ Next spin on weekend';
    weeklySpinStatus.style.color = 'var(--text-color)';
  }
}

function claimDailyBonus() {
  const lastClaim = new Date(localStorage.getItem('lastBonusClaim'));
  const now = new Date();
  
  if (now - lastClaim >= 24 * 60 * 60 * 1000) {
    const currentCredits = parseInt(localStorage.getItem('credits'));
    localStorage.setItem('credits', (currentCredits + 500).toString());
    localStorage.setItem('lastBonusClaim', now.toISOString());
    
    updateCreditDisplay();
    updateBonusStatus();
    alert('🎉 Daily bonus claimed! +500 credits');
  } else {
    alert('⏳ Please wait 24 hours before claiming your next bonus');
  }
}

function watchAd() {
  // Simulate ad watching
  const adButton = document.getElementById('watchAd');
  adButton.disabled = true;
  adButton.textContent = 'Watching ad...';
  
  setTimeout(() => {
    const currentCredits = parseInt(localStorage.getItem('credits'));
    localStorage.setItem('credits', (currentCredits + 500).toString());
    
    const adCount = parseInt(localStorage.getItem('adWatchCount')) + 1;
    localStorage.setItem('adWatchCount', adCount.toString());
    
    updateCreditDisplay();
    adButton.disabled = false;
    adButton.textContent = 'Watch Ad';
    alert('🎉 Ad watched! +500 credits');
  }, 5000); // Simulate 5-second ad
}

function weeklySpin() {
  const lastSpin = new Date(localStorage.getItem('lastSpinDate'));
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const isNewWeek = now - lastSpin >= 7 * 24 * 60 * 60 * 1000;
  
  if (!isWeekend) {
    alert('🎰 Weekly spin is only available on weekends!');
    return;
  }
  
  if (!isNewWeek) {
    alert('⏳ You can only spin once per week!');
    return;
  }
  
  const spinButton = document.getElementById('weeklySpin');
  spinButton.disabled = true;
  spinButton.classList.add('spinning');
  
  setTimeout(() => {
    const prizes = [0, 100, 200, 500, 1000, 2000, 5000];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    
    const currentCredits = parseInt(localStorage.getItem('credits'));
    localStorage.setItem('credits', (currentCredits + prize).toString());
    localStorage.setItem('lastSpinDate', now.toISOString());
    
    updateCreditDisplay();
    updateSpinStatus();
    spinButton.disabled = false;
    spinButton.classList.remove('spinning');
    
    if (prize > 0) {
      alert(`🎉 Congratulations! You won ${prize} credits!`);
    } else {
      alert('😢 Better luck next time!');
    }
  }, 2000);
}

function loadAllStocks() {
  fetch("https://nss-c26z.onrender.com/AllStocks")
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("allStocksTable").getElementsByTagName('tbody')[0];
      table.innerHTML = "";
      data.forEach(stock => {
        const changeClass = parseFloat(stock.changePercent) >= 0 ? "gain" : "loss";
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stock.symbol}</td>
          <td>${stock.price}</td>
          <td class="${changeClass}">${stock.changePercent}%</td>
        `;
        table.appendChild(row);
      });
    })
    .catch(() => {
      console.error("⚠️ Error loading all stocks.");
    });
}

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.classList.toggle('dark-mode', savedTheme === 'dark');
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.checked = savedTheme === 'dark';
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.checked = isDark;
  }
}

// Settings Management
function initSettings() {
  // Load saved settings from localStorage
  const settings = JSON.parse(localStorage.getItem('settings')) || {
    darkMode: false,
    fontSize: 'medium'
  };

  // Apply saved settings
  applySettings(settings);

  // Add event listeners
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      toggleTheme();
      // Update settings
      const settings = JSON.parse(localStorage.getItem('settings')) || {};
      settings.darkMode = themeToggle.checked;
      localStorage.setItem('settings', JSON.stringify(settings));
    });
  }

  const fontSize = document.getElementById('fontSize');
  if (fontSize) {
    fontSize.addEventListener('change', () => {
      const size = fontSize.value;
      document.documentElement.style.fontSize = getFontSizeValue(size);
      // Update settings
      const settings = JSON.parse(localStorage.getItem('settings')) || {};
      settings.fontSize = size;
      localStorage.setItem('settings', JSON.stringify(settings));
    });
  }
}

function applySettings(settings) {
  // Apply dark mode
  document.body.classList.toggle('dark-mode', settings.darkMode);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.checked = settings.darkMode;
  }

  // Apply font size
  const fontSize = document.getElementById('fontSize');
  if (fontSize) {
    document.documentElement.style.fontSize = getFontSizeValue(settings.fontSize);
    fontSize.value = settings.fontSize;
  }
}

function getFontSizeValue(size) {
  switch (size) {
    case 'small': return '14px';
    case 'medium': return '16px';
    case 'large': return '18px';
    default: return '16px';
  }
}

function exportData() {
  const data = {
    investments: JSON.parse(localStorage.getItem('investments')) || [],
    settings: JSON.parse(localStorage.getItem('settings')) || {}
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nepalstock-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (data.investments) {
            localStorage.setItem('investments', JSON.stringify(data.investments));
          }
          
          if (data.settings) {
            localStorage.setItem('settings', JSON.stringify(data.settings));
            applySettings(data.settings);
          }
          
          alert('Data imported successfully!');
          location.reload();
        } catch (error) {
          alert('Error importing data: Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };
  
  input.click();
}

function resetData() {
  if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
    localStorage.removeItem('investments');
    localStorage.removeItem('settings');
    location.reload();
  }
}

// Trade Simulation
document.getElementById("tradeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const symbol = document.getElementById("symbol").value.toUpperCase();
  const amount = parseFloat(document.getElementById("amount").value);
  let credits = parseFloat(localStorage.getItem("credits")) || 0;

  if (!symbol || isNaN(amount) || amount <= 0) {
    document.getElementById("tradeResult").textContent = "❌ Invalid symbol or amount!";
    return;
  }

  fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${symbol}`)
    .then(res => res.json())
    .then(data => {
      console.log("Trade form API response:", data);

      if (data.error) {
        document.getElementById("tradeResult").textContent = "❌ Invalid symbol or server error!";
        return;
      }

      const price = parseFloat(data.price);
      if (isNaN(price) || price <= 0) {
        document.getElementById("tradeResult").textContent = "❌ Invalid price!";
        return;
      }

      const quantity = amount / price;

      if (amount > credits) {
        document.getElementById("tradeResult").textContent = "❌ Not enough credits!";
        return;
      }

      credits -= amount;
      localStorage.setItem("credits", credits.toString());
      updateCreditDisplay();

      // Store investment data with proper numeric values
      const investment = { 
        symbol, 
        amount: amount.toString(),
        price: price.toString(),
        quantity: quantity.toString(),
        date: new Date().toLocaleDateString() 
      };
      
      console.log("Storing investment:", investment);
      
      const investments = JSON.parse(localStorage.getItem("investments")) || [];
      investments.push(investment);
      localStorage.setItem("investments", JSON.stringify(investments));

      document.getElementById("tradeResult").textContent = `✅ Invested ${amount} credits in ${symbol}!`;
    })
    .catch(() => {
      document.getElementById("tradeResult").textContent = "❌ Invalid symbol or server error!";
    });
});

// Login functionality
function initAuth() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const showSignup = document.getElementById('showSignup');
  const showLogin = document.getElementById('showLogin');
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');
  const userProfile = document.getElementById('userProfile');
  const loginBtn = document.getElementById('loginBtn');

  // Check if user is already logged in
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (currentUser) {
    updateUserProfile(currentUser);
  }

  // Login form submission
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (users[username] && users[username].password === password) {
      localStorage.setItem('currentUser', JSON.stringify(users[username]));
      updateUserProfile(users[username]);
      loginModal.style.display = 'none';
    } else {
      alert('Invalid username or password');
    }
  });

  // Signup form submission
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Get existing users
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (users[username]) {
      alert('Username already exists');
      return;
    }

    // Create new user
    users[username] = {
      username,
      email,
      password,
      profilePicture: 'default-avatar.png',
      credits: 2000,
      investments: []
    };

    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('currentUser', JSON.stringify(users[username]));
    updateUserProfile(users[username]);
    signupModal.style.display = 'none';
  });

  // Logout functionality
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    userProfile.style.display = 'none';
    loginBtn.style.display = 'block';
  });

  // Modal navigation
  showSignup.addEventListener('click', () => {
    loginModal.style.display = 'none';
    signupModal.style.display = 'block';
  });

  showLogin.addEventListener('click', () => {
    signupModal.style.display = 'none';
    loginModal.style.display = 'block';
  });
}

function updateUserProfile(user) {
  const userProfile = document.getElementById('userProfile');
  const loginBtn = document.getElementById('loginBtn');
  const profilePicture = document.getElementById('profilePicture');
  const usernameDisplay = document.getElementById('username');

  userProfile.style.display = 'flex';
  loginBtn.style.display = 'none';
  profilePicture.src = user.profilePicture;
  usernameDisplay.textContent = user.username;
}

// Update portfolio calculations
async function updatePortfolio() {
  const investments = JSON.parse(localStorage.getItem("investments")) || [];
  const tableBody = document.getElementById("investmentHistory").getElementsByTagName('tbody')[0];
  tableBody.innerHTML = "";

  // Calculate total invested and current value
  let totalInvested = 0;
  let totalCurrentValue = 0;

  for (const investment of investments) {
    try {
      const response = await fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${investment.symbol}`);
      const data = await response.json();
      
      if (data.error) {
        console.error("Error fetching price for", investment.symbol, ":", data.error);
        continue;
      }

      // Parse all values to ensure they're numbers
      const buyPrice = parseFloat(investment.price);
      const currentPrice = parseFloat(data.price);
      const creditsInvested = parseFloat(investment.amount);
      const quantity = creditsInvested / buyPrice;
      const creditsNow = quantity * currentPrice;
      const profitLossAmount = creditsNow - creditsInvested;
      const profitLossPercent = (profitLossAmount / creditsInvested) * 100;
      
      // Update totals
      totalInvested += creditsInvested;
      totalCurrentValue += creditsNow;

      // Create table row
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${investment.symbol}</td>
        <td>${buyPrice.toFixed(2)}</td>
        <td>${currentPrice.toFixed(2)}</td>
        <td>${creditsInvested.toFixed(2)}</td>
        <td>${creditsNow.toFixed(2)}</td>
        <td>${quantity.toFixed(4)}</td>
        <td class="${profitLossAmount >= 0 ? 'gain' : 'loss'}">${profitLossAmount >= 0 ? '+' : ''}${profitLossAmount.toFixed(2)}</td>
        <td class="${profitLossAmount >= 0 ? 'gain' : 'loss'}">${profitLossPercent.toFixed(2)}%</td>
        <td><button onclick="sellInvestment(${investments.indexOf(investment)})">💸 Sell</button></td>
      `;
      tableBody.appendChild(row);

    } catch (error) {
      console.error("Error processing investment:", error);
    }
  }

  // Update summary section
  document.getElementById("totalInvested").textContent = totalInvested.toFixed(2);
  document.getElementById("currentValue").textContent = totalCurrentValue.toFixed(2);
  const totalProfitLoss = totalCurrentValue - totalInvested;
  const totalProfitLossPercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;
  document.getElementById("totalPnL").textContent = 
    `${totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(2)} (${totalProfitLossPercent.toFixed(2)}%)`;
}

function sellInvestment(index) {
  const investments = JSON.parse(localStorage.getItem("investments")) || [];
  const inv = investments[index];

  fetch(`https://nss-c26z.onrender.com/StockPrice?symbol=${inv.symbol}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert("❌ Error fetching current price. Please try again.");
        return;
      }

      const currentPrice = parseFloat(data.price);
      const quantity = parseFloat(inv.quantity);
      const sellAmount = quantity * currentPrice;
      
      let credits = parseFloat(localStorage.getItem("credits")) || 0;
      credits += sellAmount;
      localStorage.setItem("credits", credits.toString());
      updateCreditDisplay();

      investments.splice(index, 1);
      localStorage.setItem("investments", JSON.stringify(investments));
      updatePortfolio();
      alert(`✅ Sold ${inv.symbol} for ${sellAmount.toFixed(2)} credits!`);
    })
    .catch(() => {
      alert("❌ Could not complete sale. Please try again.");
    });
}
