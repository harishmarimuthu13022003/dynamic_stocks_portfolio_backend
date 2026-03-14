const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');
const { fetchStockData } = require('../services/financeService');

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

// Get live prices for all holdings
router.get('/prices', async (req, res) => {
  try {
    const stocks = await Stock.find({});
    const pricePromises = stocks.map(async (stock) => {
      const financeData = await fetchStockData(stock.symbol, stock.exchange);
      return {
        symbol: stock.symbol,
        ...financeData
      };
    });

    const prices = await Promise.all(pricePromises);
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed data
router.post('/seed', async (req, res) => {
  const initialStocks = [
    { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', purchasePrice: 1490, quantity: 50, sector: 'Financials', exchange: 'NSE' },
    { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', purchasePrice: 6466, quantity: 15, sector: 'Financials', exchange: 'NSE' },
    { symbol: '532174.BO', name: 'ICICI Bank', purchasePrice: 780, quantity: 84, sector: 'Financials', exchange: 'BSE' },
    { symbol: '544252.BO', name: 'Bajaj Housing', purchasePrice: 130, quantity: 504, sector: 'Financials', exchange: 'BSE' },
    { symbol: '511577.BO', name: 'Savani Financials', purchasePrice: 24, quantity: 1080, sector: 'Financials', exchange: 'BSE' },
    { symbol: 'RELIANCE.NS', name: 'Reliance Industries', purchasePrice: 2450.50, quantity: 10, sector: 'Energy', exchange: 'NSE' },
    { symbol: 'TCS.NS', name: 'Tata Consultancy Services', purchasePrice: 3200.00, quantity: 5, sector: 'Technology', exchange: 'NSE' },
    { symbol: 'INFY.NS', name: 'Infosys', purchasePrice: 1450.00, quantity: 20, sector: 'Technology', exchange: 'NSE' }
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
