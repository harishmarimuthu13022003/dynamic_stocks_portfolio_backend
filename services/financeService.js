// scraper logic is now handled by the Python script to avoid header overflow issues

/**
 * Fetches stock data (CMP from Yahoo, P/E and Earnings from Google) 
 * @param {string} symbol - Stock symbol (e.g., 'HDFCBANK.NS' for Yahoo)
 * @param {string} exchange - 'NSE' or 'BSE'
 */
const { exec } = require('child_process');
const path = require('path');

/**
 * Fetches stock data using a Python scraper for robustness
 * @param {string} symbol - Stock symbol (e.g., 'HDFCBANK.NS' for Yahoo)
 * @param {string} exchange - 'NSE' or 'BSE'
 */
async function fetchStockData(symbol, exchange) {
  return new Promise((resolve, reject) => {
    // Run the Python scraper script
    const scraperPath = path.join(__dirname, 'scraper.py');
    const pythonCmd = process.env.PYTHON_PATH || 'python';
    
    exec(`${pythonCmd} "${scraperPath}" "${symbol}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Scraper error for ${symbol}:`, stderr || error.message);
        // Fallback to empty data on error
        return resolve({ cmp: null, peRatio: 'N/A', latestEarnings: 'N/A' });
      }

      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (parseError) {
        console.error(`Failed to parse scraper output for ${symbol}:`, stdout);
        resolve({ cmp: null, peRatio: 'N/A', latestEarnings: 'N/A' });
      }
    });
  });
}

module.exports = { fetchStockData };
