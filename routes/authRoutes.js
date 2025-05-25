const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.get('/search', authController.searchUsers);
router.post('/follow/:targetUserId', authMiddleware, authController.followUser);
router.post('/unfollow/:targetUserId', authMiddleware, authController.unfollowUser);
router.get('/user/:id', authMiddleware, authController.getUserById); 
router.get('/me', authMiddleware, authController.getCurrentUser);

// Profil resmi yükleme
router.post('/upload-profile-image', 
  authMiddleware, 
  authController.uploadProfileImage, 
  authController.updateProfileImage
);

// Yeni route'lar
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/upload-additional-images', 
  authMiddleware, 
  authController.uploadAdditionalImages, 
  authController.uploadUserAdditionalImages
);
router.delete('/additional-image/:filename', authMiddleware, authController.deleteAdditionalImage);

module.exports = router;