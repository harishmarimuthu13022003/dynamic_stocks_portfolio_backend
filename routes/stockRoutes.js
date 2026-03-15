const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const { fetchStockData } = require('../services/financeService');

let clients = [];

// SSE endpoint to push real-time updates without showing continuous network requests in the browser
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  clients.push({ id: clientId, res });

  // Send initial data immediately
  Stock.find({}).then(stocks => {
    res.write(`data: ${JSON.stringify(stocks)}\n\n`);
  });

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

// Broadcast to all connected clients
function broadcastStocks(stocks) {
  const data = `data: ${JSON.stringify(stocks)}\n\n`;
  clients.forEach(c => c.res.write(data));
}

// Background scraping process: runs on the server to prevent browser network bloat
async function backgroundScrape() {
  try {
    const stocks = await Stock.find({});
    if (stocks.length === 0) return;
    
    console.log(`\n--- Starting Background Scrape for ${stocks.length} stocks ---`);
    for (let stock of stocks) {
      try {
        const financeData = await fetchStockData(stock.symbol, stock.exchange);
        
        // Update DB
        await Stock.findOneAndUpdate(
          { symbol: stock.symbol },
          { 
            cmp: financeData.cmp !== null ? financeData.cmp : stock.cmp, 
            peRatio: (financeData.peRatio && financeData.peRatio !== 'N/A') ? financeData.peRatio : stock.peRatio, 
            latestEarnings: (financeData.latestEarnings && financeData.latestEarnings !== 'N/A') ? financeData.latestEarnings : stock.latestEarnings 
          }
        );
      } catch (err) {
        console.error(`Error in background scrape for ${stock.symbol}:`, err.message);
      }
    }
    console.log(`--- Finished Scrape ---`);
    
    // Fetch updated data and broadcast
    const updatedStocks = await Stock.find({});
    broadcastStocks(updatedStocks);
    
  } catch (err) {
    console.error("Background scrape general error:", err.message);
  }
}

// Run first scrape immediately, then every 30 seconds
setTimeout(backgroundScrape, 2000);
setInterval(backgroundScrape, 30000);


// Get all stocks
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find({});
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a stock
router.post('/', async (req, res) => {
  try {
    const newStock = new Stock(req.body);
    await newStock.save();
    res.status(201).json(newStock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Keep getting live prices via traditional request if needed manually
router.get('/prices', async (req, res) => {
  try {
    const stocks = await Stock.find({});
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed data
router.post('/seed', async (req, res) => {
  const initialStocks = [
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', purchasePrice: 1490, quantity: 50, sector: 'Financials', exchange: 'NSE', cmp: 1650, peRatio: '18.5', latestEarnings: '₹52.4' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', purchasePrice: 6466, quantity: 15, sector: 'Financials', exchange: 'NSE', cmp: 7200, peRatio: '32.1', latestEarnings: '₹210' },
    { symbol: '532174.BO', name: 'ICICI Bank', purchasePrice: 780, quantity: 84, sector: 'Financials', exchange: 'BSE', cmp: 1100, peRatio: '17.2', latestEarnings: '₹48.9' },
    { symbol: '544252.BO', name: 'Bajaj Housing', purchasePrice: 130, quantity: 504, sector: 'Financials', exchange: 'BSE', cmp: 165, peRatio: 'N/A', latestEarnings: 'N/A' },
    { symbol: '511577.BO', name: 'Savani Financials', purchasePrice: 24, quantity: 1080, sector: 'Financials', exchange: 'BSE', cmp: 32, peRatio: 'N/A', latestEarnings: 'N/A' },
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', purchasePrice: 2450.50, quantity: 10, sector: 'Energy', exchange: 'NSE', cmp: 1280, peRatio: '24.5', latestEarnings: '₹68.2' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services', purchasePrice: 3200.00, quantity: 5, sector: 'Technology', exchange: 'NSE', cmp: 4100, peRatio: '28.9', latestEarnings: '₹124.5' },
    { symbol: 'INFY.NS', name: 'Infosys', purchasePrice: 1450.00, quantity: 20, sector: 'Technology', exchange: 'NSE', cmp: 1620, peRatio: '22.1', latestEarnings: '₹62.3' }
  ];

  try {
    await Stock.deleteMany({});
    const created = await Stock.insertMany(initialStocks);
    res.json({ message: 'Seeded successfully', count: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
