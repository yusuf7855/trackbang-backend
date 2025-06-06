const Playlist = require('../models/Playlist');

// HOT sayfası için her genre'den son admin playlist'i getir
exports.getHotPlaylists = async (req, res) => {
  try {
    const genres = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const hotPlaylists = [];

    for (const genre of genres) {
      const latestPlaylist = await Playlist.findOne({ 
        genre: genre,
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

      if (latestPlaylist) {
        hotPlaylists.push({
          _id: latestPlaylist._id,
          name: latestPlaylist.name,
          description: latestPlaylist.description || '',
          genre: latestPlaylist.genre,
          subCategory: latestPlaylist.subCategory,
          musicCount: latestPlaylist.musics?.length || 0,
          owner: {
            _id: latestPlaylist.userId?._id || 'admin',
            username: latestPlaylist.userId?.username || 'admin',
            displayName: latestPlaylist.userId ? 
              `${latestPlaylist.userId.firstName} ${latestPlaylist.userId.lastName}` : 
              'Admin User',
            profileImage: latestPlaylist.userId?.profileImage || null
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
      } else {
        // Eğer bu genre için playlist yoksa boş bir entry ekle
        hotPlaylists.push({
          genre: genre,
          name: null,
          isEmpty: true,
          musics: []
        });
      }
    }

    // Genre'ler için display name mapping
    const genreDisplayNames = {
      afrohouse: 'Afro House',
      indiedance: 'Indie Dance', 
      organichouse: 'Organic House',
      downtempo: 'Down Tempo',
      melodichouse: 'Melodic House'
    };

    const response = hotPlaylists.map(playlist => ({
      ...playlist,
      genreDisplayName: genreDisplayNames[playlist.genre] || playlist.genre
    }));

    res.json({
      success: true,
      hotPlaylists: response,
      message: 'Her genre\'den en son eklenen admin playlist\'ler'
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

// Belirli bir genre'nin en son playlist'ini getir
exports.getLatestPlaylistByGenre = async (req, res) => {
  try {
    const { genre } = req.params;
    
    const latestPlaylist = await Playlist.findOne({ 
      genre: genre,
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
        message: `${genre} genre'sinde henüz admin playlist bulunamadı`
      });
    }

    const genreDisplayNames = {
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
      genre: latestPlaylist.genre,
      subCategory: latestPlaylist.subCategory,
      genreDisplayName: genreDisplayNames[latestPlaylist.genre] || latestPlaylist.genre,
      musicCount: latestPlaylist.musics?.length || 0,
      owner: {
        _id: latestPlaylist.userId?._id || 'admin',
        username: latestPlaylist.userId?.username || 'admin',
        displayName: latestPlaylist.userId ? 
          `${latestPlaylist.userId.firstName} ${latestPlaylist.userId.lastName}` : 
          'Admin User',
        profileImage: latestPlaylist.userId?.profileImage || null
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
      playlist: response
    });
  } catch (err) {
    console.error('Error fetching latest playlist by genre:', err);
    res.status(500).json({ 
      success: false,
      message: 'Latest playlist yüklenirken hata oluştu',
      error: err.message 
    });
  }
};

// Genre'ye göre HOT playlist getir (eski fonksiyon - geriye uyumluluk için)
exports.getHotPlaylistByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    return exports.getLatestPlaylistByGenre(req, res);
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
    const genres = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const stats = {};

    for (const genre of genres) {
      const totalPlaylists = await Playlist.countDocuments({ 
        genre: genre,
        isAdminPlaylist: true,
        isPublic: true 
      });

      const latestPlaylist = await Playlist.findOne({ 
        genre: genre,
        isAdminPlaylist: true,
        isPublic: true 
      })
        .select('createdAt name subCategory')
        .sort({ createdAt: -1 });

      stats[genre] = {
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