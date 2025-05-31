const express = require('express');
const router = express.Router();
const hotController = require('../controllers/hotController');

// HOT playlist routes (mobil uygulama için)
router.get('/', hotController.getHotPlaylists);

router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const Playlist = require('../models/Playlist');
    
    const latestPlaylist = await Playlist.findOne({ 
      mainCategory: category,
      isAdminPlaylist: true,
      isPublic: true 
    })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName profileImage'
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestPlaylist) {
      return res.status(404).json({
        success: false,
        message: `${category} kategorisinde henüz admin playlist bulunamadı`
      });
    }

    const categoryDisplayNames = {
      afrohouse: 'Afro House',
      indiedance: 'Indie Dance', 
      organichouse: 'Organic House',
      downtempo: 'Down Tempo',
      melodichouse: 'Melodic House'
    };

    const response = {
      _id: latestPlaylist._id,
      name: latestPlaylist.name,
      description: latestPlaylist.description || '',
      mainCategory: latestPlaylist.mainCategory,
      subCategory: latestPlaylist.subCategory,
      categoryDisplayName: categoryDisplayNames[latestPlaylist.mainCategory] || latestPlaylist.mainCategory,
      musicCount: latestPlaylist.musics?.length || 0,
      owner: {
        _id: latestPlaylist.userId._id,
        username: latestPlaylist.userId.username,
        displayName: `${latestPlaylist.userId.firstName} ${latestPlaylist.userId.lastName}`,
        profileImage: latestPlaylist.userId.profileImage || null
      },
      musics: latestPlaylist.musics?.map(music => ({
        _id: music._id,
        title: music.title,
        artist: music.artist,
        spotifyId: music.spotifyId,
        category: music.category,
        likes: music.likes || 0,
        userLikes: music.userLikes || [],
        beatportUrl: music.beatportUrl || ''
      })) || [],
      createdAt: latestPlaylist.createdAt
    };

    res.json({
      success: true,
      hotPlaylist: response
    });
  } catch (err) {
    console.error('Error fetching hot playlist by category:', err);
    res.status(500).json({ 
      success: false,
      message: 'HOT playlist yüklenirken hata oluştu',
      error: err.message 
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const Playlist = require('../models/Playlist');
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const stats = {};

    for (const category of categories) {
      const totalPlaylists = await Playlist.countDocuments({ 
        mainCategory: category,
        isAdminPlaylist: true,
        isPublic: true 
      });

      const latestPlaylist = await Playlist.findOne({ 
        mainCategory: category,
        isAdminPlaylist: true,
        isPublic: true 
      })
        .select('createdAt name subCategory')
        .sort({ createdAt: -1 });

      stats[category] = {
        totalPlaylists,
        latestPlaylist: latestPlaylist ? {
          name: latestPlaylist.name,
          subCategory: latestPlaylist.subCategory,
          createdAt: latestPlaylist.createdAt
        } : null
      };
    }

    res.json({
      success: true,
      stats
    });
  } catch (err) {
    console.error('Error fetching hot stats:', err);
    res.status(500).json({ 
      success: false,
      message: 'İstatistikler yüklenirken hata oluştu',
      error: err.message 
    });
  }
});

module.exports = router;