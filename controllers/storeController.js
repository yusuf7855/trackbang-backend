// controllers/storeController.js
const StoreListing = require('../models/StoreListing');
const ListingRights = require('../models/ListingRights');
const User = require('../models/userModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/store-listings';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'listing-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).array('images', 5);

// ============ MOBIL APP ENDPOINTS ============

// Get all active listings
exports.getAllListings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const listings = await StoreListing.find({
      status: 'active',
      isActive: true,
      expiryDate: { $gt: new Date() }
    })
    .populate('userId', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await StoreListing.countDocuments({
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
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
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
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: 'File upload error',
        error: err.message
      });
    }
    
    try {
      const userId = req.userId;
      const { title, category, price, description, phoneNumber } = req.body;
      
      // Check if user has available listing rights
      const userRights = await ListingRights.getUserRights(userId);
      
      if (!userRights.hasAvailableRights()) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient listing rights. Please purchase listing rights first.',
          availableRights: userRights.availableRights
        });
      }
      
      // Prepare images array
      const images = req.files ? req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname
      })) : [];
      
      // Create listing
      const listing = new StoreListing({
        userId,
        title,
        category,
        price: parseFloat(price),
        description,
        phoneNumber,
        images,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentStatus: 'paid', // Auto-paid since user has rights
        status: 'active',
        isActive: true
      });
      
      await listing.save();
      
      // Use one listing right
      await userRights.useRight(listing._id, 'create_listing');
      
      res.status(201).json({
        success: true,
        message: 'Listing created successfully',
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
      // Clean up uploaded files if listing creation fails
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating listing',
        error: error.message
      });
    }
  });
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