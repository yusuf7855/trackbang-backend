// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/userModel');
const auth = require('../middlewares/authMiddleware');

// Get all conversations for a user
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    })
    .populate({
      path: 'participants',
      select: 'username firstName lastName profilePicture isOnline lastSeen'
    })
    .populate({
      path: 'lastMessage',
      select: 'content messageType createdAt sender isRead'
    })
    .sort({ lastMessageTime: -1 });

    // Add unread count and other participant info
    const conversationsWithDetails = conversations.map(conv => {
      const otherParticipant = conv.participants.find(p => 
        p._id.toString() !== userId.toString()
      );
      
      const unreadCount = conv.unreadCount?.get(userId.toString()) || 0;

      return {
        _id: conv._id,
        otherParticipant,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        unreadCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      };
    });

    res.json({
      success: true,
      conversations: conversationsWithDetails
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Konuşmalar alınırken hata oluştu'
    });
  }
});

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Check if user is participant of the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Konuşma bulunamadı'
      });
    }

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false
    })
    .populate('sender', 'username firstName lastName profilePicture')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Reset unread count for this user
    const updateQuery = {};
    updateQuery[`unreadCount.${userId}`] = 0;
    await Conversation.findByIdAndUpdate(conversationId, updateQuery);

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        hasMore: messages.length === limit
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Mesajlar alınırken hata oluştu'
    });
  }
});

// Send a message
router.post('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text' } = req.body;
    const senderId = req.user._id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Mesaj içeriği boş olamaz'
      });
    }

    // Check if conversation exists and user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId
    }).populate('participants', 'username firstName lastName profilePicture');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Konuşma bulunamadı'
      });
    }

    const receiverId = conversation.participants.find(p => 
      p._id.toString() !== senderId.toString()
    )._id;

    // Create message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      conversation: conversationId,
      content: content.trim(),
      messageType
    });

    await message.save();

    // Update conversation
    const updateQuery = {
      lastMessage: message._id,
      lastMessageTime: new Date()
    };
    updateQuery[`unreadCount.${receiverId}`] = (conversation.unreadCount?.get(receiverId.toString()) || 0) + 1;
    
    await Conversation.findByIdAndUpdate(conversationId, updateQuery);

    // Populate sender info
    await message.populate('sender', 'username firstName lastName profilePicture');

    // Emit socket event for real-time messaging
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('new_message', {
        message,
        conversationId
      });
    }

    res.status(201).json({
      success: true,
      message,
      conversationId
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj gönderilirken hata oluştu'
    });
  }
});

// Start a new conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Alıcı ID gerekli'
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizle konuşma başlatamazsınız'
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    }).populate('participants', 'username firstName lastName profilePicture');

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [senderId, receiverId],
        unreadCount: new Map([
          [senderId.toString(), 0],
          [receiverId.toString(), 0]
        ])
      });
      await conversation.save();
      await conversation.populate('participants', 'username firstName lastName profilePicture');
    }

    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        otherParticipant: conversation.participants.find(p => 
          p._id.toString() !== senderId.toString()
        ),
        lastMessage: conversation.lastMessage,
        lastMessageTime: conversation.lastMessageTime,
        unreadCount: conversation.unreadCount?.get(senderId.toString()) || 0,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Konuşma başlatılırken hata oluştu'
    });
  }
});

// Mark messages as read
router.patch('/conversations/:conversationId/read', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Mark all unread messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Reset unread count
    const updateQuery = {};
    updateQuery[`unreadCount.${userId}`] = 0;
    await Conversation.findByIdAndUpdate(conversationId, updateQuery);

    res.json({
      success: true,
      message: 'Mesajlar okundu olarak işaretlendi'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Mesajlar işaretlenirken hata oluştu'
    });
  }
});

// Delete a message
router.delete('/messages/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      sender: userId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya silme yetkiniz yok'
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message: 'Mesaj silindi'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj silinirken hata oluştu'
    });
  }
});

module.exports = router;