/**
 * Regenerate the Chart Trading Game datasets.
 *
 * Run:
 *   node scripts/generate_mockdata.js
 *
 * Output:
 *   /mockdata (60 JSON files: 20 bank, 20 hydro, 20 finance)
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'mockdata');

const sectorConfigs = {
  bank: {
    symbolPrefixEn: 'SIMB',
    symbolPrefixNp: 'सिम-ब',
    sector: 'Simulated Bank',
    basePrice: 620,
    baseVolatility: 0.004,
    shockChance: 0.01,
    limitChance: 0.03,
    baseVolume: 18000
  },
  hydro: {
    symbolPrefixEn: 'SIMH',
    symbolPrefixNp: 'सिम-ह',
    sector: 'Simulated Hydro',
    basePrice: 420,
    baseVolatility: 0.012,
    shockChance: 0.03,
    limitChance: 0.08,
    baseVolume: 24000
  },
  finance: {
    symbolPrefixEn: 'SIMF',
    symbolPrefixNp: 'सिम-फ',
    sector: 'Simulated Finance',
    basePrice: 520,
    baseVolatility: 0.008,
    shockChance: 0.02,
    limitChance: 0.05,
    baseVolume: 21000
  }
};

const nepaliDigits = {
  0: '०',
  1: '१',
  2: '२',
  3: '३',
  4: '४',
  5: '५',
  6: '६',
  7: '७',
  8: '८',
  9: '९'
};

function toNepaliDigits(value) {
  return value
    .toString()
    .split('')
    .map((digit) => (nepaliDigits[digit] ? nepaliDigits[digit] : digit))
    .join('');
}

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function generateCandles(config, count) {
  const candles = [];
  let price = config.basePrice + Math.random() * config.basePrice * 0.2;
  let volatility = config.baseVolatility;
  let regime = 0;
  let regimeTimer = 0;
  let previousReturn = 0;

  for (let i = 0; i < count; i += 1) {
    if (regimeTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.4) {
        regime = 1;
        regimeTimer = 12 + Math.floor(Math.random() * 18);
      } else if (roll < 0.8) {
        regime = -1;
        regimeTimer = 10 + Math.floor(Math.random() * 16);
      } else {
        regime = 0;
        regimeTimer = 6 + Math.floor(Math.random() * 10);
      }
    }

    const drift = regime * config.baseVolatility * 1.6;
    volatility = clamp(
      volatility * 0.85 + Math.abs(previousReturn) * 0.5 + config.baseVolatility * 0.2,
      config.baseVolatility * 0.6,
      config.baseVolatility * 4
    );

    let candleReturn = drift + randomNormal() * volatility;

    if (Math.random() < config.shockChance) {
      candleReturn += randomNormal() * volatility * 6;
    }

    if (Math.random() < config.limitChance) {
      const direction = Math.random() > 0.5 ? 1 : -1;
      candleReturn = direction * (0.095 + Math.random() * 0.01);
    }

    candleReturn = clamp(candleReturn, -0.12, 0.12);

    const open = price;
    const close = Math.max(10, Math.round(open * (1 + candleReturn)));
    const wickScale = Math.abs(randomNormal()) * volatility * 2.2;
    const high = Math.round(Math.max(open, close) * (1 + wickScale));
    const low = Math.max(1, Math.round(Math.min(open, close) * (1 - wickScale)));
    const volume = Math.round(
      config.baseVolume * (1 + Math.abs(candleReturn) * 70 + volatility * 40) * (0.7 + Math.random() * 0.6)
    );

    candles.push({
      t: i + 1,
      o: Math.round(open),
      h: high,
      l: low,
      c: close,
      v: volume
    });

    price = close;
    previousReturn = candleReturn;
    regimeTimer -= 1;
  }

  return candles;
}

function generateDataset(sectorKey, index) {
  const config = sectorConfigs[sectorKey];
  const roundNumber = String(index + 1).padStart(2, '0');
  return {
    symbol_en: `${config.symbolPrefixEn}${roundNumber}`,
    symbol_np: `${config.symbolPrefixNp}${toNepaliDigits(roundNumber)}`,
    sector: config.sector,
    candles: generateCandles(config, 160)
  };
}

function writeDataset(sectorKey, index) {
  const dataset = generateDataset(sectorKey, index);
  const roundNumber = String(index + 1).padStart(2, '0');
  const filename = `${sectorKey}_round_${roundNumber}.json`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), JSON.stringify(dataset, null, 2));
}

function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  Object.keys(sectorConfigs).forEach((sectorKey) => {
    for (let i = 0; i < 20; i += 1) {
      writeDataset(sectorKey, i);
    }
  });
}

run();
