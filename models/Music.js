const mongoose = require('mongoose');

const musicSchema = new mongoose.Schema({
  spotifyId: { type: String, required: true, unique: true },
  title: { type: String, required: true }, // Şarkı adı eklendi
  artist: { type: String, required: true }, // Sanatçı adı eklendi
  beatportUrl: { type: String, required: true },
  category: { type: String, required: true },
  likes: { type: Number, default: 0 },
  userLikes: [{ type: String }], 
  createdAt: { type: Date, default: Date.now }
});

musicSchema.index({ title: 'text', artist: 'text' });

module.exports = mongoose.model('Music', musicSchema);