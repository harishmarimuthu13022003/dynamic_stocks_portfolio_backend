const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches stock data (CMP from Yahoo, P/E and Earnings from Google)
 * @param {string} symbol - Stock symbol (e.g., 'HDFCBANK.NS' for Yahoo)
 * @param {string} exchange - 'NSE' or 'BSE'
 */
async function fetchStockData(symbol, exchange) {
  let cmp = null;
  let peRatio = 'N/A';
  let latestEarnings = 'N/A';

  // Format tickers for both platforms
  // Yahoo: HDFCBANK.NS or 532174.BO
  // Google: HDFCBANK:NSE or 532174:BOM
  const tickerBase = symbol.split('.')[0];
  const googleTicker = exchange === 'NSE' ? `${tickerBase}:NSE` : `${tickerBase}:BOM`;
  const yahooTicker = symbol; // Keep as is (e.g., RELIANCE.NS)

  try {
    // 1. Fetch CMP from Yahoo Finance
    const yahooUrl = `https://finance.yahoo.com/quote/${yahooTicker}`;
    const yahooResponse = await axios.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });
    const $y = cheerio.load(yahooResponse.data);
    const priceElement = $y('fin-streamer[data-field="regularMarketPrice"]').first();
    const priceText = priceElement.attr('value') || priceElement.text().trim();
    if (priceText) {
      cmp = parseFloat(priceText.replace(/,/g, ''));
    }
  } catch (error) {
    console.error(`Yahoo Finance scraping error for ${symbol}:`, error.message);
  }

  try {
    // 2. Fetch P/E and Earnings from Google Finance
    const googleUrl = `https://www.google.com/finance/quote/${googleTicker}`;
    const googleResponse = await axios.get(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });
    const $g = cheerio.load(googleResponse.data);

    // Google Finance dynamic structure traversal
    $g('div').each((_i, el) => {
      const text = $g(el).text().trim();
      if (text === 'P/E ratio' || text.includes('P/E ratio')) {
        const val = $g(el).next().text().trim();
        if (val && val !== 'P/E ratio') peRatio = val;
      } else if (text === 'Earnings per share' || text === 'EPS (TTM)' || text.includes('EPS')) {
        const val = $g(el).next().text().trim();
        if (val && !val.toLowerCase().includes('earnings')) latestEarnings = val;
      }
    });

    // Final fallback: look for specific Google Finance metadata classes if text search failed
    if (peRatio === 'N/A' || latestEarnings === 'N/A') {
      $g('.P66Pgc').each((_i, el) => {
        const val = $g(el).text().trim();
        const label = $g(el).parent().find('.mfs7Fc').text().trim() || $g(el).prev().text().trim();
        if (label.toLowerCase().includes('p/e') && peRatio === 'N/A') peRatio = val;
        if (label.toLowerCase().includes('eps') && latestEarnings === 'N/A') latestEarnings = val;
      });
    }
  } catch (error) {
    console.error(`Google Finance scraping error for ${googleTicker}:`, error.message);
  }

  return { cmp, peRatio, latestEarnings };
}

module.exports = { fetchStockData };
