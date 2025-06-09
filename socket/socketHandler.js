// socket/socketHandler.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }

    socket.userId = user._id.toString();
    socket.userData = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Socket event handlers
const handleConnection = (io) => {
  return (socket) => {
    console.log(`User connected: ${socket.userData.username} (${socket.userId})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Update user online status
    updateUserOnlineStatus(socket.userId, true);

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.userData.username} joined conversation ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`User ${socket.userData.username} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.userData.username,
        conversationId: data.conversationId
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_stop_typing', {
        userId: socket.userId,
        conversationId: data.conversationId
      });
    });

    // Handle message read receipts
    socket.on('message_read', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('message_read_receipt', {
        messageId: data.messageId,
        readBy: socket.userId,
        conversationId: data.conversationId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userData.username} (${socket.userId})`);
      updateUserOnlineStatus(socket.userId, false);
    });
  };
};

// Helper functions
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeen: new Date()
    });
  } catch (error) {
    console.error('Error updating user online status:', error);
  }
};

module.exports = {
  authenticateSocket,
  handleConnection
};