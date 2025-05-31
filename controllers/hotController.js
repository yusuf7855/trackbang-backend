const Playlist = require('../models/Playlist');

// HOT sayfası için her kategoriden son admin playlist'i getir
exports.getHotPlaylists = async (req, res) => {
  try {
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const hotPlaylists = [];

    for (const category of categories) {
      const latestPlaylist = await Playlist.findOne({ 
        mainCategory: category,
        isAdminPlaylist: true,
        isPublic: true 
      })
        .populate({
          path: 'musics',
          select: 'title artist spotifyId category likes userLikes beatportUrl',
          options: { limit: 10 } // İlk 10 şarkıyı al
        })
        .populate({
          path: 'userId',
          select: 'username firstName lastName profileImage'
        })
        .sort({ createdAt: -1 })
        .lean();

      if (latestPlaylist) {
        hotPlaylists.push({
          _id: latestPlaylist._id,
          name: latestPlaylist.name,
          description: latestPlaylist.description || '',
          mainCategory: latestPlaylist.mainCategory,
          subCategory: latestPlaylist.subCategory,
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
        });
      }
    }

    // Kategoriler için display name mapping
    const categoryDisplayNames = {
      afrohouse: 'Afro House',
      indiedance: 'Indie Dance', 
      organichouse: 'Organic House',
      downtempo: 'Down Tempo',
      melodichouse: 'Melodic House'
    };

    const response = hotPlaylists.map(playlist => ({
      ...playlist,
      categoryDisplayName: categoryDisplayNames[playlist.mainCategory] || playlist.mainCategory
    }));

    res.json({
      success: true,
      hotPlaylists: response,
      message: 'Her kategoriden en son eklenen admin playlist\'ler'
    });
  } catch (err) {
    console.error('Error fetching hot playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'HOT playlist\'ler yüklenirken hata oluştu',
      error: err.message 
    });
  }
};

// Kategoriye göre HOT playlist getir
exports.getHotPlaylistByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
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
};

// HOT istatistikleri
exports.getHotStats = async (req, res) => {
  try {
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
};