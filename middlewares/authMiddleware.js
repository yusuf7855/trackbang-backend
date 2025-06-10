const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    console.log('Auth middleware çalışıyor. URL:', req.originalUrl); // Debug log
    console.log('Headers:', req.headers.authorization); // Debug log
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('Authorization header missing'); // Debug log
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Token missing'); // Debug log
      return res.status(401).json({ message: 'Token missing' });
    }

    const decoded = jwt.verify(token, "supersecretkey");
    req.userId = decoded.userId;
    console.log('Decoded token userId:', decoded.userId); // Debug log
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};