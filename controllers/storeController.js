// controllers/storeController.js
const StoreListing = require('../models/StoreListing');
const ListingRights = require('../models/ListingRights');
const User = require('../models/userModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const uploadDir = path.join(__dirname, '../uploads/store-listings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Store listings upload directory created:', uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, 'listing-' + uniqueSuffix + extension);
  }
});


const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });

    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      console.log('✅ File accepted:', file.originalname);
      return cb(null, true);
    } else {
      console.log('❌ File rejected:', file.originalname, 'Type:', file.mimetype);
      cb(new Error('Sadece resim dosyaları kabul edilir (JPEG, JPG, PNG, GIF, WEBP)'));
    }
  }
});
// ============ MOBIL APP ENDPOINTS ============

// Get all active listings
exports.getAllListings = async (req, res) => {
  console.log('🏪 getAllListings çağrıldı');
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    console.log(`📄 Sayfa: ${page}, Limit: ${limit}`);
    
    // Aktif ilanları getir
    const listings = await StoreListing.find({
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    })
    .populate('userId', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    console.log(`📊 Bulunan ilan sayısı: ${listings.length}`);
    
    const total = await StoreListing.countDocuments({
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    
    console.log(`📈 Toplam ilan sayısı: ${total}`);
    
    // Response formatını kontrol et
    const response = {
      success: true,
      listings: listings.map(listing => ({
        ...listing.toJSON(),
        images: listing.images ? listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        })) : []
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
    
    console.log('✅ Response gönderiliyor');
    res.json(response);
    
  } catch (error) {
    console.error('❌ getAllListings hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

        

// Get listings by category
exports.getListingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const listings = await StoreListing.find({
      category,
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    })
    .populate('userId', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await StoreListing.countDocuments({
      category,
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    });
    
    res.json({
      success: true,
      listings: listings.map(listing => ({
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listings by category',
      error: error.message
    });
  }
};

// Search listings
exports.searchListings = async (req, res) => {
  try {
    const { query, category, minPrice, maxPrice } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    let searchFilter = {
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    };
    
    // Text search
    if (query) {
      searchFilter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { listingNumber: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      searchFilter.category = category;
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      searchFilter.price = {};
      if (minPrice) searchFilter.price.$gte = parseFloat(minPrice);
      if (maxPrice) searchFilter.price.$lte = parseFloat(maxPrice);
    }
    
    const listings = await StoreListing.find(searchFilter)
      .populate('userId', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await StoreListing.countDocuments(searchFilter);
    
    res.json({
      success: true,
      listings: listings.map(listing => ({
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching listings',
      error: error.message
    });
  }
};

// Get single listing details
exports.getListingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findById(id)
      .populate('userId', 'username firstName lastName phone');
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Increment view count
    await listing.incrementViews();
    
    res.json({
      success: true,
      listing: {
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
      error: error.message
    });
  }
};

// Get user's own listings
exports.getUserListings = async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const listings = await StoreListing.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await StoreListing.countDocuments({ userId });
    
    res.json({
      success: true,
      listings: listings.map(listing => ({
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user listings',
      error: error.message
    });
  }
};

// Create new listing
exports.createListing = async (req, res) => {
  console.log('🏪 createListing çağrıldı');
  console.log('📋 Request body:', req.body);
  console.log('📁 Files:', req.files ? req.files.length : 0);

  // Multer middleware'i manuel çağır
  const uploadMiddleware = upload.array('images', 5);
  
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message
      });
    }
    
    try {
      const userId = req.userId || req.user.id;
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

      // Check if user has available listing rights (optional for now)
      try {
        const userRights = await ListingRights.findOne({ userId });
        if (userRights && userRights.availableRights <= 0) {
          return res.status(403).json({
            success: false,
            message: 'İlan hakkınız bulunmuyor. Lütfen ilan hakkı satın alın.',
            availableRights: 0
          });
        }
      } catch (rightsError) {
        console.log('⚠️ Rights check failed, continuing...', rightsError.message);
        // Continue without rights check for now
      }
      
      // Prepare images array
      const images = req.files ? req.files.map(file => {
        console.log('📸 Processing image:', file.filename);
        return {
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };
      }) : [];
      
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
        paymentStatus: 'paid', // Auto-paid for now
        status: 'active',
        isActive: true,
        listingNumber: generateListingNumber(),
        contactCount: 0,
        viewCount: 0
      });
      
      await listing.save();
      console.log('✅ Listing created with ID:', listing._id);
      
      // Use one listing right (if exists)
      try {
        const userRights = await ListingRights.findOne({ userId });
        if (userRights && userRights.availableRights > 0) {
          userRights.availableRights -= 1;
          userRights.usedRights.push({
            listingId: listing._id,
            usedAt: new Date(),
            action: 'create_listing'
          });
          await userRights.save();
          console.log('✅ Listing right used. Remaining:', userRights.availableRights);
        }
      } catch (rightsError) {
        console.log('⚠️ Rights update failed:', rightsError.message);
        // Continue anyway
      }
      
      res.status(201).json({
        success: true,
        message: 'İlan başarıyla oluşturuldu!',
        listing: {
          ...listing.toJSON(),
          images: listing.images.map(img => ({
            ...img,
            url: `/uploads/store-listings/${img.filename}`
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error creating listing:', error);
      
      // Clean up uploaded files if listing creation fails
      if (req.files) {
        req.files.forEach(file => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log('🗑️ Cleaned up file:', file.filename);
            }
          } catch (cleanupError) {
            console.error('❌ File cleanup error:', cleanupError);
          }
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'İlan oluşturulurken hata oluştu',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });
};
function generateListingNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `IL${timestamp}${random}`;
}

// Get user's listing rights
exports.getUserRights = async (req, res) => {
  try {
    const userId = req.userId || req.user.id;
    
    let userRights = await ListingRights.findOne({ userId });
    
    if (!userRights) {
      // Create default rights if not exists
      userRights = new ListingRights({
        userId,
        availableRights: 1, // Give 1 free right for testing
        totalPurchased: 1,
        usedRights: []
      });
      await userRights.save();
    }
    
    res.json({
      success: true,
      credits: userRights.availableRights,
      totalPurchased: userRights.totalPurchased,
      usedCount: userRights.usedRights.length
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

// Test endpoint
exports.testConnection = async (req, res) => {
  console.log('🧪 Test connection çağrıldı');
  
  try {
    // Database bağlantısını test et
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    
    // Sample data oluştur (test için)
    if (req.query.createSample === 'true') {
      const sampleListing = new StoreListing({
        title: 'Test İlan',
        description: 'Bu bir test ilanıdır',
        category: 'Elektronik',
        price: 100,
        userId: new mongoose.Types.ObjectId(), // Dummy user ID
        phoneNumber: '05555555555',
        status: 'active',
        isActive: true,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün sonra
        images: [],
        listingNumber: generateListingNumber()
      });
      
      await sampleListing.save();
      console.log('📝 Sample ilan oluşturuldu');
    }
    
    const listingCount = await StoreListing.countDocuments();
    
    res.json({
      success: true,
      message: 'Store service is working',
      database: {
        connected: isConnected,
        listingCount: listingCount
      },
      uploadDir: uploadDir,
      timestamp: new Date().toISOString(),
      endpoints: {
        getAllListings: '/api/store/listings',
        createListing: '/api/store/listings (POST)',
        getCategories: '/api/store/categories',
        testConnection: '/api/store/test'
      }
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
// Update listing
exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
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
    const userId = req.userId;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or unauthorized'
      });
    }
    
    // Delete associated images
    listing.images.forEach(img => {
      const imagePath = path.join(__dirname, '../uploads/store-listings', img.filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });
    
    await StoreListing.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting listing',
      error: error.message
    });
  }
};

// Renew listing (reactivate)
exports.renewListing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const listing = await StoreListing.findOne({ _id: id, userId });
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found or unauthorized'
      });
    }
    
    // Check if user has available listing rights
    const userRights = await ListingRights.getUserRights(userId);
    
    if (!userRights.hasAvailableRights()) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient listing rights. Please purchase listing rights first.',
        availableRights: userRights.availableRights
      });
    }
    
    // Renew listing
    await listing.renewListing();
    
    // Use one listing right
    await userRights.useRight(listing._id, 'renew_listing');
    
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
      remainingRights: userRights.availableRights - 1
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error renewing listing',
      error: error.message
    });
  }
};

// Get user's listing rights
exports.getUserRights = async (req, res) => {
  try {
    const userId = req.userId;
    const userRights = await ListingRights.getUserRights(userId);
    
    res.json({
      success: true,
      rights: userRights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user rights',
      error: error.message
    });
  }
};

// Purchase listing rights
exports.purchaseListingRights = async (req, res) => {
  try {
    const userId = req.userId;
    const { rightsAmount = 1 } = req.body;
    
    if (rightsAmount < 1 || rightsAmount > 10) {
      return res.status(400).json({
        success: false,
        message: 'Rights amount must be between 1 and 10'
      });
    }
    
    // For now, direct purchase without payment gateway
    const userRights = await ListingRights.purchaseRights(userId, rightsAmount, 'direct_purchase');
    
    res.json({
      success: true,
      message: `Successfully purchased ${rightsAmount} listing right(s)`,
      rights: userRights,
      totalCost: rightsAmount * 4.00,
      currency: 'EUR'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error purchasing listing rights',
      error: error.message
    });
  }
};

// Contact seller (increment contact count)
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
    
    await listing.incrementContactCount();
    
    res.json({
      success: true,
      message: 'Contact count updated',
      phoneNumber: listing.phoneNumber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error contacting seller',
      error: error.message
    });
  }
};

// Get categories with counts
exports.getCategories = async (req, res) => {
  try {
    const categories = [
      { key: 'sound_cards', name: 'Ses Kartları' },
      { key: 'monitors', name: 'Monitörler' },
      { key: 'midi_keyboards', name: 'MIDI Klavyeler' },
      { key: 'recording_sets', name: 'Kayıt Setleri' },
      { key: 'production_computers', name: 'Prodüksiyon Bilgisayarları' },
      { key: 'dj_equipment', name: 'DJ Ekipmanları' },
      { key: 'production_control_devices', name: 'Prodüksiyon Kontrol Cihazları' },
      { key: 'gaming_podcast_equipment', name: 'Gaming ve Podcast Ekipmanları' },
      { key: 'microphones', name: 'Mikrofonlar' },
      { key: 'headphones', name: 'Kulaklıklar' },
      { key: 'studio_dj_accessories', name: 'Studio / DJ Aksesuarları' },
      { key: 'cables', name: 'Kablolar' },
      { key: 'interfaces', name: 'Arabirimler' },
      { key: 'recording_devices', name: 'Kayıt Cihazları' },
      { key: 'pre_amplifiers_effects', name: 'Pre-Amifler / Efektler' },
      { key: 'software', name: 'Yazılımlar' }
    ];
    
    // Get counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await StoreListing.countDocuments({
          category: category.key,
          status: 'active',
          isActive: true,
          expiryDate: { $gt: new Date() }
        });
        
        return {
          ...category,
          count
        };
      })
    );
    
    res.json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// ============ ADMIN PANEL ENDPOINTS ============

// Get all listings for admin
exports.adminGetAllListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const category = req.query.category;
    const search = req.query.search;
    
    let filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { listingNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const listings = await StoreListing.find(filter)
      .populate('userId', 'username firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await StoreListing.countDocuments(filter);
    
    res.json({
      success: true,
      listings: listings.map(listing => ({
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: error.message
    });
  }
};

// Admin update listing status
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
      message: 'Listing status updated successfully',
      listing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating listing status',
      error: error.message
    });
  }
};

// Admin delete listing
exports.adminDeleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    
    const listing = await StoreListing.findById(id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    // Delete associated images
    listing.images.forEach(img => {
      const imagePath = path.join(__dirname, '../uploads/store-listings', img.filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });
    
    await StoreListing.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting listing',
      error: error.message
    });
  }
};

// Admin grant listing rights to user
exports.adminGrantRights = async (req, res) => {
  try {
    const { userId, rightsAmount, reason } = req.body;
    
    if (!userId || !rightsAmount) {
      return res.status(400).json({
        success: false,
        message: 'User ID and rights amount are required'
      });
    }
    
    const userRights = await ListingRights.getUserRights(userId);
    await userRights.addFreeRights(rightsAmount, reason || 'admin_grant');
    
    res.json({
      success: true,
      message: `Successfully granted ${rightsAmount} listing right(s) to user`,
      rights: userRights
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error granting rights',
      error: error.message
    });
  }
};

// Admin get user rights
exports.adminGetUserRights = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userRights = await ListingRights.findOne({ userId })
      .populate('userId', 'username firstName lastName email')
      .populate('usageHistory.listingId', 'title listingNumber');
    
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
    res.status(500).json({
      success: false,
      message: 'Error fetching user rights',
      error: error.message
    });
  }
};

// Admin get store statistics
exports.adminGetStoreStats = async (req, res) => {
  try {
    const totalListings = await StoreListing.countDocuments();
    const activeListings = await StoreListing.countDocuments({ 
      status: 'active', 
      isActive: true 
    });
    const expiredListings = await StoreListing.countDocuments({ status: 'expired' });
    const soldListings = await StoreListing.countDocuments({ status: 'sold' });
    
    // Total revenue (theoretical - rights purchased * 4 EUR)
    const allRights = await ListingRights.find();
    const totalRevenue = allRights.reduce((total, userRights) => {
      return total + userRights.purchaseHistory.reduce((userTotal, purchase) => {
        return userTotal + (purchase.totalPrice || 0);
      }, 0);
    }, 0);
    
    // Category distribution
    const categoryStats = await StoreListing.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'active'] }, { $eq: ['$isActive', true] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    // Recent activity
    const recentListings = await StoreListing.find()
      .populate('userId', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      stats: {
        totalListings,
        activeListings,
        expiredListings,
        soldListings,
        totalRevenue,
        categoryStats,
        recentListings: recentListings.map(listing => ({
          ...listing.toJSON(),
          images: listing.images.map(img => ({
            ...img,
            url: `/uploads/store-listings/${img.filename}`
          }))
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching store statistics',
      error: error.message
    });
  }
};

module.exports = exports;