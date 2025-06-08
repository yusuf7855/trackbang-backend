// models/Music.js - Basit çoklu sanatçı sistemi
const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  spotifyId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  
  // Çoklu sanatçı desteği - string array olarak
  artists: [{ 
    type: String,
    required: true,
    trim: true
  }],
  
  // Eski tek sanatçı field'i (backward compatibility için)
  artist: { 
    type: String, 
    default: ''
  },
  
  beatportUrl: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  likes: { 
    type: Number, 
    default: 0 
  },
  userLikes: [{ 
    type: String 
  }], 
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Sanatçıları otomatik olarak tek string'e çevir (backward compatibility)
musicSchema.pre('save', function(next) {
  if (this.artists && this.artists.length > 0) {
    this.artist = this.artists.join(', ');
  }
  next();
});

// Text search index - hem tek sanatçı hem çoklu sanatçılar için
musicSchema.index({ 
  title: 'text', 
  artist: 'text',
  'artists': 'text'
});

module.exports = mongoose.model('Music', musicSchema);