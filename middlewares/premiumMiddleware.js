const User = require('../models/userModel');

const premiumMiddleware = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Premium kontrolü
    const isPremium = user.subscription.isActive && 
                     user.subscription.endDate && 
                     new Date() < user.subscription.endDate;

    if (!isPremium) {
      return res.status(403).json({
        success: false,
        message: 'Premium membership required',
        subscriptionStatus: {
          isActive: false,
          type: 'free'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Premium middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = premiumMiddleware;