// app.js - MongoDB Bağlantı Düzeltmesi

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

// Routes
const authRoutes = require('./routes/authRoutes');
const musicRoutes = require('./routes/musicRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
const hotRoutes = require('./routes/hotRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const storeRoutes = require('./routes/storeRoutes');

// API Routes - DÜZELTİLMİŞ SIRALAMA
app.use('/api/store', storeRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', authRoutes);
app.use('/api/samples', sampleRoutes);

// ============ MONGODB BAĞLANTI DÜZELTMESİ ============

async function connectToMongoDB() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable not found!');
    }
    
    const safeUri = process.env.MONGO_URI.replace(/\/\/.*@/, '//***:***@');
    console.log('📍 MongoDB URI:', safeUri);
    
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      heartbeatFrequencyMS: 10000,
      family: 4
    };
    
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    
    console.log('✅ MongoDB connection successful!');
    console.log('📊 Database:', mongoose.connection.name || 'default');
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('📍 Port:', mongoose.connection.port);
    
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    if (error.code === 'ETIMEDOUT') {
      console.error('🔧 Troubleshooting suggestions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify MongoDB Atlas IP whitelist');
      console.error('   3. Check firewall settings');
      console.error('   4. Try disabling VPN if using one');
    }
    
    if (error.message.includes('authentication failed')) {
      console.error('🔧 Authentication error!');
      console.error('   Check username/password in MONGO_URI');
    }
    
    throw error;
  }
}

// Connection event listeners
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📴 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Uygulama kapatılıyor...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB bağlantısı kapatıldı');
    process.exit(0);
  } catch (error) {
    console.error('❌ Kapatma hatası:', error);
    process.exit(1);
  }
});

async function startServer() {
  try {

    await connectToMongoDB();
    
    // 2. Server'ı başlat
    const PORT = process.env.PORT || 5000;
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('🎉 ==========================================');
      console.log(`✅ Server başarıyla başlatıldı!`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`📍 Network: http://192.168.1.106:${PORT}`);
      console.log(`🧪 Health: http://localhost:${PORT}/api/store/health`);
      console.log(`🏪 Store: http://localhost:${PORT}/api/store/listings`);
      console.log('🎉 ==========================================');
    });

    // Server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} zaten kullanımda!`);
        console.error('💡 Farklı bir port deneyin veya kullanımdaki uygulamayı kapatın');
      } else {
        console.error('❌ Server hatası:', error);
      }
      process.exit(1);
    });

    return server;
    
  } catch (error) {
    console.error('❌ Server başlatma hatası:', error);
    console.error('🔧 Lütfen aşağıdakileri kontrol edin:');
    console.error('   - .env dosyası var mı ve doğru mu?');
    console.error('   - MongoDB Atlas erişilebilir mi?');
    console.error('   - İnternet bağlantınız var mı?');
    process.exit(1);
  }
}

// Error handlers
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((error, req, res, next) => {
  console.error('🚨 Global Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start the server
startServer();

module.exports = app;