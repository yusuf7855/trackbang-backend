const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 10 // 10 Euro
  },
  currency: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD', 'TRY']
  },
  paymentMethod: {
    type: String,
    enum: ['google_play', 'stripe', 'paypal'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  googlePlayToken: String, // Google Play receipt token
  subscriptionType: {
    type: String,
    default: 'monthly',
    enum: ['monthly', 'yearly']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  receiptData: Object, // Store receipt verification data
  errorMessage: String
}, {
  timestamps: true
});

// Index for performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);