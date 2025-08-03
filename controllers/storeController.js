// controllers/storeController.js - DÜZELTİLMİŞ VERSİYON

const StoreListing = require('../models/StoreListing');
const ListingRights = require('../models/ListingRights');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Upload konfigürasyonu
const uploadDir = path.join(__dirname, '../uploads/store-listings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  console.log('🔍 FileFilter çağrıldı:', {
    fieldname: file?.fieldname,
    originalname: file?.originalname,
    mimetype: file?.mimetype
  });
  
  // Eğer file.mimetype undefined ise, kabul etme ama hata da verme
  if (!file || !file.mimetype) {
    console.log('⚠️ File veya mimetype yok, reddediliyor');
    cb(null, false);
    return;
  }
  
  // Resim dosya uzantılarını kontrol et (mimetype güvenilir olmayabilir)
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.ico', '.heic', '.heif'];
  const originalname = file.originalname?.toLowerCase() || '';
  const hasImageExtension = allowedExtensions.some(ext => originalname.endsWith(ext));
  
  // Mimetype kontrolü VEYA dosya uzantısı kontrolü
  if (file.mimetype.startsWith('image/') || 
      file.mimetype === 'application/octet-stream' && hasImageExtension) {
    console.log('✅ Resim dosyası kabul edildi');
    cb(null, true);
  } else {
    console.log('❌ Resim olmayan dosya reddedildi:', file.mimetype, 'Extension:', originalname);
    cb(null, false); // Hata vermek yerine sadece reddet
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// Test endpoint
exports.testConnection = async (req, res) => {
  try {
    console.log('🧪 Store Test Connection çağrıldı');
    const testListing = await StoreListing.findOne().limit(1);
    
    res.json({
      success: true,
      message: 'Store service çalışıyor!',
      timestamp: new Date().toISOString(),
      dbConnection: testListing ? 'Bağlı' : 'Bağlı (veri yok)',
      availableEndpoints: [
        '/api/store/test',
        '/api/store/listings',
        '/api/store/rights',
        '/api/store/rights/purchase',
        '/api/store/my-listings'
      ]
    });
  } catch (error) {
    console.error('❌ Store test error:', error);
    res.status(500).json({
      success: false,
      message: 'Store service test hatası',
      error: error.message
    });
  }
};

// Get all listings
exports.getAllListings = async (req, res) => {
  try {
    console.log('📋 Get all listings çağrıldı');
    
    const { 
      page = 1, 
      limit = 20, 
      category, 
      search, 
      minPrice, 
      maxPrice, 
      province,
      district,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;
    
    // Filter objesi oluştur
    const filter = { 
      status: 'active', 
      isActive: true,
      expiryDate: { $gt: new Date() }
    };
    
    if (category && category !== 'Tümü') {
      filter.category = category;
    }
    
    if (province) {
      filter['location.province'] = province;
    }
    
    if (district) {
      filter['location.district'] = district;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { listingNumber: { $regex: search, $options: 'i' } },
        { 'location.province': { $regex: search, $options: 'i' } },
        { 'location.district': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Sort objesi
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const listings = await StoreListing.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email firstName lastName profileImage')
      .lean();
    
    const total = await StoreListing.countDocuments(filter);
    
    // Resim URL'lerini ekle ve kullanıcı profil resmi düzenle
    const listingsWithImages = listings.map(listing => ({
      ...listing,
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      })),
      userId: listing.userId ? {
        ...listing.userId,
        profileImageUrl: listing.userId.profileImage?.startsWith('/uploads/') 
          ? listing.userId.profileImage 
          : `/uploads/${listing.userId.profileImage || 'default-profile.jpg'}`
      } : null
    }));
    
    res.json({
      success: true,
      listings: listingsWithImages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Get all listings error:', error);
    res.status(500).json({
      success: false,
      message: 'İlanları yüklerken hata oluştu',
      error: error.message
    });
  }
};

// Create new listing - BASIT VE ETKİN ÇÖZÜM
exports.createListing = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('👤 Create listing user ID:', userId);
    
    const { title, category, price, description, phoneNumber, province, district, fullAddress } = req.body;
    
    // Validation
    if (!title || !category || !price || !description || !phoneNumber || !province || !district) {
      return res.status(400).json({
        success: false,
        message: 'Tüm zorunlu alanlar doldurulmalıdır (başlık, kategori, fiyat, açıklama, telefon, il, ilçe)',
        missing: {
          title: !title,
          category: !category,
          price: !price,
          description: !description,
          phoneNumber: !phoneNumber,
          province: !province,
          district: !district
        }
      });
    }

    // İlan hakkı kontrolü
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      // Kullanıcının rights kaydı yoksa oluştur (1 ücretsiz hak ver)
      userRights = new ListingRights({
        userId,
        totalRights: 1,
        usedRights: 0,
        availableRights: 1,
        purchaseHistory: [{
          rightsAmount: 1,
          pricePerRight: 0,
          totalPrice: 0,
          currency: 'EUR',
          paymentMethod: 'free_credit',
          status: 'completed',
          notes: 'İlk ücretsiz ilan hakkı'
        }]
      });
      await userRights.save();
      console.log('✅ Yeni kullanıcı için 1 ücretsiz hak verildi');
    }
    
    // ÖNEMLI: İlan hakkı yoksa ilan oluşturmaya izin verme
    if (userRights.availableRights <= 0) {
      return res.status(403).json({
        success: false,
        message: 'İlan hakkınız bulunmuyor. Lütfen ilan hakkı satın alın.',
        availableRights: 0,
        needToPurchase: true // Flutter için özel flag
      });
    }
    
    // Prepare images array
    const images = req.files && req.files.length > 0 ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    console.log('📋 Creating listing with data:', {
      userId,
      title,
      category,
      price: parseFloat(price),
      description,
      phoneNumber,
      province,
      district,
      fullAddress,
      imagesCount: images.length
    });
    
    // Create listing
    const listing = new StoreListing({
      userId,
      title: title.trim(),
      category,
      price: parseFloat(price),
      description: description.trim(),
      phoneNumber: phoneNumber.trim(),
      location: {
        province: province.trim(),
        district: district.trim(),
        fullAddress: fullAddress ? fullAddress.trim() : '',
        coordinates: {
          latitude: null,
          longitude: null
        }
      },
      images,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paymentStatus: 'paid',
      status: 'active',
      isActive: true,
      listingNumber: generateListingNumber(),
      contactCount: 0,
      viewCount: 0
    });
    
    await listing.save();
    console.log('✅ Listing created with ID:', listing._id);
    
    // İlan hakkını kullan
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    userRights.usageHistory.push({
      listingId: listing._id,
      usedAt: new Date(),
      action: 'create_listing',
      notes: `İlan oluşturuldu: ${title}`
    });
    await userRights.save();
    
    console.log('✅ İlan hakkı kullanıldı. Kalan:', userRights.availableRights);
    
    // Populate user data for response
    const populatedListing = await StoreListing.findById(listing._id)
      .populate('userId', 'username email firstName lastName profileImage');
    
    res.status(201).json({
      success: true,
      message: 'İlan başarıyla oluşturuldu!',
      listing: {
        ...populatedListing.toJSON(),
        images: populatedListing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        })),
        userId: populatedListing.userId ? {
          ...populatedListing.userId.toObject(),
          profileImageUrl: populatedListing.userId.profileImage?.startsWith('/uploads/') 
            ? populatedListing.userId.profileImage 
            : `/uploads/${populatedListing.userId.profileImage || 'default-profile.jpg'}`
        } : null
      },
      remainingRights: userRights.availableRights
    });
    
  } catch (error) {
    console.error('❌ Create listing error:', error);
    
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(__dirname, '../uploads/store-listings', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'İlan oluşturulurken hata oluştu',
      error: 'production' === 'production' ? error.message : 'Internal server error'
    });
  }
};

exports.getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findById(id)
      .populate('userId', 'username email firstName lastName profileImage');
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı'
      });
    }
    
    // View count artır
    listing.viewCount += 1;
    await listing.save();
    
    const listingWithImages = {
      ...listing.toJSON(),
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      })),
      userId: listing.userId ? {
        ...listing.userId.toObject(),
        profileImageUrl: listing.userId.profileImage?.startsWith('/uploads/') 
          ? listing.userId.profileImage 
          : `/uploads/${listing.userId.profileImage || 'default-profile.jpg'}`
      } : null
    };

    res.json({
      success: true,
      listing: listingWithImages
    });

  } catch (error) {
    console.error('❌ Get listing by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan yüklenirken hata oluştu',
      error: error.message
    });
  }
};

// Listing oluşturma işlemini ayırıyoruz
async function processListingCreation(req, res) {
  try {
    const userId = req.userId || req.user?.id;
    console.log('👤 User ID:', userId);
    
    const { 
      title, 
      category, 
      price, 
      description, 
      phoneNumber,
      province,    // YENİ - İl
      district,    // YENİ - İlçe  
      fullAddress  // YENİ - Detaylı adres
    } = req.body;
    
    // Validation - YENİ konum alanları eklendi
    if (!title || !category || !price || !description || !phoneNumber || !province || !district) {
      return res.status(400).json({
        success: false,
        message: 'Tüm gerekli alanlar doldurulmalıdır (başlık, açıklama, kategori, fiyat, telefon, il, ilçe)',
        missing: {
          title: !title,
          category: !category,
          price: !price,
          description: !description,
          phoneNumber: !phoneNumber,
          province: !province,
          district: !district
        }
      });
    }

    // İlan hakkı kontrolü
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      // Kullanıcının rights kaydı yoksa oluştur (1 ücretsiz hak ver)
      userRights = new ListingRights({
        userId,
        totalRights: 1,
        usedRights: 0,
        availableRights: 1,
        purchaseHistory: [{
          rightsAmount: 1,
          pricePerRight: 0,
          totalPrice: 0,
          currency: 'EUR',
          paymentMethod: 'free_credit',
          status: 'completed',
          notes: 'İlk ücretsiz ilan hakkı'
        }]
      });
      await userRights.save();
      console.log('✅ Yeni kullanıcı için 1 ücretsiz hak verildi');
    }
    
    if (userRights.availableRights <= 0) {
      return res.status(403).json({
        success: false,
        message: 'İlan hakkınız bulunmuyor. Lütfen ilan hakkı satın alın.',
        availableRights: 0
      });
    }
    
    // Prepare images array
    const images = req.files && req.files.length > 0 ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    console.log('📋 Creating listing with data:', {
      userId,
      title,
      category,
      price: parseFloat(price),
      description,
      phoneNumber,
      province,
      district,
      fullAddress,
      imagesCount: images.length
    });
    
    // Create listing - YENİ konum alanları eklendi
    const listing = new StoreListing({
      userId,
      title: title.trim(),
      category,
      price: parseFloat(price),
      description: description.trim(),
      phoneNumber: phoneNumber.trim(),
      location: {  // YENİ - Konum bilgileri
        province: province.trim(),
        district: district.trim(),
        fullAddress: fullAddress ? fullAddress.trim() : '',
        coordinates: {
          // Gelecekte GPS koordinatları eklenebilir
          latitude: null,
          longitude: null
        }
      },
      images,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paymentStatus: 'paid',
      status: 'active',
      isActive: true,
      listingNumber: generateListingNumber(),
      contactCount: 0,
      viewCount: 0
    });
    
    await listing.save();
    console.log('✅ Listing created with ID:', listing._id);
    
    // İlan hakkını kullan
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    userRights.usageHistory.push({
      listingId: listing._id,
      usedAt: new Date(),
      action: 'create_listing',
      notes: `İlan oluşturuldu: ${title}`
    });
    await userRights.save();
    
    console.log('✅ İlan hakkı kullanıldı. Kalan:', userRights.availableRights);
    
    // Populate user data for response
    const populatedListing = await StoreListing.findById(listing._id)
      .populate('userId', 'username email firstName lastName profileImage');
    
    res.status(201).json({
      success: true,
      message: 'İlan başarıyla oluşturuldu!',
      listing: {
        ...populatedListing.toJSON(),
        images: populatedListing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        })),
        // Kullanıcı profil resmi için tam URL
        userId: populatedListing.userId ? {
          ...populatedListing.userId.toObject(),
          profileImageUrl: populatedListing.userId.profileImage?.startsWith('/uploads/') 
            ? populatedListing.userId.profileImage 
            : `/uploads/${populatedListing.userId.profileImage || 'default-profile.jpg'}`
        } : null
      },
      remainingRights: userRights.availableRights
    });
    
  } catch (error) {
    console.error('❌ Create listing error:', error);
    
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const filePath = path.join(__dirname, '../uploads/store-listings', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'İlan oluşturulurken hata oluştu',
      error: 'production' === 'production' ? error.message : 'Something went wrong'
    });
  }
}

// Helper function - İlan numarası oluştur
function generateListingNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `IL${timestamp}${random}`;
}

// Listing oluşturma işlemini ayırıyoruzz
async function processListingCreation(req, res) {
  try {
    const userId = req.userId || req.user?.id;
    console.log('👤 User ID:', userId);
    
    const { title, category, price, description, phoneNumber } = req.body;
    
    // Validation
    if (!title || !category || !price || !description || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar gereklidir',
        missing: {
          title: !title,
          category: !category,
          price: !price,
          description: !description,
          phoneNumber: !phoneNumber
        }
      });
    }

    // DÜZELTİLMİŞ - İlan hakkı kontrolü
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      // Kullanıcının rights kaydı yoksa oluştur (1 ücretsiz hak ver)
      userRights = new ListingRights({
        userId,
        totalRights: 1,
        usedRights: 0,
        availableRights: 1,
        purchaseHistory: [{
          rightsAmount: 1,
          pricePerRight: 0,
          totalPrice: 0,
          currency: 'EUR',
          paymentMethod: 'free_credit',
          status: 'completed'
        }]
      });
      await userRights.save();
      console.log('✅ Yeni kullanıcı için 1 ücretsiz hak verildi');
    }
    
    if (userRights.availableRights <= 0) {
      return res.status(403).json({
        success: false,
        message: 'İlan hakkınız bulunmuyor. Lütfen ilan hakkı satın alın.',
        availableRights: 0
      });
    }
    
    // Prepare images array - sadece varsa
    const images = req.files && req.files.length > 0 ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype
    })) : [];
    
    console.log('📋 Creating listing with data:', {
      userId,
      title,
      category,
      price: parseFloat(price),
      description,
      phoneNumber,
      imagesCount: images.length
    });
    
    // Create listing
    const listing = new StoreListing({
      userId,
      title: title.trim(),
      category,
      price: parseFloat(price),
      description: description.trim(),
      phoneNumber: phoneNumber.trim(),
      images,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      paymentStatus: 'paid',
      status: 'active',
      isActive: true,
      listingNumber: generateListingNumber(),
      contactCount: 0,
      viewCount: 0
    });
    
    await listing.save();
    console.log('✅ Listing created with ID:', listing._id);
    
    // DÜZELTİLMİŞ - İlan hakkını kullan
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    userRights.usageHistory.push({
      listingId: listing._id,
      usedAt: new Date(),
      action: 'create_listing'
    });
    await userRights.save();
    
    console.log('✅ İlan hakkı kullanıldı. Kalan:', userRights.availableRights);
    
    res.status(201).json({
      success: true,
      message: 'İlan başarıyla oluşturuldu!',
      listing: {
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      },
      remainingRights: userRights.availableRights
    });
    
  } catch (error) {
    console.error('❌ Create listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating listing',
      error: 'production' === 'production' ? error.message : 'Internal server error'
    });
  }
}

// DÜZELTİLMİŞ - Get user's listing rights
exports.getUserRights = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('👤 Get user rights for:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı kimliği bulunamadı'
      });
    }

    let userRights = await ListingRights.findOne({ userId });

    // Eğer kullanıcının ilan hakkı kaydı yoksa oluştur (1 ücretsiz hak ver)
    if (!userRights) {
      userRights = new ListingRights({
        userId,
        totalRights: 1,
        usedRights: 0,
        availableRights: 1,
        purchaseHistory: [{
          rightsAmount: 1,
          pricePerRight: 0,
          totalPrice: 0,
          currency: 'EUR',
          paymentMethod: 'free_credit',
          status: 'completed',
          notes: 'İlk ücretsiz ilan hakkı'
        }]
      });
      await userRights.save();
      console.log('✅ Yeni kullanıcı için 1 ücretsiz hak verildi');
    }

    res.json({
      success: true,
      rights: {
        totalRights: userRights.totalRights,
        usedRights: userRights.usedRights,
        availableRights: userRights.availableRights,
        purchaseHistory: userRights.purchaseHistory,
        usageHistory: userRights.usageHistory
      }
    });

  } catch (error) {
    console.error('❌ Get user rights error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan hakları yüklenirken hata oluştu',
      error: error.message
    });
  }
};

// DÜZELTİLMİŞ - Purchase listing rights
exports.purchaseListingRights = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { rightsAmount = 1 } = req.body;

    console.log('💳 Purchase request:', { userId, rightsAmount });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı kimliği bulunamadı'
      });
    }

    if (!rightsAmount || rightsAmount < 1 || rightsAmount > 10) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz hak miktarı (1-10 arası olmalı)'
      });
    }

    let userRights = await ListingRights.findOne({ userId });

    if (!userRights) {
      // Kullanıcının rights kaydı yoksa oluştur
      userRights = new ListingRights({
        userId,
        totalRights: 0,
        usedRights: 0,
        availableRights: 0,
        purchaseHistory: [],
        usageHistory: []
      });
    }

    // Basit satın alma - ödeme sistemi yok
    const pricePerRight = 4.00; // 4 Euro per right
    const totalPrice = rightsAmount * pricePerRight;

    // Hak ekleme
    userRights.totalRights += rightsAmount;
    userRights.availableRights += rightsAmount;

    // Satın alma geçmişine ekle
    userRights.purchaseHistory.push({
      rightsAmount,
      pricePerRight,
      totalPrice,
      currency: 'EUR',
      paymentMethod: 'direct_purchase',
      status: 'completed',
      notes: `${rightsAmount} ilan hakkı satın alındı`
    });

    await userRights.save();

    console.log('✅ İlan hakkı satın alındı:', {
      rightsAmount,
      totalPrice,
      newAvailableRights: userRights.availableRights
    });

    res.json({
      success: true,
      message: `${rightsAmount} ilan hakkı başarıyla satın alındı!`,
      purchase: {
        rightsAmount,
        totalPrice,
        currency: 'EUR'
      },
      rights: {
        totalRights: userRights.totalRights,
        usedRights: userRights.usedRights,
        availableRights: userRights.availableRights
      }
    });

  } catch (error) {
    console.error('❌ Purchase rights error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan hakkı satın alınırken hata oluştu',
      error: error.message
    });
  }
};

// Get user's own listings
exports.getUserListings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const filter = { userId };
    if (status) {
      filter.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const listings = await StoreListing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await StoreListing.countDocuments(filter);
    
    // Add image URLs
    const listingsWithImages = listings.map(listing => ({
      ...listing,
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      }))
    }));
    
    res.json({
      success: true,
      listings: listingsWithImages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Get user listings error:', error);
    res.status(500).json({
      success: false,
      message: 'İlanları yüklerken hata oluştu',
      error: error.message
    });
  }
};

exports.getProvinces = async (req, res) => {
  try {
    const provinces = await StoreListing.distinct('location.province');
    res.json({
      success: true,
      provinces: provinces.filter(p => p).sort()
    });
  } catch (error) {
    console.error('❌ Get provinces error:', error);
    res.status(500).json({
      success: false,
      message: 'İller yüklenirken hata oluştu',
      error: error.message
    });
  }
};
exports.getDistricts = async (req, res) => {
  try {
    const { province } = req.query;
    
    let query = {};
    if (province) {
      query['location.province'] = province;
    }
    
    const districts = await StoreListing.distinct('location.district', query);
    res.json({
      success: true,
      districts: districts.filter(d => d).sort()
    });
  } catch (error) {
    console.error('❌ Get districts error:', error);
    res.status(500).json({
      success: false,
      message: 'İlçeler yüklenirken hata oluştu',
      error: error.message
    });
  }
};
exports.incrementContactCount = async (req, res) => {
  try {
    const listingId = req.params.id;
    
    const listing = await StoreListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı'
      });
    }

    await listing.incrementContactCount();

    res.json({
      success: true,
      message: 'İletişim sayacı güncellendi',
      contactCount: listing.contactCount + 1
    });

  } catch (error) {
    console.error('❌ Increment contact count error:', error);
    res.status(500).json({
      success: false,
      message: 'İletişim sayacı güncellenirken hata oluştu',
      error: error.message
    });
  }
};

// Get categories with counts
exports.getCategories = async (req, res) => {
  try {
    const categories = await StoreListing.aggregate([
      {
        $match: {
          status: 'active',
          isActive: true,
          expiryDate: { $gt: new Date() }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const totalCount = await StoreListing.countDocuments({
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    
    const categoriesWithAll = [
      { _id: 'Tümü', count: totalCount },
      ...categories
    ];
    
    res.json({
      success: true,
      categories: categoriesWithAll
    });
    
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Search listings
exports.searchListings = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const filter = {
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() },
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { listingNumber: { $regex: q, $options: 'i' } }
      ]
    };
    
    if (category && category !== 'Tümü') {
      filter.category = category;
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const listings = await StoreListing.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email')
      .lean();
    
    const total = await StoreListing.countDocuments(filter);
    
    const listingsWithImages = listings.map(listing => ({
      ...listing,
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      }))
    }));
    
    res.json({
      success: true,
      listings: listingsWithImages,
      query: q,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    });
    
  } catch (error) {
    console.error('❌ Search listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching listings',
      error: error.message
    });
  }
};

// Contact seller
exports.contactSeller = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Increment contact count
    listing.contactCount += 1;
    await listing.save();
    
    res.json({
      success: true,
      message: 'Contact recorded',
      phoneNumber: listing.phoneNumber,
      contactCount: listing.contactCount
    });
    
  } catch (error) {
    console.error('❌ Contact seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Error contacting seller',
      error: error.message
    });
  }
};

// Update listing
exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya düzenleme yetkiniz yok'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'category', 'price', 'phoneNumber'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        listing[field] = updates[field];
      }
    });
    
    await listing.save();
    
    res.json({
      success: true,
      message: 'İlan başarıyla güncellendi',
      listing
    });
    
  } catch (error) {
    console.error('❌ Update listing error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan güncellenirken hata oluştu',
      error: error.message
    });
  }
};


// Delete listing
exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya silme yetkiniz yok'
      });
    }
    
    // Delete images
    listing.images.forEach(img => {
      const filePath = path.join(__dirname, '../uploads/store-listings', img.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    await listing.deleteOne();
    
    res.json({
      success: true,
      message: 'İlan başarıyla silindi'
    });
    
  } catch (error) {
    console.error('❌ Delete listing error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan silinirken hata oluştu',
      error: error.message
    });
  }
};

// Renew listing
exports.renewListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'İlan bulunamadı veya yenileme yetkiniz yok'
      });
    }
    
    // Check if user has available rights for renewal
    const userRights = await ListingRights.findOne({ userId });
    if (!userRights || userRights.availableRights <= 0) {
      return res.status(403).json({
        success: false,
        message: 'İlan yenilemek için hakkınız bulunmuyor'
      });
    }
    
    // Renew listing (extend expiry date)
    listing.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    listing.status = 'active';
    listing.isActive = true;
    await listing.save();
    
    // Use one right
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    userRights.usageHistory.push({
      listingId: listing._id,
      usedAt: new Date(),
      action: 'renew_listing',
      notes: `İlan yenilendi: ${listing.title}`
    });
    await userRights.save();
    
    res.json({
      success: true,
      message: 'İlan başarıyla yenilendi',
      listing,
      remainingRights: userRights.availableRights
    });
    
  } catch (error) {
    console.error('❌ Renew listing error:', error);
    res.status(500).json({
      success: false,
      message: 'İlan yenilenirken hata oluştu',
      error: error.message
    });
  }
};

// Helper function
function generateListingNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `IL${timestamp}${random}`;
}
// Admin functions (optional)
exports.adminGetAllListings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const listings = await StoreListing.find(filter)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await StoreListing.countDocuments(filter);
    
    res.json({
      success: true,
      listings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    });
    
  } catch (error) {
    console.error('❌ Admin get all listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: error.message
    });
  }
};

exports.adminUpdateListingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isActive } = req.body;
    
    const listing = await StoreListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    if (status) listing.status = status;
    if (isActive !== undefined) listing.isActive = isActive;
    
    await listing.save();
    
    res.json({
      success: true,
      message: 'Listing status updated',
      listing
    });
    
  } catch (error) {
    console.error('❌ Admin update listing status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating listing status',
      error: error.message
    });
  }
};

exports.adminDeleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findByIdAndDelete(id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Admin delete listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting listing',
      error: error.message
    });
  }
};

exports.adminGrantRights = async (req, res) => {
  try {
    const { userId, rightsAmount } = req.body;
    
    if (!userId || !rightsAmount || rightsAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid userId and rightsAmount required'
      });
    }
    
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      userRights = new ListingRights({
        userId,
        totalRights: 0,
        usedRights: 0,
        availableRights: 0
      });
    }
    
    userRights.totalRights += rightsAmount;
    userRights.availableRights += rightsAmount;
    
    userRights.purchaseHistory.push({
      rightsAmount,
      pricePerRight: 0,
      totalPrice: 0,
      currency: 'EUR',
      paymentMethod: 'admin_grant',
      status: 'completed'
    });
    
    await userRights.save();
    
    res.json({
      success: true,
      message: `Successfully granted ${rightsAmount} listing rights to user`,
      rights: userRights
    });
    
  } catch (error) {
    console.error('❌ Admin grant rights error:', error);
    res.status(500).json({
      success: false,
      message: 'Error granting rights',
      error: error.message
    });
  }
};

exports.adminGetUserRights = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userRights = await ListingRights.findOne({ userId })
      .populate('userId', 'username email');
    
    if (!userRights) {
      return res.status(404).json({
        success: false,
        message: 'User rights not found'
      });
    }
    
    res.json({
      success: true,
      rights: userRights
    });
    
  } catch (error) {
    console.error('❌ Admin get user rights error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user rights',
      error: error.message
    });
  }
};

exports.adminGetStoreStats = async (req, res) => {
  try {
    const totalListings = await StoreListing.countDocuments();
    const activeListings = await StoreListing.countDocuments({ status: 'active', isActive: true });
    const expiredListings = await StoreListing.countDocuments({ expiryDate: { $lt: new Date() } });
    
    const categoryStats = await StoreListing.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const totalRights = await ListingRights.aggregate([
      {
        $group: {
          _id: null,
          totalRightsSold: { $sum: '$totalRights' },
          totalRightsUsed: { $sum: '$usedRights' },
          totalRevenue: { $sum: { $sum: '$purchaseHistory.totalPrice' } }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        listings: {
          total: totalListings,
          active: activeListings,
          expired: expiredListings
        },
        categories: categoryStats,
        rights: totalRights[0] || {
          totalRightsSold: 0,
          totalRightsUsed: 0,
          totalRevenue: 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Admin get store stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching store statistics',
      error: error.message
    });
  }
};