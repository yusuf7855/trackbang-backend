const mongoose = require('mongoose');

const hotSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  musics: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Music' 
  }],
  category: {
    type: String,
    enum: ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse', 'all'],
    default: 'all'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
hotSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

// Index for better performance
hotSchema.index({ isActive: 1, order: 1 });
hotSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('Hot', hotSchema);