// controllers/musicController.js - Tam ve güncellenmiş version
const Music = require('../models/Music');
const Playlist = require('../models/Playlist');

// Tüm müzikleri getir
exports.getAllMusic = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, sort = 'newest' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    if (category) {
      query.category = category;
    }
    
    let sortQuery = {};
    switch (sort) {
      case 'likes':
        sortQuery = { likes: -1 };
        break;
      case 'oldest':
        sortQuery = { createdAt: 1 };
        break;
      case 'newest':
      default:
        sortQuery = { createdAt: -1 };
        break;
    }
    
    const music = await Music.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Music.countDocuments(query);
    
    res.json({
      success: true,
      music,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: skip + music.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching all music:', err);
    res.status(500).json({ 
      success: false,
      message: 'Müzikler getirilemedi',
      error: err.message 
    });
  }
};

// Kategoriye göre müzik getir
exports.getMusicByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const validCategories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Geçersiz kategori' 
      });
    }
    
    const music = await Music.find({ category })
      .sort({ likes: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Music.countDocuments({ category });
    
    res.json({
      success: true,
      category,
      music,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: skip + music.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching music by category:', err);
    res.status(500).json({ 
      success: false,
      message: 'Kategori müzikleri getirilemedi',
      error: err.message 
    });
  }
};

// Çoklu sanatçı desteği ile müzik ekleme
exports.addMusic = async (req, res) => {
  try {
    const { spotifyId, title, artists, beatportUrl, category } = req.body;

    // Validation
    if (!spotifyId || !title || !artists || !beatportUrl || !category) {
      return res.status(400).json({ 
        success: false,
        message: 'Tüm alanlar gerekli (spotifyId, title, artists, beatportUrl, category)' 
      });
    }

    // Kategori kontrolü
    const validCategories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ 
        success: false,
        message: 'Geçersiz kategori. Geçerli kategoriler: ' + validCategories.join(', ')
      });
    }

    // Artists'i array'e çevir
    let artistsArray = [];
    if (typeof artists === 'string') {
      // Virgül, & veya "feat" ile ayrılmış sanatçıları parse et
      artistsArray = artists
        .split(/[,&]|feat\.?|ft\.?|featuring/i)
        .map(artist => artist.trim())
        .filter(artist => artist.length > 0);
    } else if (Array.isArray(artists)) {
      artistsArray = artists.map(artist => artist.trim()).filter(artist => artist.length > 0);
    } else {
      return res.status(400).json({ 
        success: false,
        message: 'Artists string veya array olmalı' 
      });
    }

    if (artistsArray.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'En az bir sanatçı gerekli' 
      });
    }

    // Spotify ID kontrolü
    const existingMusic = await Music.findOne({ spotifyId });
    if (existingMusic) {
      return res.status(400).json({ 
        success: false,
        message: 'Bu Spotify ID zaten mevcut' 
      });
    }

    console.log('Creating music with artists:', artistsArray); // Debug

    const newMusic = new Music({ 
      spotifyId: spotifyId.trim(), 
      title: title.trim(),
      artists: artistsArray,
      beatportUrl: beatportUrl.trim(), 
      category 
    });

    await newMusic.save();
    
    console.log('Music created successfully:', newMusic._id); // Debug
    
    res.status(201).json({
      success: true,
      message: 'Müzik başarıyla eklendi',
      music: newMusic
    });
  } catch (err) {
    console.error('Error adding music:', err);
    
    if (err.code === 11000) {
      res.status(400).json({ 
        success: false,
        message: 'Bu Spotify ID zaten mevcut' 
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: err.message 
      });
    }
  }
};

// Müzik güncelle
exports.updateMusic = async (req, res) => {
  try {
    const { artists, category, ...otherFields } = req.body;
    
    let updateData = { ...otherFields };
    
    // Kategori kontrolü
    if (category) {
      const validCategories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ 
          success: false,
          message: 'Geçersiz kategori. Geçerli kategoriler: ' + validCategories.join(', ')
        });
      }
      updateData.category = category;
    }
    
    // Artists güncellemesi
    if (artists) {
      let artistsArray = [];
      if (typeof artists === 'string') {
        artistsArray = artists
          .split(/[,&]|feat\.?|ft\.?|featuring/i)
          .map(artist => artist.trim())
          .filter(artist => artist.length > 0);
      } else if (Array.isArray(artists)) {
        artistsArray = artists.map(artist => artist.trim()).filter(artist => artist.length > 0);
      }
      
      if (artistsArray.length > 0) {
        updateData.artists = artistsArray;
      }
    }
    
    const updatedMusic = await Music.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!updatedMusic) {
      return res.status(404).json({ 
        success: false,
        message: 'Müzik bulunamadı' 
      });
    }
    
    res.json({
      success: true,
      message: 'Müzik başarıyla güncellendi',
      music: updatedMusic
    });
  } catch (err) {
    console.error('Error updating music:', err);
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Müzik sil
exports.deleteMusic = async (req, res) => {
  try {
    const musicId = req.params.id;
    
    const deletedMusic = await Music.findByIdAndDelete(musicId);
    
    if (!deletedMusic) {
      return res.status(404).json({ 
        success: false,
        message: 'Müzik bulunamadı' 
      });
    }
    
    // Playlist'lerden de sil
    await Playlist.updateMany(
      { musics: musicId },
      { $pull: { musics: musicId } }
    );
    
    res.json({ 
      success: true,
      message: 'Müzik başarıyla silindi ve playlist\'lerden kaldırıldı' 
    });
  } catch (err) {
    console.error('Error deleting music:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Gelişmiş müzik arama - sanatçı adları da dahil
exports.searchMusic = async (req, res) => {
  try {
    const { query, category, limit = 50 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Arama terimi en az 2 karakter olmalı' 
      });
    }

    let searchQuery = {
      $or: [
        { $text: { $search: query } },
        { artists: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
        { artist: { $regex: query, $options: 'i' } } // Backward compatibility
      ]
    };
    
    // Kategori filtresi
    if (category) {
      searchQuery.category = category;
    }

    const results = await Music.find(searchQuery)
      .sort({ 
        score: { $meta: "textScore" },
        likes: -1 
      })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      query,
      category: category || 'all',
      count: results.length,
      music: results
    });
  } catch (err) {
    console.error('Search music error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Arama sırasında hata oluştu',
      error: err.message 
    });
  }
};

// Sanatçıya göre müzik arama
exports.searchByArtist = async (req, res) => {
  try {
    const { artist, category, limit = 100 } = req.query;
    
    if (!artist || artist.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Sanatçı adı en az 2 karakter olmalı' 
      });
    }

    let searchQuery = {
      $or: [
        { artists: { $regex: artist, $options: 'i' } },
        { artist: { $regex: artist, $options: 'i' } } // Backward compatibility
      ]
    };
    
    if (category) {
      searchQuery.category = category;
    }

    const results = await Music.find(searchQuery)
      .sort({ likes: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      artist,
      category: category || 'all',
      count: results.length,
      music: results
    });
  } catch (err) {
    console.error('Artist search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Sanatçı araması sırasında hata oluştu',
      error: err.message 
    });
  }
};

// Top 10 by category
exports.getTop10ByCategory = async (req, res) => {
  try {
    const results = {};
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    
    for (const category of categories) {
      const music = await Music.find({ category })
        .sort({ likes: -1, createdAt: -1 })
        .limit(10)
        .lean();
      
      results[category] = music;
    }
    
    res.json({
      success: true,
      results
    });
  } catch (err) {
    console.error('Error fetching top 10:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Müzik beğenme/beğenmeme
exports.likeMusic = async (req, res) => {
  try {
    const { userId } = req.body;
    const musicId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID gerekli' 
      });
    }
    
    const music = await Music.findById(musicId);
    
    if (!music) {
      return res.status(404).json({ 
        success: false,
        message: 'Müzik bulunamadı' 
      });
    }

    const userIndex = music.userLikes.indexOf(userId);
    let isLiked = false;
    
    if (userIndex === -1) {
      // Like ekle
      music.userLikes.push(userId);
      music.likes += 1;
      isLiked = true;
    } else {
      // Like kaldır
      music.userLikes.splice(userIndex, 1);
      music.likes = Math.max(0, music.likes - 1); // Negatif olmayı önle
      isLiked = false;
    }

    await music.save();
    
    res.json({
      success: true,
      message: isLiked ? 'Müzik beğenildi' : 'Beğeni kaldırıldı',
      music: {
        _id: music._id,
        likes: music.likes,
        userLikes: music.userLikes
      },
      isLiked
    });
  } catch (err) {
    console.error('Error liking music:', err);
    res.status(400).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Müziği playlist'e ekle
exports.addToPlaylist = async (req, res) => {
  try {
    const { playlistId, userId } = req.body;
    const musicId = req.params.id;

    if (!playlistId || !userId) {
      return res.status(400).json({ 
        success: false,
        message: 'Playlist ID ve User ID gerekli' 
      });
    }

    // Müzik var mı kontrol et
    const music = await Music.findById(musicId);
    if (!music) {
      return res.status(404).json({ 
        success: false,
        message: 'Müzik bulunamadı' 
      });
    }

    // Playlist var mı ve kullanıcıya ait mi kontrol et
    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
      return res.status(403).json({ 
        success: false,
        message: 'Playlist bulunamadı veya yetkiniz yok' 
      });
    }

    // Müzik zaten playlist'te mi kontrol et
    if (playlist.musics.includes(musicId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Müzik zaten playlist\'te mevcut' 
      });
    }

    // Müziği playlist'e ekle
    playlist.musics.push(musicId);
    await playlist.save();

    res.json({
      success: true,
      message: 'Müzik playlist\'e başarıyla eklendi',
      playlist: {
        id: playlist._id,
        name: playlist.name,
        musicCount: playlist.musics.length
      }
    });
  } catch (err) {
    console.error('Error adding to playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Playlist\'e ekleme sırasında hata oluştu',
      error: err.message 
    });
  }
};

// Private content arama (kullanıcının kendi içerikleri)
exports.searchPrivateContent = async (req, res) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Arama terimi en az 2 karakter olmalı' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID gerekli' 
      });
    }

    // Müzik arama
    const musicResults = await Music.find({
      $or: [
        { $text: { $search: query } },
        { artists: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ score: { $meta: "textScore" }, likes: -1 })
    .limit(20)
    .lean();
    
    // Kullanıcının private playlist'lerinde arama
    const playlistResults = await Playlist.find({
      userId,
      isPublic: false,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    })
    .populate('musics', 'title artist artists spotifyId')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    res.json({
      success: true,
      query,
      music: musicResults,
      playlists: playlistResults
    });
  } catch (err) {
    console.error('Private search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Private içerik araması sırasında hata oluştu',
      error: err.message 
    });
  }
};

// Public content arama
exports.searchPublicContent = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Arama terimi en az 2 karakter olmalı' 
      });
    }

    // Müzik arama
    const musicResults = await Music.find({
      $or: [
        { $text: { $search: query } },
        { artists: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ score: { $meta: "textScore" }, likes: -1 })
    .limit(20)
    .lean();
    
    // Public playlist'lerde arama
    const playlistResults = await Playlist.find({
      isPublic: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    })
    .populate('userId', 'username firstName lastName')
    .populate('musics', 'title artist artists spotifyId')
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

    res.json({
      success: true,
      query,
      music: musicResults,
      playlists: playlistResults
    });
  } catch (err) {
    console.error('Public search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Public içerik araması sırasında hata oluştu',
      error: err.message 
    });
  }
};

// Müzik ve playlist birlikte arama
exports.searchMusicAndPlaylists = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Arama terimi en az 2 karakter olmalı' 
      });
    }

    // Paralel olarak hem müzik hem playlist ara
    const [musicResults, playlistResults] = await Promise.all([
      Music.find({
        $or: [
          { $text: { $search: query } },
          { artists: { $regex: query, $options: 'i' } },
          { title: { $regex: query, $options: 'i' } }
        ]
      })
      .sort({ score: { $meta: "textScore" }, likes: -1 })
      .limit(25)
      .lean(),
      
      Playlist.find({
        isPublic: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      })
      .populate('userId', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean()
    ]);

    res.json({
      success: true,
      query,
      music: musicResults,
      playlists: playlistResults,
      totalResults: musicResults.length + playlistResults.length
    });
  } catch (err) {
    console.error('Combined search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Arama sırasında hata oluştu',
      error: err.message 
    });
  }
};