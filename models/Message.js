// models/Message.js - Duplicate index sorunu çözülmüş

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // ⚠️ index: true KALDIRILDI - Duplicate hatası önlendi
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // ⚠️ index: true KALDIRILDI - Duplicate hatası önlendi
  },
  message: {
    type: String,
    required: function() {
      return this.messageType === 'text';
    },
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'file', 'listing'],
    default: 'text'
  },
  
  // Medya dosyaları için
  media: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  },
  
  // İlan paylaşımı için
  sharedListing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreListing'
  },
  
  // Mesaj durumu
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Yanıtlama özelliği
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Düzenleme özellikleri
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  originalMessage: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============ MANUEL INDEX'LER - DUPLICATE ÖNLENMIŞ ============
// ⚠️ senderId ve recipientId için index: true kaldırıldı

// En önemli compound index - konuşma sorguları için
messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

// Okunmamış mesajlar için
messageSchema.index({ recipientId: 1, isRead: 1 });

// Genel mesaj listesi için
messageSchema.index({ createdAt: -1 });

// Silinen mesajları filtrelemek için
messageSchema.index({ senderId: 1, recipientId: 1, isDeleted: 1 });

// Medya mesajları için
messageSchema.index({ messageType: 1, createdAt: -1 });

// ============ VIRTUAL FIELDS ============
messageSchema.virtual('isFromSender').get(function() {
  // Bu field'i populate edildikten sonra set etmek gerekiyor
  return this._isFromSender || false;
});

// ============ INSTANCE METHODS ============
messageSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

messageSchema.methods.softDelete = function(deletedByUserId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedByUserId;
  return this.save();
};

messageSchema.methods.editMessage = function(newMessage) {
  if (this.messageType !== 'text') {
    throw new Error('Sadece metin mesajları düzenlenebilir');
  }
  
  this.originalMessage = this.message;
  this.message = newMessage;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// ============ STATIC METHODS ============
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
  .populate('sharedListing', 'title price images')
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

messageSchema.statics.searchMessages = function(userId, searchTerm, limit = 20) {
  return this.find({
    $or: [
      { senderId: userId },
      { recipientId: userId }
    ],
    message: { $regex: searchTerm, $options: 'i' },
    messageType: 'text',
    isDeleted: false
  })
  .populate('senderId', 'firstName lastName username profileImage')
  .populate('recipientId', 'firstName lastName username profileImage')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// ============ PRE/POST HOOKS ============
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

module.exports = mongoose.model('Message', messageSchema);