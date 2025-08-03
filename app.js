// app.js - EKSİKSİZ FULL VERSİYON - Server çoklu başlatma sorunu çözülmüş

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

console.log('🚀 Server başlatılıyor...');

// ============ MIDDLEWARE SIRALAMA ÖNEMLİ! ============

// 1. CORS ayarları (EN ÖNCE)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 2. Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  maxAge: '1d',
  etag: false,
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
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
  maxAge: '1d',
  etag: false,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// ============ DEBUG ROUTES (ÖNCE TANIMLA) ============

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

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trackbang API Server Dashboard</title>
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
        
        .status-card.system {
            border-color: #000000;
        }
        
        .status-card.memory {
            border-color: #000000;
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
        
        .status-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
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
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #000000;
            color: white;
            border: 2px solid #ffffff;
            border-radius: 50px;
            padding: 15px 25px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover {
            background: #ffffff;
            color: #000000;
            border-color: #000000;
            transform: translateY(-2px);
        }
        
        .timestamp {
            text-align: center;
            color: #666666;
            font-size: 0.9rem;
            margin-top: 20px;
            font-style: italic;
            background: #f0f0f0;
            padding: 10px;
            border-radius: 10px;
            border: 1px solid #cccccc;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .status-grid {
                grid-template-columns: 1fr;
            }
            
            .endpoints-grid {
                grid-template-columns: 1fr;
            }
            
            .container {
                margin: 10px;
            }
            
            body {
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Trackbang API Server</h1>
            <p>Sunucu Durumu ve API Yönetim Paneli</p>
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
                    <div class="status-item">
                        <span class="status-label">Ready State:</span>
                        <span class="status-value">${mongoStatus}</span>
                    </div>
                </div>
                
                <div class="status-card system">
                    <div class="card-title">⚡ Sistem Durumu</div>
                    <div class="status-item">
                        <span class="status-label">Çalışma Süresi:</span>
                        <span class="status-value">${uptimeHours}s ${uptimeMinutes}d ${uptimeSeconds}sn</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Node.js Versiyon:</span>
                        <span class="status-value">${process.version}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Port:</span>
                        <span class="status-value">${PORT}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Ortam:</span>
                        <span class="status-value">${process.env.NODE_ENV || 'development'}</span>
                    </div>
                </div>
                
                <div class="status-card memory">
                    <div class="card-title">💾 Bellek Kullanımı</div>
                    <div class="status-item">
                        <span class="status-label">RSS:</span>
                        <span class="status-value">${memoryMB.rss} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Heap Total:</span>
                        <span class="status-value">${memoryMB.heapTotal} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Heap Used:</span>
                        <span class="status-value">${memoryMB.heapUsed} MB</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">External:</span>
                        <span class="status-value">${memoryMB.external} MB</span>
                    </div>
                </div>
            </div>
            
            <div class="timestamp">
                Son Güncelleme: ${new Date().toLocaleString('tr-TR')}
            </div>
        </div>
    </div>
    
    <button class="refresh-btn" onclick="window.location.reload()">
        🔄 Yenile
    </button>
    
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
        
        // Add some interactivity
        document.querySelectorAll('.status-card').forEach(card => {
            card.addEventListener('click', () => {
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = 'translateY(-5px)';
                }, 100);
            });
        });
    </script>
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
    memory: process.memoryUsage(),
    mongodb: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: mongoose.connection.name
    }
  });
});

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

// Direct image serving test
app.get('/debug/serve-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsPath, 'store-listings', filename);
  
  console.log('📷 Direct serve request:', {
    filename: filename,
    path: imagePath
  });
  
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
    
    const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://221118047:9KY5zsMHQRJyEwGq@cluster0.rz2m5a4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

    if (!MONGO_URI) {
      throw new Error('MONGO_URI environment variable not found!');
    }
    
    // Deprecated seçenekleri kaldır
    const mongooseOptions = {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      heartbeatFrequencyMS: 10000,
      family: 4
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
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      'Home': '/',
      'Health Check': '/health',
      'Debug Uploads': '/debug/uploads',
      'Test Image': '/debug/test-image/FILENAME.webp',
      'Serve Image': '/debug/serve-image/FILENAME.webp',
      'Static Files': '/uploads/store-listings/FILENAME.webp',
      'API Store': '/api/store/listings',
      'API Messages': '/api/messages/health',
      'API Messages Send': '/api/messages/send',
      'API Messages Conversations': '/api/messages/conversations'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
  });
});

// ============ SERVER START ============

const PORT = process.env.PORT || 5000;

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
    
    if (!dbConnected) {
      console.log('⚠️ MongoDB bağlantısı başarısız ama server başlatılıyor...');
    }
    
    // Server'ı başlat
    server = app.listen(PORT, '0.0.0.0', () => {
      isStarting = false;
      isStarted = true;
      
      console.log('');
      console.log('🎉 =================================');
      console.log(`🚀 SERVER ${PORT} PORTUNDA ÇALIŞIYOR!`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
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
  
  // Timeout ekle - 5 saniye içinde zorla kapat
  const forceExitTimeout = setTimeout(() => {
    console.log('⚠️ Zorla kapatılıyor (timeout)...');
    process.exit(1);
  }, 5000);
  
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