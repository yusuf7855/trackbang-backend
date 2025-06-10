// socket/socketHandler.js - Güncellenmiş ve geliştirilmiş hata yönetimi

const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    // Token'ı farklı yollardan almaya çalış
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                  socket.request.headers.authorization?.replace('Bearer ', '');
    
    console.log('Socket auth attempt:', {
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      socketId: socket.id
    });

    if (!token) {
      console.log('Socket auth failed: No token provided');
      return next(new Error('No token provided'));
    }

    // JWT token'ını verify et
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully:', {
        userId: decoded.id || decoded.userId,
        exp: decoded.exp,
        iat: decoded.iat
      });
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return next(new Error('Invalid token'));
    }

    // Kullanıcı ID'sini al (farklı token formatları için)
    const userId = decoded.id || decoded.userId || decoded.user?.id;
    
    if (!userId) {
      console.error('No user ID found in token:', decoded);
      return next(new Error('Invalid token format'));
    }

    console.log('Looking for user with ID:', userId);

    // Kullanıcıyı veritabanından bul
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      console.error('User not found in database:', {
        userId: userId,
        tokenDecoded: decoded
      });
      
      // Veritabanında bu ID'ye sahip kullanıcı var mı kontrol et
      const userCount = await User.countDocuments({ _id: userId });
      console.log('User count for this ID:', userCount);
      
      return next(new Error('User not found'));
    }

    console.log('User found successfully:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email
    });

    // Socket'e kullanıcı bilgilerini ekle
    socket.userId = user._id.toString();
    socket.userData = user;
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', {
      error: error.message,
      stack: error.stack,
      socketId: socket.id
    });
    next(new Error('Authentication failed'));
  }
};

// Geliştirilmiş connection handler
const handleConnection = (io) => {
  return (socket) => {
    try {
      console.log(`✅ User connected successfully:`, {
        userId: socket.userId,
        username: socket.userData.username,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);
      console.log(`User ${socket.userData.username} joined room: user_${socket.userId}`);

      // Update user online status
      updateUserOnlineStatus(socket.userId, true);

      // Handle joining conversation rooms
      socket.on('join_conversation', (conversationId) => {
        if (!conversationId) {
          console.error('Invalid conversation ID provided');
          return;
        }
        
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.userData.username} joined conversation ${conversationId}`);
        
        // Notify others in the conversation
        socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
          userId: socket.userId,
          username: socket.userData.username,
          conversationId: conversationId
        });
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId) => {
        if (!conversationId) {
          console.error('Invalid conversation ID provided');
          return;
        }
        
        socket.leave(`conversation_${conversationId}`);
        console.log(`User ${socket.userData.username} left conversation ${conversationId}`);
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        if (!data || !data.conversationId) {
          console.error('Invalid typing_start data:', data);
          return;
        }
        
        socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.userData.username,
          conversationId: data.conversationId
        });
      });

      socket.on('typing_stop', (data) => {
        if (!data || !data.conversationId) {
          console.error('Invalid typing_stop data:', data);
          return;
        }
        
        socket.to(`conversation_${data.conversationId}`).emit('user_stop_typing', {
          userId: socket.userId,
          conversationId: data.conversationId
        });
      });

      // Handle message read receipts
      socket.on('message_read', (data) => {
        if (!data || !data.conversationId || !data.messageId) {
          console.error('Invalid message_read data:', data);
          return;
        }
        
        socket.to(`conversation_${data.conversationId}`).emit('message_read_receipt', {
          messageId: data.messageId,
          readBy: socket.userId,
          conversationId: data.conversationId
        });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`❌ User disconnected:`, {
          userId: socket.userId,
          username: socket.userData.username,
          socketId: socket.id,
          reason: reason,
          timestamp: new Date().toISOString()
        });
        
        updateUserOnlineStatus(socket.userId, false);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userData.username}:`, error);
      });

    } catch (error) {
      console.error('Error in connection handler:', error);
      socket.disconnect(true);
    }
  };
};

// Helper functions
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: new Date()
    });
    
    console.log(`Updated online status for user ${userId}: ${isOnline}`);
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
};

// Test database connection
const testDatabaseConnection = async () => {
  try {
    const userCount = await User.countDocuments();
    console.log(`Database connection test: Found ${userCount} users`);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

module.exports = {
  authenticateSocket,
  handleConnection,
  testDatabaseConnection
};