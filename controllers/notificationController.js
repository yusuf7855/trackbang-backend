// controllers/notificationController.js
const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/userModel'); 

// Firebase Admin SDK initialization
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
};

// FCM token kaydetme/güncelleme
const registerDeviceToken = async (req, res) => {
  try {
    const { 
      fcmToken, 
      platform, 
      deviceId, 
      deviceModel, 
      osVersion, 
      appVersion,
      notificationSettings 
    } = req.body;

    const userId = req.user.id; // authMiddleware'den gelir

    if (!fcmToken || !platform || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'fcmToken, platform ve deviceId gerekli'
      });
    }

    // Mevcut token'ı güncelle veya yeni oluştur
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { fcmToken },
      {
        userId,
        platform,
        deviceId,
        deviceModel: deviceModel || 'unknown',
        osVersion: osVersion || 'unknown',
        appVersion: appVersion || '1.0.0',
        isActive: true,
        lastActiveAt: new Date(),
        notificationSettings: {
          ...notificationSettings,
          enabled: notificationSettings?.enabled !== false
        }
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      success: true,
      message: 'Cihaz token\'ı başarıyla kaydedildi',
      data: {
        tokenId: deviceToken._id,
        isActive: deviceToken.isActive
      }
    });

  } catch (error) {
    console.error('Token kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Token kaydedilemedi',
      error: error.message
    });
  }
};

// Push bildirim gönderme (Admin)
const sendNotification = async (req, res) => {
  try {
    initializeFirebase();

    const {
      title,
      body,
      data = {},
      targetUsers = [], // User ObjectId'leri
      targetUserIds = [], // String user ID'ler (backward compatibility)
      type = 'general',
      imageUrl,
      deepLink,
      actions = [],
      category = 'default',
      sound = 'default',
      badge = 1
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Başlık ve içerik gerekli'
      });
    }

    // Bildirim kaydı oluştur
    const notification = new Notification({
      title,
      body,
      data,
      targetUsers,
      targetUserIds,
      type,
      imageUrl,
      deepLink,
      actions,
      category,
      sound,
      badge,
      createdBy: req.user?.id || 'admin'
    });

    await notification.save();

    // Hedef cihazları belirle
    let deviceTokens;
    
    if (targetUsers.length > 0 || targetUserIds.length > 0) {
      // Belirli kullanıcılara gönder
      const allTargetUsers = [...targetUsers, ...targetUserIds];
      deviceTokens = await DeviceToken.find({
        userId: { $in: allTargetUsers },
        isActive: true,
        'notificationSettings.enabled': true,
        [`notificationSettings.types.${type}`]: true
      }).populate('userId', 'username email');
    } else {
      // Tüm kullanıcılara gönder
      deviceTokens = await DeviceToken.find({
        isActive: true,
        'notificationSettings.enabled': true,
        [`notificationSettings.types.${type}`]: true
      }).populate('userId', 'username email');
    }

    if (deviceTokens.length === 0) {
      notification.status = 'failed';
      notification.totalTargets = 0;
      await notification.save();

      return res.status(404).json({
        success: false,
        message: 'Bildirim almaya uygun aktif cihaz bulunamadı'
      });
    }

    // FCM mesaj hazırlama
    const tokens = deviceTokens.map(device => device.fcmToken);
    notification.totalTargets = tokens.length;

    const message = {
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        notificationId: notification._id.toString(),
        type,
        timestamp: Date.now().toString(),
        ...(deepLink && { deepLink }),
        ...(actions.length > 0 && { actions: JSON.stringify(actions) })
      },
      android: {
        notification: {
          channelId: category,
          priority: 'high',
          defaultSound: sound === 'default',
          defaultVibrateTimings: true,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            badge,
            sound: sound === 'default' ? 'default' : sound,
            category: type,
            'mutable-content': 1
          }
        },
        fcmOptions: {
          ...(imageUrl && { imageUrl })
        }
      }
    };

    let sentCount = 0;
    let failedCount = 0;
    const invalidTokens = [];

    // Batch gönderim (500'er token)
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push({
        tokens: tokens.slice(i, i + batchSize),
        devices: deviceTokens.slice(i, i + batchSize)
      });
    }

    for (const batch of batches) {
      try {
        const response = await admin.messaging().sendMulticast({
          ...message,
          tokens: batch.tokens
        });

        sentCount += response.successCount;
        failedCount += response.failureCount;

        // Başarısız token'ları işle
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const errorCode = resp.error?.code;
              const token = batch.tokens[idx];
              const device = batch.devices[idx];
              
              invalidTokens.push({
                token,
                deviceId: device._id,
                error: errorCode
              });

              // Token durumuna göre işlem yap
              if (['messaging/invalid-registration-token', 
                   'messaging/registration-token-not-registered'].includes(errorCode)) {
                DeviceToken.findByIdAndUpdate(device._id, {
                  isActive: false,
                  invalidatedAt: new Date(),
                  invalidationReason: 'token_expired'
                }).exec();
              }
            }
          });
        }

      } catch (error) {
        console.error('Batch gönderim hatası:', error);
        failedCount += batch.tokens.length;
      }
    }

    // Bildirim durumunu güncelle
    notification.sentCount = sentCount;
    notification.failedCount = failedCount;
    notification.sentAt = new Date();
    
    if (failedCount === 0) {
      notification.status = 'sent';
    } else if (sentCount === 0) {
      notification.status = 'failed';
    } else {
      notification.status = 'partial';
    }

    await notification.save();

    res.json({
      success: true,
      message: 'Bildirim gönderildi',
      data: {
        notificationId: notification._id,
        sentCount,
        failedCount,
        totalTargets: tokens.length,
        successRate: Math.round((sentCount / tokens.length) * 100),
        invalidTokensCount: invalidTokens.length
      }
    });

  } catch (error) {
    console.error('Bildirim gönderme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirim gönderilemedi',
      error: error.message
    });
  }
};

// Bildirim geçmişini getirme (Admin)
const getNotificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('targetUsers', 'username email');

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Bildirim geçmişi getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirim geçmişi alınamadı'
    });
  }
};

// Kullanıcının bildirimlerini getirme (Mobil App)
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const filter = {
      $or: [
        { targetUsers: userId },
        { targetUserIds: userId },
        { targetUsers: { $size: 0 }, targetUserIds: { $size: 0 } }
      ],
      status: { $in: ['sent', 'partial'] }
    };

    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('title body data type imageUrl deepLink actions createdAt');

    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Kullanıcı bildirimleri getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirimler alınamadı'
    });
  }
};

// Bildirim ayarlarını güncelleme
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId, settings } = req.body;

    const deviceToken = await DeviceToken.findOne({
      userId,
      deviceId,
      isActive: true
    });

    if (!deviceToken) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    deviceToken.notificationSettings = {
      ...deviceToken.notificationSettings,
      ...settings
    };

    await deviceToken.save();

    res.json({
      success: true,
      message: 'Bildirim ayarları güncellendi',
      data: {
        settings: deviceToken.notificationSettings
      }
    });

  } catch (error) {
    console.error('Bildirim ayarları güncelleme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Ayarlar güncellenemedi'
    });
  }
};

// Cihaz token'ını deaktive etme
const deactivateDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.body;

    await DeviceToken.findOneAndUpdate(
      { userId, deviceId },
      { 
        isActive: false,
        invalidatedAt: new Date(),
        invalidationReason: 'user_disabled'
      }
    );

    res.json({
      success: true,
      message: 'Cihaz token\'ı deaktive edildi'
    });
  } catch (error) {
    console.error('Token deaktive etme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Token deaktive edilemedi'
    });
  }
};

// İstatistikler
const getNotificationStats = async (req, res) => {
  try {
    const totalNotifications = await Notification.countDocuments();
    const totalActiveDevices = await DeviceToken.countDocuments({ isActive: true });
    const todayNotifications = await Notification.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });

    // Platform dağılımı
    const platformStats = await DeviceToken.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$platform', count: { $sum: 1 } } }
    ]);

    // Bildirim türü dağılımı
    const typeStats = await Notification.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalNotifications,
        totalActiveDevices,
        todayNotifications,
        platformDistribution: platformStats,
        typeDistribution: typeStats
      }
    });
  } catch (error) {
    console.error('İstatistik getirme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'İstatistikler alınamadı'
    });
  }
};

module.exports = {
  registerDeviceToken,
  sendNotification,
  getNotificationHistory,
  getUserNotifications,
  updateNotificationSettings,
  deactivateDeviceToken,
  getNotificationStats
};