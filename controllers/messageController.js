// controllers/messageController.js
const Message = require('../models/Message');
const User = require('../models/userModel');
const mongoose = require('mongoose');

// Mesaj gönderme
const sendMessage = async (req, res) => {
  try {
    console.log('📤 Mesaj gönderme isteği:', {
      senderId: req.user.userId,
      body: req.body
    });

    const { recipientId, message, messageType = 'text', replyTo } = req.body;
    const senderId = req.user.userId;

    // Validasyon
    if (!recipientId || !message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Alıcı ID ve mesaj gerekli'
      });
    }

    // Alıcının varlığını kontrol et
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Alıcı kullanıcı bulunamadı'
      });
    }

    // Kendi kendine mesaj gönderme kontrolü
    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Kendinize mesaj gönderemezsiniz'
      });
    }

    // Yanıtlanan mesajın varlığını kontrol et (eğer varsa)
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (!replyMessage) {
        return res.status(404).json({
          success: false,
          message: 'Yanıtlanan mesaj bulunamadı'
        });
      }
    }

    // Yeni mesaj oluştur
    const newMessage = new Message({
      senderId,
      recipientId,
      message: message.trim(),
      messageType,
      replyTo: replyTo || null,
      deliveryStatus: 'sent'
    });

    await newMessage.save();

    // Populate ile detayları getir
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('senderId', 'firstName lastName username profileImage')
      .populate('recipientId', 'firstName lastName username profileImage')
      .populate('replyTo', 'message senderId');

    console.log('✅ Mesaj başarıyla gönderildi:', populatedMessage._id);

    res.status(201).json({
      success: true,
      message: 'Mesaj gönderildi',
      data: populatedMessage
    });
  } catch (error) {
    console.error('❌ Mesaj gönderme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj gönderilemedi',
      error: error.message
    });
  }
};

// İki kullanıcı arasındaki mesajları getir
const getConversation = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { otherUserId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    console.log('💬 Konuşma getiriliyor:', {
      currentUserId,
      otherUserId,
      page,
      limit
    });

    // Kullanıcının varlığını kontrol et
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Mesajları getir (yeni olan en üstte)
    const messages = await Message.getConversation(
      currentUserId, 
      otherUserId, 
      limit, 
      skip
    );

    // Mesajları eski tarihe göre sırala (UI'da eskiden yeniye göstermek için)
    const sortedMessages = messages.reverse();

    // Okunmamış mesajları okundu olarak işaretle
    await Message.markConversationAsRead(otherUserId, currentUserId);

    // Toplam mesaj sayısını al
    const totalMessages = await Message.countDocuments({
      $or: [
        { senderId: currentUserId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: currentUserId }
      ],
      isDeleted: false
    });

    console.log('✅ Konuşma getirildi:', {
      messageCount: sortedMessages.length,
      totalMessages,
      hasMore: skip + sortedMessages.length < totalMessages
    });

    res.json({
      success: true,
      messages: sortedMessages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: skip + sortedMessages.length < totalMessages
      }
    });
  } catch (error) {
    console.error('❌ Konuşma getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Konuşma yüklenemedi',
      error: error.message
    });
  }
};

// Kullanıcının tüm konuşmalarını getir
const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    console.log('📋 Konuşma listesi getiriliyor:', currentUserId);

    const conversations = await Message.getConversationList(currentUserId);

    console.log('✅ Konuşma listesi getirildi:', conversations.length);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('❌ Konuşma listesi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Konuşmalar yüklenemedi',
      error: error.message
    });
  }
};

// Mesajı okundu olarak işaretle
const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.userId;

    console.log('👁️ Mesaj okundu işaretleniyor:', {
      messageId,
      currentUserId
    });

    const message = await Message.findOneAndUpdate(
      { 
        _id: messageId, 
        recipientId: currentUserId,
        isRead: false,
        isDeleted: false
      },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya zaten okunmuş'
      });
    }

    console.log('✅ Mesaj okundu olarak işaretlendi');

    res.json({
      success: true,
      message: 'Mesaj okundu olarak işaretlendi'
    });
  } catch (error) {
    console.error('❌ Mesaj okundu işaretleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj güncellenemedi',
      error: error.message
    });
  }
};

// Konuşmadaki tüm mesajları okundu olarak işaretle
const markConversationAsRead = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user.userId;

    console.log('👁️ Konuşma okundu işaretleniyor:', {
      currentUserId,
      otherUserId
    });

    const result = await Message.markConversationAsRead(otherUserId, currentUserId);

    console.log('✅ Konuşma okundu olarak işaretlendi:', result.modifiedCount);

    res.json({
      success: true,
      message: 'Konuşma okundu olarak işaretlendi',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Konuşma okundu işaretleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Konuşma güncellenemedi',
      error: error.message
    });
  }
};

// Okunmamış mesaj sayısını getir
const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user.userId;

    const unreadCount = await Message.getUnreadCount(currentUserId);

    console.log('📊 Okunmamış mesaj sayısı:', unreadCount);

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('❌ Okunmamış mesaj sayısı hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Okunmamış mesaj sayısı getirilemedi',
      error: error.message
    });
  }
};

// Mesaj silme (soft delete)
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.userId;

    console.log('🗑️ Mesaj siliniyor:', {
      messageId,
      currentUserId
    });

    const message = await Message.findOne({
      _id: messageId,
      senderId: currentUserId, // Sadece gönderen silebilir
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya silme yetkisi yok'
      });
    }

    await message.softDelete();

    console.log('✅ Mesaj silindi');

    res.json({
      success: true,
      message: 'Mesaj silindi'
    });
  } catch (error) {
    console.error('❌ Mesaj silme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj silinemedi',
      error: error.message
    });
  }
};

// Mesaj düzenleme
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: newMessage } = req.body;
    const currentUserId = req.user.userId;

    console.log('✏️ Mesaj düzenleniyor:', {
      messageId,
      currentUserId,
      newMessage: newMessage?.substring(0, 50) + '...'
    });

    if (!newMessage || newMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Yeni mesaj içeriği gerekli'
      });
    }

    const message = await Message.findOne({
      _id: messageId,
      senderId: currentUserId, // Sadece gönderen düzenleyebilir
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mesaj bulunamadı veya düzenleme yetkisi yok'
      });
    }

    // Mesajın 24 saatten eski olup olmadığını kontrol et
    const now = new Date();
    const messageTime = message.createdAt;
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);

    if (diffInHours > 24) {
      return res.status(400).json({
        success: false,
        message: '24 saatten eski mesajlar düzenlenemez'
      });
    }

    await message.editMessage(newMessage.trim());

    // Güncellenmiş mesajı populate ile getir
    const updatedMessage = await Message.findById(messageId)
      .populate('senderId', 'firstName lastName username profileImage')
      .populate('recipientId', 'firstName lastName username profileImage');

    console.log('✅ Mesaj düzenlendi');

    res.json({
      success: true,
      message: 'Mesaj düzenlendi',
      data: updatedMessage
    });
  } catch (error) {
    console.error('❌ Mesaj düzenleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj düzenlenemedi',
      error: error.message
    });
  }
};

// Mesaj arama
const searchMessages = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { query, otherUserId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log('🔍 Mesaj araması:', {
      currentUserId,
      query,
      otherUserId
    });

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Arama sorgusu gerekli'
      });
    }

    const searchConditions = {
      $and: [
        {
          $or: [
            { senderId: currentUserId },
            { recipientId: currentUserId }
          ]
        },
        {
          message: { $regex: query.trim(), $options: 'i' }
        },
        {
          isDeleted: false
        }
      ]
    };

    // Belirli bir kullanıcıyla konuşmada ara
    if (otherUserId) {
      searchConditions.$and.push({
        $or: [
          { senderId: currentUserId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: currentUserId }
        ]
      });
    }

    const messages = await Message.find(searchConditions)
      .populate('senderId', 'firstName lastName username profileImage')
      .populate('recipientId', 'firstName lastName username profileImage')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const totalMessages = await Message.countDocuments(searchConditions);

    console.log('✅ Mesaj araması tamamlandı:', {
      resultCount: messages.length,
      totalResults: totalMessages
    });

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total: totalMessages,
        hasMore: skip + messages.length < totalMessages
      }
    });
  } catch (error) {
    console.error('❌ Mesaj arama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Mesaj araması başarısız',
      error: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  markMessageAsRead,
  markConversationAsRead,
  getUnreadCount,
  deleteMessage,
  editMessage,
  searchMessages
};