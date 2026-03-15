const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  purchasePrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  sector: { type: String, required: true },
  exchange: { type: String, enum: ['NSE', 'BSE'], default: 'NSE' },
  cmp: { type: Number, default: null },
  peRatio: { type: String, default: 'N/A' },
  latestEarnings: { type: String, default: 'N/A' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stock', stockSchema);
