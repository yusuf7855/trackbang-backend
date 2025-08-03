// middlewares/authMiddleware.js - Düzeltilmiş versiyon

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    console.log('🔐 Auth middleware çalışıyor. URL:', req.originalUrl);
    console.log('🔐 Headers:', req.headers.authorization);
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('❌ Authorization header missing');
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization header missing' 
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('❌ Token missing');
      return res.status(401).json({ 
        success: false, 
        message: 'Token missing' 
      });
    }

    console.log('🔑 Token başlangıcı:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token,  "supersecretkey");
    
    // ✅ DÜZELTME: req.user objesi oluştur (notification controller'da req.user.id kullanılıyor)
    req.user = {
      id: decoded.userId,
      userId: decoded.userId // backward compatibility için
    };
    
    // ✅ DÜZELTME: req.userId'yi de ayarla (bazı controller'lar bunu kullanabilir)
    req.userId = decoded.userId;
    
    console.log('✅ Decoded token userId:', decoded.userId);
    console.log('✅ req.user.id:', req.user.id);
    
    next();
  } catch (err) {
    console.error('❌ Authentication error:', err.message);
    
    // JWT hatalarına göre ayrıntılı mesaj
    let errorMessage = 'Authentication failed';
    if (err.name === 'TokenExpiredError') {
      errorMessage = 'Token süresi dolmuş';
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = 'Geçersiz token';
    } else if (err.name === 'NotBeforeError') {
      errorMessage = 'Token henüz aktif değil';
    }
    
    return res.status(401).json({ 
      success: false, 
      message: errorMessage,
      error: err.message
    });
  }
};