// app.js - PRODUCTION SERVER VERSİYONU - trackbangserver.com.tr için optimize edilmiş

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();

// Global değişkenler
let server;
let isStarting = false;
let isStarted = false;

// Production/Development ortam tespiti
const isProduction =  'production';
const isDevelopment = !isProduction;

console.log('🚀 Server başlatılıyor...');
console.log(`🌍 Ortam: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

// ============ MIDDLEWARE SIRALAMA ÖNEMLİ! ============

// 1. CORS ayarları (EN ÖNCE)
const corsOptions = {
  origin: isProduction ? [
    'https://trackbangserver.com.tr',
    'https://www.trackbangserver.com.tr',
    'https://trackbang.com',
    'https://www.trackbang.com'
  ] : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

// 2. Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 3. Trust proxy (NGINX/Apache proxy için gerekli)
if (isProduction) {
  app.set('trust proxy', 1);
}

// ============ STATİK DOSYA SUNUMU (ROUTES'TAN ÖNCE!) ============

// Uploads klasörü yollarını ayarla
const uploadsPath = path.join(__dirname, 'uploads');
const assetsPath = path.join(__dirname, 'assets');

console.log('📁 Uploads klasörü:', uploadsPath);
console.log('📁 Assets klasörü:', assetsPath);

// Klasörlerin varlığını kontrol et ve oluştur
if (!fs.existsSync(uploadsPath)) {
  console.log('📁 Uploads klasörü oluşturuluyor...');
  fs.mkdirSync(uploadsPath, { recursive: true });
}

if (!fs.existsSync(path.join(uploadsPath, 'store-listings'))) {
  console.log('📁 store-listings klasörü oluşturuluyor...');
  fs.mkdirSync(path.join(uploadsPath, 'store-listings'), { recursive: true });
}

// STATİK DOSYA MIDDLEWARE'LERİ - ROUTE'LARDAN ÖNCE OLMALI!
app.use('/uploads', express.static(uploadsPath, {
  maxAge: isProduction ? '7d' : '1h', // Production'da daha uzun cache
  etag: true,
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', isProduction ? 'public, max-age=604800' : 'public, max-age=3600');
    
    // Content-Type'ı dosya uzantısına göre ayarla
    const ext = path.toLowerCase();
    if (ext.includes('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (ext.includes('.jpg') || ext.includes('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext.includes('.png')) {
      res.setHeader('Content-Type', 'image/png');
    }
  }
}));

app.use('/assets', express.static(assetsPath, {
  maxAge: isProduction ? '7d' : '1h',
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', isProduction ? 'public, max-age=604800' : 'public, max-age=3600');
  }
}));

// ============ DEBUG ROUTES (DEVELOPMENT ORTAMINDA) ============

// Root endpoint - HTML Dashboard
app.get('/', (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const statusTexts = {
    0: 'Disconnected',
    1: 'Connected', 
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  const mongoStatusText = statusTexts[mongoStatus] || 'Unknown';
  const isConnected = mongoStatus === 1;
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMinutes = Math.floor((uptime % 3600) / 60);
  const uptimeSeconds = Math.floor(uptime % 60);
  
  const memory = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memory.rss / 1024 / 1024),
    heapTotal: Math.round(memory.heapTotal / 1024 / 1024), 
    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    external: Math.round(memory.external / 1024 / 1024)
  };

  // Production'da basit response, development'ta detaylı dashboard
  if (isProduction) {
    res.json({
      status: 'online',
      service: 'Trackbang API Server',
      version: '1.0.0',
      environment: 'production',
      mongodb: mongoStatusText,
      uptime: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Development dashboard (eski HTML kodu)
  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trackbang API Server Dashboard - Development</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #000000;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            overflow: hidden;
            border: 2px solid #333333;
        }
        
        .header {
            background: #000000;
            color: white;
            padding: 30px;
            text-align: center;
            border-bottom: 3px solid #333333;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .content {
            padding: 30px;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .status-card {
            background: #f8f8f8;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            border: 2px solid #000000;
            transition: transform 0.3s ease;
        }
        
        .status-card:hover {
            transform: translateY(-5px);
            background: #ffffff;
        }
        
        .status-card.mongodb {
            border-color: ${isConnected ? '#000000' : '#666666'};
            background: ${isConnected ? '#ffffff' : '#f0f0f0'};
        }
        
        .card-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #000000;
        }
        
        .status-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #cccccc;
        }
        
        .status-label {
            color: #666666;
            font-weight: 500;
        }
        
        .status-value {
            font-weight: 600;
            color: #000000;
        }
        
        .status-connected {
            color: #000000;
            font-weight: bold;
            background: #ffffff;
            padding: 4px 8px;
            border-radius: 5px;
            border: 1px solid #000000;
        }
        
        .status-disconnected {
            color: #ffffff;
            font-weight: bold;
            background: #000000;
            padding: 4px 8px;
            border-radius: 5px;
        }
        
        .env-badge {
            background: #ff6b35;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Trackbang API Server</h1>
            <p>Development Dashboard</p>
            <div class="env-badge">DEVELOPMENT MODE</div>
        </div>
        
        <div class="content">
            <div class="status-grid">
                <div class="status-card mongodb">
                    <div class="card-title">📊 MongoDB Bağlantısı</div>
                    <div class="status-item">
                        <span class="status-label">Durum:</span>
                        <span class="status-value ${isConnected ? 'status-connected' : 'status-disconnected'}">
                            ${mongoStatusText}
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Veritabanı:</span>
                        <span class="status-value">${mongoose.connection.name || 'test'}</span>
                    </div>
                </div>
                
                <div class="status-card system">
                    <div class="card-title">⚡ Sistem Durumu</div>
                    <div class="status-item">
                        <span class="status-label">Çalışma Süresi:</span>
                        <span class="status-value">${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Node.js:</span>
                        <span class="status-value">${process.version}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Port:</span>
                        <span class="status-value">${PORT}</span>
                    </div>
                </div>
                
                <div class="status-card memory">
                    <div class="card-title">💾 Bellek Kullanımı</div>
                    <div class="status-item">
                        <span class="status-label">RSS:</span>
                        <span class="status-value">${memoryMB.rss} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Heap Used:</span>
                        <span class="status-value">${memoryMB.heapUsed} MB</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

  res.send(html);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: isProduction ? 'production' : 'development',
    memory: process.memoryUsage(),
    mongodb: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.name
    }
  });
});

// Debug endpoints sadece development'ta aktif
if (isDevelopment) {
  // Uploads debug endpoints
  app.get('/debug/uploads', (req, res) => {
    try {
      const files = fs.readdirSync(uploadsPath, { withFileTypes: true });
      const storeFiles = fs.existsSync(path.join(uploadsPath, 'store-listings')) 
        ? fs.readdirSync(path.join(uploadsPath, 'store-listings'))
        : [];
      
      res.json({
        success: true,
        uploadsPath,
        totalFiles: files.length,
        storeListingsFiles: storeFiles.length,
        recentStoreFiles: storeFiles.slice(0, 10),
        sampleUrls: storeFiles.slice(0, 3).map(file => 
          `${req.protocol}://${req.get('host')}/uploads/store-listings/${file}`
        )
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message,
        uploadsPath,
        pathExists: fs.existsSync(uploadsPath)
      });
    }
  });

  // Test image serving
  app.get('/debug/test-image/:filename', (req, res) => {
    const filename = req.params.filename;
    const imagePath = path.join(uploadsPath, 'store-listings', filename);
    
    console.log('🖼️ Test image request:', {
      filename,
      imagePath,
      exists: fs.existsSync(imagePath)
    });
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
        path: imagePath,
        exists: false
      });
    }
    
    // Dosya tipini belirle
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const imageStream = fs.createReadStream(imagePath);
    imageStream.pipe(res);
    
    imageStream.on('error', (error) => {
      console.error('❌ Resim stream hatası:', error);
      res.status(500).json({ error: error.message });
    });
  });
}

// ============ ROUTES (STATİK DOSYALARDAN SONRA) ============

const authRoutes = require('./routes/authRoutes');
const musicRoutes = require('./routes/musicRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
const hotRoutes = require('./routes/hotRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const storeRoutes = require('./routes/storeRoutes');
const messageRoutes = require('./routes/messageRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

console.log('📡 API Routes yükleniyor...');

// API Routes - SIRALAMA ÖNEMLİ!
app.use('/api/payments', paymentRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', authRoutes);
app.use('/api/samples', sampleRoutes);

console.log('✅ API Routes yüklendi');

// ============ MONGODB CONNECTION ============

async function connectToMongoDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB zaten bağlı!');
      return true;
    }

    console.log('🔄 MongoDB\'ye bağlanılıyor...');
    
    const MONGO_URI =  "mongodb+srv://221118047:9KY5zsMHQRJyEwGq@cluster0.rz2m5a4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

    if (!MONGO_URI) {
      throw new Error('MONGO_URI environment variable not found!');
    }
    
    // Production için optimize edilmiş MongoDB options
    const mongooseOptions = {
      serverSelectionTimeoutMS: isProduction ? 60000 : 30000,
      connectTimeoutMS: isProduction ? 60000 : 30000,
      socketTimeoutMS: isProduction ? 45000 : 30000,
      maxPoolSize: isProduction ? 50 : 10,
      retryWrites: true,
      heartbeatFrequencyMS: isProduction ? 30000 : 10000,
      family: 4,
      bufferCommands: false,
      bufferMaxEntries: 0
    };
    
    await mongoose.connect(MONGO_URI, mongooseOptions);
    
    console.log('✅ MongoDB bağlantısı başarılı!');
    console.log('📊 Database:', mongoose.connection.name || 'default');
    
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    return false;
  }
}

// ============ ERROR HANDLING ============

// 404 handler - EN SONDA OLMALI
app.use('*', (req, res) => {
  console.log('❌ 404 - Route bulunamadı:', req.method, req.originalUrl);
  
  const response = {
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  };

  // Development'ta daha detaylı bilgi ver
  if (isDevelopment) {
    response.availableEndpoints = {
      'Home': '/',
      'Health Check': '/health',
      'API Store': '/api/store/listings',
      'API Messages': '/api/messages/health'
    };
  }

  res.status(404).json(response);
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    timestamp: new Date().toISOString(),
    error: isProduction ? 'Something went wrong' : error.message
  });
});

// ============ SERVER START ============

const PORT =  5000;

async function startServer() {
  // Çoklu başlatmayı önle
  if (isStarting || isStarted) {
    console.log('⚠️ Server zaten başlatılıyor veya çalışıyor!');
    return server;
  }

  isStarting = true;

  try {
    console.log('🚀 Server başlatılıyor...');
    
    // MongoDB bağlantısını kur
    const dbConnected = await connectToMongoDB();
    
    if (!dbConnected && isProduction) {
      throw new Error('Production ortamında MongoDB bağlantısı zorunludur!');
    }
    
    if (!dbConnected) {
      console.log('⚠️ MongoDB bağlantısı başarısız ama server başlatılıyor...');
    }
    
    // Server'ı başlat
    const bindAddress = isProduction ? '127.0.0.1' : '0.0.0.0'; // Production'da localhost, dev'de tümü
    
    server = app.listen(PORT, bindAddress, () => {
      isStarting = false;
      isStarted = true;
      
      console.log('');
      console.log('🎉 =================================');
      console.log(`🚀 SERVER ${PORT} PORTUNDA ÇALIŞIYOR!`);
      console.log(`🌍 Ortam: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      console.log(`🔗 Bind: ${bindAddress}`);
      
      if (isProduction) {
        console.log(`🌐 URL: https://trackbangserver.com.tr`);
      } else {
        console.log(`🌐 URL: http://localhost:${PORT}`);
      }
      
      console.log('🎉 =================================');
    });
    
    server.on('error', (error) => {
      isStarting = false;
      isStarted = false;
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} zaten kullanılıyor!`);
        console.error('💡 Farklı bir port deneyin: PORT=3001 node app.js');
      } else {
        console.error('❌ Server hatası:', error.message);
      }
      process.exit(1);
    });
    
    return server;
    
  } catch (error) {
    isStarting = false;
    isStarted = false;
    console.error('❌ Server başlatma hatası:', error.message);
    process.exit(1);
  }
}

// ============ GRACEFUL SHUTDOWN ============
function gracefulShutdown(signal) {
  console.log(`\n📱 ${signal} sinyali alındı, server kapatılıyor...`);
  
  // Timeout ekle - Production'da daha uzun süre ver
  const timeoutMs = isProduction ? 10000 : 5000;
  const forceExitTimeout = setTimeout(() => {
    console.log('⚠️ Zorla kapatılıyor (timeout)...');
    process.exit(1);
  }, timeoutMs);
  
  if (server && isStarted) {
    isStarted = false; // Önce flag'i değiştir
    
    server.close(async (err) => {
      if (err) {
        console.error('❌ Server kapatma hatası:', err);
      } else {
        console.log('🔐 HTTP server kapatıldı');
      }
      
      try {
        // MongoDB bağlantısını zorla kapat
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(true); // force: true
          console.log('🔐 MongoDB bağlantısı kapatıldı');
        }
      } catch (error) {
        console.error('❌ MongoDB kapatma hatası:', error.message);
      }
      
      clearTimeout(forceExitTimeout);
      console.log('✅ Server başarıyla kapatıldı');
      process.exit(0);
    });
  } else {
    clearTimeout(forceExitTimeout);
    console.log('✅ Server zaten kapalı');
    process.exit(0);
  }
}

// Signal handlers - once listener ekle
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Unhandled promise rejection
process.once('unhandledRejection', (err) => {
  console.error('💥 Unhandled Promise Rejection:', err.message);
  if (isProduction) {
    console.error('💥 Stack:', err.stack);
  }
  
  setTimeout(() => {
    if (server && isStarted) {
      server.close(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }, 1000);
});

// Uncaught exception
process.once('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message);
  if (isProduction) {
    console.error('💥 Stack:', err.stack);
  }
  
  setTimeout(() => {
    if (server && isStarted) {
      server.close(() => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }, 1000);
});

// ============ MODULE EXPORT ============
// Sadece bu dosya direkt çalıştırılırsa server'ı başlat
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };