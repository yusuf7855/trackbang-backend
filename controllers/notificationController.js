// controllers/notificationController.js
const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/userModel');


const debugActiveDevices = async (req, res) => {
  try {
    console.log('🔍 Aktif cihazlar kontrol ediliyor...');
    
    const activeDevices = await DeviceToken.find({ isActive: true })
      .populate('userId', 'username email')
      .sort({ lastActiveAt: -1 });
    
    console.log(`📱 Toplam aktif cihaz: ${activeDevices.length}`);
    
    const deviceInfo = activeDevices.map(device => ({
      id: device._id,
      userId: device.userId?._id,
      username: device.userId?.username,
      platform: device.platform,
      deviceModel: device.deviceModel,
      fcmToken: device.fcmToken.substring(0, 30) + '...',
      lastActive: device.lastActiveAt,
      notificationEnabled: device.notificationSettings?.enabled
    }));

    res.json({
      success: true,
      data: {
        totalDevices: activeDevices.length,
        devices: deviceInfo
      }
    });
  } catch (error) {
    console.error('Debug aktif cihazlar hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Debug bilgisi alınamadı'
    });
  }
};

// DEBUG: Test bildirimi gönder (belirli token'a)
const sendTestNotification = async (req, res) => {
  try {
    const { fcmToken, title = 'Test Bildirimi', body = 'Bu bir test bildirimidir' } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'fcmToken gerekli'
      });
    }

    console.log('🧪 Test bildirimi gönderiliyor...');
    initializeFirebase();

    const message = {
      notification: {
        title,
        body
      },
      data: {
        type: 'test',
        timestamp: Date.now().toString()
      },
      android: {
        notification: {
          channelId: 'default',
          priority: 'high'
        }
      },
      token: fcmToken
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Test bildirimi gönderildi:', response);

    res.json({
      success: true,
      message: 'Test bildirimi gönderildi',
      data: {
        messageId: response
      }
    });
  } catch (error) {
    console.error('Test bildirimi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Test bildirimi gönderilemedi',
      error: error.message
    });
  }
};

// DEBUG: FCM token validation
const validateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'fcmToken gerekli'
      });
    }

    initializeFirebase();

    // Basit test mesajı gönderek token'ı validate et
    try {
      const message = {
        data: {
          test: 'validation'
        },
        token: fcmToken
      };

      await admin.messaging().send(message);
      
      res.json({
        success: true,
        message: 'FCM Token geçerli'
      });
    } catch (fcmError) {
      res.json({
        success: false,
        message: 'FCM Token geçersiz',
        error: fcmError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Token validation hatası',
      error: error.message
    });
  }
};
// Firebase Admin SDK initialization
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    // Environment variables kontrolü
    const FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCTT504svOsyVyI\nztrScU6Oy7ymZ4LDcY1WInBOr2Jgdx1yheHYtGQ3NRPQ7W9I+F1qf4LtvHcr4EWa\nw9RGPpqJxEyUvr/SLyBrcbT0/NZbkA1RckdKlliysHlFEA487meETe3hCQTe1vUr\nU7Ee7lDAmlSOwW/vuUaWCy0zb/WS/i7KTDIMDxhRO3+vtkexHdIE66QdghAYDh6t\n3BJK7IcuHTkMaTAUte12LodPpDtdiyqQb/OgTbRnidcSHFxLnkkBrJbLWzBaaqBl\npOxAmMkRnDZsZ7XORWx2cL2kqb8wzjrzlRCapX9SmQZ751/7xxvk0SYtJlCnDJkt\nWSn9nYInAgMBAAECggEAOkS8mMfYMRl5G7hOv/0HqN4X4e6Bv9Mzp8V5jPY8wJF9\nOWaRvgkktt2s1/CDG2b6dHy5ilYJAXb1sVESrzJmKGZYMGH/OCFh/n38qQc1twQU\n8Il2f59WuF+rqFDAgQOAOMomdOP/ZDG8yoWRQv3bPUQOfGUxZK5xqDoFiBoaFikR\nD+77D7kKMp+OmUDqTPg8j+axZRPRyH+5+JNgz3Igs4xXzJWtediDIRqpRtV4WPmM\nR4HLINzBKIJP89a04jIeXSXAZGTZkhXnD7xqhQuDen9tTQ3VcFjuVKQMrH2PRwKr\nlnKzXtiPpztvqr5vWHGcG8IvMppSRHVjmlyPXWKRqQKBgQDKcnWDo1mrllQvR37F\nWvEBPpBDAyh2kFRI65ZuwA99lTO2VkfeIpPswgiKlC8UmH0LJYtECqxeppnw845W\nwygDufuWuuGtpGm1GRBnTyMG0saL/5ecUQVEL0xDQBfOtw/1TWSRtATaCITdYJw5\nzJSnn6Ceb3qfiTWtB2p4gP2lcwKBgQC6R2LBBu5tI2hQcs7dKWygB0uJR0BW/xg/\nwijybcp13VGQcudSPy5JuehmhcR/nUSpfCef/Bk43ZI02DSufgOIXvJjy2ng0HSC\nXeCMKFZXBzKTUl2AJGrw1O4DHMiShnaZspIB1+JcjJk7is45dlwS03iwsj/krZ5v\nPx94egcjfQKBgQCxmt67oNgvL5AldkyiKVlb5R48nA2ojpBS9NOhz78HRpj6cxFT\nsPQjdkp2APCY2fqBh+t4wwBbfT96YsHSHh4Bvu0YXFVWt/HA3f9FEulAuDNVaOMC\nURYUroXyTc1VHcbTRpVfOhYzjdu6N2J3VqJnuCP6OwTR51b+uI3QsCFWPwKBgHMP\nnxc+Ec4GHev7Tn3blYYvm1/bTAmwnijb5HECkhlFsJj58Jqj/hJ6K+wP2nU9Dmlm\nEA/JJ0cxzZqopbnWipYUl8I+plLAUAcqt4W7cMFm572KFckONaQ20iHICLhBKEb9\nvyQ2VlL2YbwenA1wZ6UVTKpQIBk/iOqMYgMH1Rr9AoGAErfTmEfT0VDrC2JiiiHk\nsxtfpnX/HcPxhK28mUWAtkVRrLoJtsDQpSLc+vQ4Yj3H5PAh4O4MYhZoRIfTX4yu\n29DgrTCweHe9yMtchiqq4OfXs0EMl/WJ6vJSC6QtHU+IBD9NJGrBrFig+pvXsZvU\nX039Qk2RC9ClbKSTJVG5Iv0=\n-----END PRIVATE KEY-----\n"
    const FIREBASE_PROJECT_ID="djmobilapp"
    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY) {
      console.error('❌ Firebase environment variables eksik!');
      throw new Error('Firebase yapılandırması tamamlanmamış');
    }

    const serviceAccount = {
      type: "service_account",
      project_id: FIREBASE_PROJECT_ID,
      private_key_id: "0eee176cf16fdceca515893eac54f8b50609a1d7",
      private_key: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email:"firebase-adminsdk-fbsvc@djmobilapp.iam.gserviceaccount.com"
,
      client_id: "102108716122164687663",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
    };

    console.log('🔥 Firebase Admin SDK başlatılıyor...');
    console.log('Project ID:', FIREBASE_PROJECT_ID);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK başlatıldı');
  }
};

// FCM token kaydetme
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

    const userId = req.user.id;

    if (!fcmToken || !platform || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'fcmToken, platform ve deviceId gerekli'
      });
    }

    console.log(`📱 FCM Token kaydediliyor: ${platform} - ${deviceId.substring(0, 10)}...`);

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

    console.log(`✅ FCM Token kaydedildi: ${deviceToken._id}`);

    res.json({
      success: true,
      message: 'Cihaz token\'ı başarıyla kaydedildi',
      data: {
        tokenId: deviceToken._id,
        isActive: deviceToken.isActive
      }
    });

  } catch (error) {
    console.error('❌ Token kaydetme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Token kaydedilemedi',
      error: error.message
    });
  }
};

// Push bildirim gönderme - GERÇEK FCM GÖNDERİMİ
// controllers/notificationController.js - sendMulticast yerine tek tek gönderim

// Push bildirim gönderme - DÜZELTİLMİŞ VERSİYON
const sendNotification = async (req, res) => {
  try {
    console.log('🚀 FCM Bildirim gönderimi başlıyor...');
    
    // Firebase'i başlat
    initializeFirebase();

    const {
      title,
      body,
      data = {},
      targetUsers = [],
      targetUserIds = [],
      type = 'general',
      imageUrl,
      deepLink,
      actions = [],
      category = 'default',
      sound = 'default',
      badge = 1
    } = req.body;

    console.log('✅ Bildirim başarıyla alındı:');
    console.log(`    - Başlık: ${title}`);
    console.log(`    - İçerik: ${body}`);
    console.log(`    - Tür: ${type}`);
    console.log(`    - Hedef Kullanıcı Sayısı: ${targetUsers.length + targetUserIds.length}`);

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
    console.log(`📝 Bildirim kaydı oluşturuldu: ${notification._id}`);

    // Hedef cihazları belirle
    let deviceTokens;
    
    if (targetUsers.length > 0 || targetUserIds.length > 0) {
      const allTargetUsers = [...targetUsers, ...targetUserIds];
      deviceTokens = await DeviceToken.find({
        userId: { $in: allTargetUsers },
        isActive: true,
        'notificationSettings.enabled': true
      }).populate('userId', 'username email');
    } else {
      // Tüm kullanıcılara gönder
      deviceTokens = await DeviceToken.find({
        isActive: true,
        'notificationSettings.enabled': true
      }).populate('userId', 'username email');
    }

    console.log(`🔍 Veritabanından ${deviceTokens.length} aktif cihaz bulundu`);

    if (deviceTokens.length === 0) {
      notification.status = 'failed';
      notification.totalTargets = 0;
      await notification.save();

      console.log('❌ Aktif cihaz bulunamadı');
      return res.status(404).json({
        success: false,
        message: 'Bildirim almaya uygun aktif cihaz bulunamadı'
      });
    }

    const tokens = deviceTokens.map(device => device.fcmToken);
    notification.totalTargets = tokens.length;

    console.log(`🎯 ${tokens.length} cihaza bildirim gönderilecek`);
    console.log('FCM Tokens:', tokens.map(t => t.substring(0, 20) + '...'));

    // Data objesini string'e çevir (FCM gereksinimidir)
    const stringifiedData = {};
    Object.keys(data).forEach(key => {
      stringifiedData[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
    });

    console.log('📤 FCM mesajı gönderiliyor...');
    console.log('Mesaj içeriği:', {
      title,
      body,
      tokenCount: tokens.length,
      data: stringifiedData
    });

    // ✅ DÜZELTİLDİ: sendMulticast yerine tek tek gönderim
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = [];
    const failureReasons = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      try {
        // Her token için ayrı mesaj hazırla
        const message = {
          notification: {
            title,
            body,
            ...(imageUrl && { imageUrl })
          },
          data: {
            ...stringifiedData,
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
                sound: sound === 'default' ? 'default' : `${sound}.caf`,
                'content-available': 1
              },
              deepLink,
              notificationType: type
            },
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert'
            }
          },
          token: token // Tek token
        };

        // ✅ DÜZELTİLDİ: send() metodu kullan
        const response = await admin.messaging().send(message);
        
        successCount++;
        console.log(`✅ Token ${i + 1}/${tokens.length} başarılı: ${token.substring(0, 20)}... | MessageId: ${response}`);
        
      } catch (error) {
        failureCount++;
        console.log(`❌ Token ${i + 1}/${tokens.length} başarısız: ${token.substring(0, 20)}... | Hata: ${error.message}`);
        
        // Geçersiz token'ları belirle
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(token);
        }
        
        failureReasons.push({
          token: token.substring(0, 20) + '...',
          error: error.message
        });
      }
    }

    console.log(`📊 FCM Sonuçları: ${successCount} başarılı, ${failureCount} başarısız`);

    // Geçersiz token'ları deaktive et
    if (invalidTokens.length > 0) {
      await DeviceToken.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { 
          isActive: false, 
          invalidatedAt: new Date(),
          invalidationReason: 'token_expired'
        }
      );
      console.log(`🗑️ ${invalidTokens.length} geçersiz token deaktive edildi`);
    }

    // Notification kaydını güncelle
    notification.sentCount = successCount;
    notification.failedCount = failureCount;
    notification.sentAt = new Date();
    
    if (failureCount === 0) {
      notification.status = 'sent';
    } else if (successCount === 0) {
      notification.status = 'failed';
    } else {
      notification.status = 'partial';
    }

    await notification.save();

    console.log(`✅ Bildirim gönderim tamamlandı: ${successCount}/${tokens.length} başarılı`);

    // Detaylı response
    res.json({
      success: true,
      message: 'Bildirim gönderildi',
      data: {
        notificationId: notification._id,
        sentCount: successCount,
        failedCount: failureCount,
        totalTargets: tokens.length,
        successRate: Math.round((successCount / tokens.length) * 100),
        invalidTokensCount: invalidTokens.length,
        ...(failureReasons.length > 0 && { failureReasons })
      }
    });

  } catch (error) {
    console.error('💥 Bildirim gönderme hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Bildirim gönderilemedi',
      error: error.message,
      stack: 'production' === 'production' ? error.stack : undefined
    });
  }
};

// Bildirim geçmişini getirme
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

// Kullanıcının bildirimlerini getirme
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type } = req.query;

    const filter = {
      $or: [
        { targetUsers: userId },
        { targetUserIds: userId },
        { targetUsers: { $size: 0 }, targetUserIds: { $size: 0 } } // Genel bildirimler
      ]
    };

    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('title body type imageUrl deepLink createdAt data');

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
    const settings = req.body;

    await DeviceToken.updateMany(
      { userId },
      { notificationSettings: settings }
    );

    res.json({
      success: true,
      message: 'Bildirim ayarları güncellendi'
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
    const { fcmToken } = req.body;
    const userId = req.user.id;

    await DeviceToken.updateOne(
      { fcmToken, userId },
      { isActive: false, invalidatedAt: new Date(), invalidationReason: 'user_disabled' }
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

// Bildirim istatistikleri
const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          totalSent: { $sum: '$sentCount' },
          totalFailed: { $sum: '$failedCount' },
          avgSuccessRate: { $avg: { $divide: ['$sentCount', '$totalTargets'] } }
        }
      }
    ]);

    const deviceStats = await DeviceToken.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        notifications: stats[0] || {},
        devices: deviceStats
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
  debugActiveDevices,
  sendTestNotification,
  validateFCMToken,
  registerDeviceToken,
  sendNotification,
  getNotificationHistory,
  getUserNotifications,
  updateNotificationSettings,
  deactivateDeviceToken,
  getNotificationStats
};