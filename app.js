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

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes - sıralama önemli
app.use('/api/samples', sampleRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes); // Bu route'da admin için auth yok
app.use('/api/hot', hotRoutes);
app.use('/api/auth', authRoutes); // Auth route'ları en sonda

// Static files
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

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