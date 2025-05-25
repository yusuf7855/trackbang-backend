const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['paid', 'free', 'pending'], 
    default: 'free' 
  },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sample', sampleSchema);