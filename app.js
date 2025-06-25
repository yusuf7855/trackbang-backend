const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const musicRoutes = require('./routes/musicRoutes');
const cors = require('cors');
const playlistRoutes = require('./routes/playlistRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
const hotRoutes = require('./routes/hotRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes'); // YENİ: Notification routes

dotenv.config();

const app = express();

// ============ CRUCIAL MIDDLEWARE ADDITIONS ============
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
// ======================================================

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  console.log('Request Body:', req.body); // Add this to debug
  next();
});

// Static files
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/download', downloadRoutes);
app.use('/api', sampleRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes); // YENİ: Notification routes
app.use('/api', authRoutes);

// Database connection and server start
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('MongoDB bağlantısı başarılı.');
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server ${PORT} portunda çalışıyor.`);
    });
  } catch (err) {
    console.error('MongoDB bağlantı hatası:', err);
    process.exit(1);
  }
}

startServer();