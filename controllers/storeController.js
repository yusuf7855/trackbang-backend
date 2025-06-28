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
  console.log('🧪 Test connection çağrıldı');
  
  try {
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    const listingCount = await StoreListing.countDocuments();
    
    res.json({
      success: true,
      message: 'Store service is working',
      database: {
        connected: isConnected,
        listingCount: listingCount
      },
      uploadDir: uploadDir,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test connection hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

// Get all listings
exports.getAllListings = async (req, res) => {
  try {
    console.log('📋 Get all listings çağrıldı');
    
    const { page = 1, limit = 20, category, search, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Filter objesi oluştur
    const filter = { 
      status: 'active', 
      isActive: true,
      expiryDate: { $gt: new Date() }
    };
    
    if (category && category !== 'Tümü') {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { listingNumber: { $regex: search, $options: 'i' } }
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
      .populate('userId', 'username email')
      .lean();
    
    const total = await StoreListing.countDocuments(filter);
    
    // Resim URL'lerini ekle
    const listingsWithImages = listings.map(listing => ({
      ...listing,
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      }))
    }));
    
    console.log(`✅ ${listings.length} ilan bulundu`);
    
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
    console.error('❌ Get listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: error.message
    });
  }
};

// Create new listing - BASIT VE ETKİN ÇÖZÜM
exports.createListing = async (req, res) => {
  console.log('📝 Create listing endpoint çağrıldı');
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📋 Request body keys:', Object.keys(req.body));

  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  
  if (isMultipart) {
    // Multipart form data - Multer kullan
    const uploadMiddleware = upload.array('images', 5);
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        // Multer hatası olsa bile resim olmadan devam et
        req.files = [];
      }
      
      await processListingCreation(req, res);
    });
  } else {
    // Regular JSON request
    req.files = []; // Boş files array'i
    await processListingCreation(req, res);
  }
};

// Listing oluşturma işlemini ayırıyoruz
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// DÜZELTİLMİŞ - Get user's listing rights
exports.getUserRights = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    console.log('👤 Getting rights for user:', userId);
    
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
    
    res.json({
      success: true,
      credits: userRights.availableRights,
      totalPurchased: userRights.totalRights,
      usedCount: userRights.usedRights,
      rights: {
        totalRights: userRights.totalRights,
        usedRights: userRights.usedRights,
        availableRights: userRights.availableRights
      }
    });
    
  } catch (error) {
    console.error('❌ Get user rights error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user rights',
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
    
    if (rightsAmount < 1 || rightsAmount > 10) {
      return res.status(400).json({
        success: false,
        message: 'Rights amount must be between 1 and 10'
      });
    }
    
    const pricePerRight = 4.00;
    const totalPrice = rightsAmount * pricePerRight;
    
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      userRights = new ListingRights({
        userId,
        totalRights: 0,
        usedRights: 0,
        availableRights: 0
      });
    }
    
    // Add purchase to history
    userRights.purchaseHistory.push({
      rightsAmount,
      pricePerRight,
      totalPrice,
      currency: 'EUR',
      paymentMethod: 'direct_purchase',
      status: 'completed'
    });
    
    // Update rights
    userRights.totalRights += rightsAmount;
    userRights.availableRights += rightsAmount;
    
    await userRights.save();
    
    console.log('✅ Rights purchased successfully:', {
      amount: rightsAmount,
      totalCost: totalPrice,
      newAvailable: userRights.availableRights
    });
    
    res.json({
      success: true,
      message: `Successfully purchased ${rightsAmount} listing right(s)`,
      rights: {
        totalRights: userRights.totalRights,
        usedRights: userRights.usedRights,
        availableRights: userRights.availableRights
      },
      totalCost: totalPrice,
      currency: 'EUR'
    });
    
  } catch (error) {
    console.error('❌ Purchase rights error:', error);
    res.status(500).json({
      success: false,
      message: 'Error purchasing listing rights',
      error: error.message
    });
  }
};

// Get user's own listings
exports.getUserListings = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const listings = await StoreListing.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await StoreListing.countDocuments({ userId });
    
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
        totalItems: total
      }
    });
    
  } catch (error) {
    console.error('❌ Get user listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user listings',
      error: error.message
    });
  }
};

// Get single listing
exports.getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findById(id)
      .populate('userId', 'username email')
      .lean();
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Increment view count
    await StoreListing.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    
    const listingWithImages = {
      ...listing,
      images: listing.images.map(img => ({
        ...img,
        url: `/uploads/store-listings/${img.filename}`
      }))
    };
    
    res.json({
      success: true,
      listing: listingWithImages
    });
    
  } catch (error) {
    console.error('❌ Get listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
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
    const userId = req.userId || req.user?.id;
    const { title, category, price, description, phoneNumber } = req.body;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or unauthorized'
      });
    }
    
    // Update fields
    if (title) listing.title = title;
    if (category) listing.category = category;
    if (price !== undefined) listing.price = parseFloat(price);
    if (description) listing.description = description;
    if (phoneNumber) listing.phoneNumber = phoneNumber;
    
    await listing.save();
    
    res.json({
      success: true,
      message: 'Listing updated successfully',
      listing: {
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Update listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating listing',
      error: error.message
    });
  }
};

// Delete listing
exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or unauthorized'
      });
    }
    
    await StoreListing.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting listing',
      error: error.message
    });
  }
};

// Renew listing
exports.renewListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.id;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or unauthorized'
      });
    }
    
    const userRights = await ListingRights.findOne({ userId });
    
    if (!userRights || userRights.availableRights <= 0) {
      return res.status(403).json({
        success: false,
        message: 'No listing rights available. Please purchase listing rights first.',
        availableRights: userRights?.availableRights || 0
      });
    }
    
    // Renew listing (extend expiry date)
    listing.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    listing.status = 'active';
    listing.isActive = true;
    await listing.save();
    
    // Use one listing right
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    userRights.usageHistory.push({
      listingId: listing._id,
      usedAt: new Date(),
      action: 'renew_listing'
    });
    await userRights.save();
    
    res.json({
      success: true,
      message: 'Listing renewed successfully',
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
    console.error('❌ Renew listing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error renewing listing',
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