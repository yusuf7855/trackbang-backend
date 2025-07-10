// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000 // Mesaj uzunluğu sınırı
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'file'],
    default: 'text'
  },
  // Medya dosyaları için
  mediaUrl: {
    type: String,
    default: null
  },
  mediaType: {
    type: String,
    default: null
  },
  mediaSize: {
    type: Number,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Mesajın gönderilme durumu
  deliveryStatus: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'failed'],
    default: 'sent'
  },
  // Mesaj yanıtlama özelliği için
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Forward edilen mesajlar için
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Mesaj düzenleme geçmişi
  editHistory: [{
    originalMessage: String,
    editedAt: { type: Date, default: Date.now }
  }],
  isEdited: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // createdAt ve updatedAt otomatik eklenir
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexler - Performans için çok önemli
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 
  senderId: 1, 
  recipientId: 1, 
  isDeleted: 1 
});

// Mesaj gönderilmeden önce validasyon
messageSchema.pre('save', function(next) {
  // Kendi kendine mesaj göndermeyi engelle
  if (this.senderId.toString() === this.recipientId.toString()) {
    const error = new Error('Kendinize mesaj gönderemezsiniz');
    return next(error);
  }
  
  // Boş mesaj kontrolü
  if (this.messageType === 'text' && (!this.message || this.message.trim() === '')) {
    const error = new Error('Mesaj boş olamaz');
    return next(error);
  }
  
  next();
});

// Statik metodlar - Sık kullanılan sorgular için
messageSchema.statics.getConversation = function(userId1, userId2, limit = 50, skip = 0) {
  return this.find({
    $or: [
      { senderId: userId1, recipientId: userId2 },
      { senderId: userId2, recipientId: userId1 }
    ],
    isDeleted: false
  })
  .populate('senderId', 'firstName lastName username profileImage')
  .populate('recipientId', 'firstName lastName username profileImage')
  .populate('replyTo', 'message senderId')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip);
};

messageSchema.statics.markConversationAsRead = function(senderId, recipientId) {
  return this.updateMany(
    {
      senderId: senderId,
      recipientId: recipientId,
      isRead: false,
      isDeleted: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );
};

messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipientId: userId,
    isRead: false,
    isDeleted: false
  });
};

messageSchema.statics.getConversationList = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(userId) },
          { recipientId: new mongoose.Types.ObjectId(userId) }
        ],
        isDeleted: false
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] },
            '$recipientId',
            '$senderId'
          ]
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$recipientId', new mongoose.Types.ObjectId(userId)] },
                  { $eq: ['$isRead', false] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'otherUser',
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              username: 1,
              profileImage: 1
            }
          }
        ]
      }
    },
    {
      $unwind: '$otherUser'
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    }
  ]);
};

// Instance metodlar
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

messageSchema.methods.editMessage = function(newMessage) {
  // Orijinal mesajı edit history'ye ekle
  if (!this.isEdited) {
    this.editHistory.push({
      originalMessage: this.message
    });
  }
  
  this.message = newMessage;
  this.isEdited = true;
  return this.save();
};

// Virtual alanlar
messageSchema.virtual('isRecent').get(function() {
  const now = new Date();
  const messageTime = this.createdAt;
  const diffInMinutes = (now - messageTime) / (1000 * 60);
  return diffInMinutes < 30; // Son 30 dakika içinde
});

messageSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const messageTime = this.createdAt;
  const diffInMs = now - messageTime;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'şimdi';
  if (diffInMinutes < 60) return `${diffInMinutes}d önce`;
  if (diffInHours < 24) return `${diffInHours}s önce`;
  if (diffInDays < 7) return `${diffInDays} gün önce`;
  
  return this.createdAt.toLocaleDateString('tr-TR');
});

// Konuşma ID'si - iki kullanıcı arasındaki benzersiz tanımlayıcı
messageSchema.virtual('conversationId').get(function() {
  const ids = [this.senderId.toString(), this.recipientId.toString()].sort();
  return ids.join('_');
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;