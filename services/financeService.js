const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// Increase maxHeaderSize for axios and bypass TLS verification for robustness
const agent = new https.Agent({  
  rejectUnauthorized: false
});

/**
 * Fetches stock data using axios and cheerio for scraping Google Finance and Yahoo Finance
 * @param {string} symbol - Stock symbol (e.g., 'HDFCBANK.NS' for Yahoo)
 * @param {string} exchange - 'NSE' or 'BSE'
 */
async function fetchStockData(symbol, exchange) {
  const result = {
    cmp: null,
    peRatio: 'N/A',
    latestEarnings: 'N/A'
  };

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // 1. Fetch CMP from Yahoo Finance
  try {
    const yahooUrl = `https://finance.yahoo.com/quote/${symbol}`;
    const response = await axios.get(yahooUrl, { 
      headers, 
      timeout: 10000,
      httpsAgent: agent,
      maxRedirects: 5,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract Price from Yahoo
    let priceText = null;
    const streamEl = $(`fin-streamer[data-symbol="${symbol}"][data-field="regularMarketPrice"]`);
    
    if (streamEl.length > 0) {
      priceText = streamEl.attr('value') || streamEl.text().trim();
    } else {
        // Fallback selectors
        priceText = $('span[class*="yf-"]').filter((i, el) => $(el).text().includes('.')).first().text().trim() || 
                    $('fin-streamer[data-field="regularMarketPrice"]').first().text().trim();
    }
    
    if (priceText) {
      const num = parseFloat(priceText.replace(/,/g, ''));
      if (!isNaN(num)) result.cmp = num;
    }
  } catch (err) {
    console.error(`Yahoo Scrape Error for ${symbol}: ${err.message}`);
  }

  // 2. Fetch from Google Finance (Fallback for Price + Stats)
  try {
    const tickerBase = symbol.split('.')[0];
    const googleExchange = symbol.endsWith('.BO') ? 'BOM' : 'NSE'; // BSE is marked as BOM usually
    const googleTicker = `${tickerBase}:${googleExchange}`;
    
    const googleUrl = `https://www.google.com/finance/quote/${googleTicker}`;
    const gResponse = await axios.get(googleUrl, { 
      headers, 
      timeout: 10000,
      httpsAgent: agent
    });
    
    const $g = cheerio.load(gResponse.data);
    
    // Google Price (if Yahoo missed it)
    if (!result.cmp) {
      let priceText = $g('div[data-last-price]').attr('data-last-price');
      if (!priceText) {
         // Known common classes for price in Google Finance
         const fallbackClasses = ['.YMlS3', '.fx1vbd', '.YMlS7e', '.I67F9c', '.kf1YGe'];
         for (let cls of fallbackClasses) {
            const el = $g(`div${cls}`);
            if (el.length > 0) {
                priceText = el.text().trim().replace(/[₹$,]/g, '');
                break;
            }
         }
      }
      if (priceText) {
          const num = parseFloat(priceText);
          if (!isNaN(num)) result.cmp = num;
      }
    }

    // Google Stats (PE, Earnings)
    $g('.gyFHrc').each((i, el) => {
      const title = $g(el).find('.mfs7Fc').text().trim().toLowerCase();
      const val = $g(el).find('.P6K39c').text().trim();
      
      if ((title === 'p/e ratio' || title === 'pe ratio') && val) {
        result.peRatio = val;
      } else if ((title === 'earnings per share' || title === 'eps' || title === 'earnings') && val) {
        result.latestEarnings = val;
      }
    });

  } catch (err) {
    console.error(`Google Scrape Error for ${symbol}: ${err.message}`);
  }

  // Console log to see real-time updates without affecting browser network tab
  console.log(`[Node Scraper] ${symbol} -> CMP: ₹${result.cmp || 'N/A'}, PE: ${result.peRatio}, Earnings: ${result.latestEarnings}`);
  
  return result;
}

module.exports = { fetchStockData };
