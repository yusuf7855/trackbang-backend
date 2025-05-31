const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: function() { 
      // Sadece kullanıcı playlist'leri için zorunlu
      return !this.isAdminPlaylist; 
    }
  },
  musics: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Music' 
  }],
  
  // ADMIN PLAYLIST ALANLARı
  isAdminPlaylist: {
    type: Boolean,
    default: false
  },
  
  // GENRE - Hem admin hem user playlist'ler için tek alan
  genre: {
    type: String,
    enum: ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'],
    required: true // Artık hem admin hem user için zorunlu
  },
  
  // Alt kategori/Katalog numarası (sadece admin playlist'leri için - AH1, MH1, vb.)
  subCategory: {
    type: String,
    uppercase: true,
    trim: true,
    required: function() { return this.isAdminPlaylist; }
  },
  
  isPublic: {
    type: Boolean,
    default: function() { 
      return this.isAdminPlaylist ? true : false; // Admin playlist'ler otomatik public
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Arama için index ekleme
playlistSchema.index({
  name: 'text',
  description: 'text'
}, {
  name: 'playlist_search_index',
  weights: {
    name: 3,
    description: 1
  },
  collation: {
    locale: 'en',
    strength: 2 // Case insensitive
  }
});

// Admin playlist'ler için genre ve sub category kombinasyonu unique olmalı
playlistSchema.index({ 
  genre: 1, 
  subCategory: 1 
}, { 
  unique: true,
  partialFilterExpression: { isAdminPlaylist: true }
});

// Playlist türüne göre genre index
playlistSchema.index({ genre: 1, isPublic: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);