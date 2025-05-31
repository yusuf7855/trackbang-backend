const Playlist = require('../models/Playlist');
const Music = require('../models/Music');

// Admin panel için kategori playlist'i oluşturma - Authentication YOK
exports.createAdminPlaylist = async (req, res) => {
  try {
    const { name, description, mainCategory, subCategory, musicIds } = req.body;
    
    // Admin playlist'ler için sabit admin user ID (opsiyonel)
    const adminUserId = '507f1f77bcf86cd799439011';

    console.log('Creating admin playlist:', { name, mainCategory, subCategory, musicIds }); // Debug log

    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Playlist name is required' 
      });
    }

    if (!mainCategory) {
      return res.status(400).json({ 
        success: false,
        message: 'Main category is required' 
      });
    }

    if (!subCategory) {
      return res.status(400).json({ 
        success: false,
        message: 'Sub category is required' 
      });
    }

    // Müziklerin varlığını kontrol et
    if (musicIds && musicIds.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musicIds } });
      if (existingMusics.length !== musicIds.length) {
        return res.status(400).json({ 
          success: false,
          message: 'Some music tracks do not exist' 
        });
      }

      // Eklenen müziklerin kategorilerini ana kategori ile aynı yap
      await Music.updateMany(
        { _id: { $in: musicIds } },
        { category: mainCategory }
      );
    }

    const newPlaylist = new Playlist({
      name,
      description: description || '',
      userId: adminUserId, // Sabit admin ID
      mainCategory,
      subCategory: subCategory.toUpperCase(),
      musics: musicIds || [],
      isAdminPlaylist: true,
      isPublic: true
    });

    await newPlaylist.save();
    
    console.log('Admin playlist created successfully:', newPlaylist._id); // Debug log
    
    res.status(201).json({
      success: true,
      playlist: {
        _id: newPlaylist._id,
        name: newPlaylist.name,
        description: newPlaylist.description,
        mainCategory: newPlaylist.mainCategory,
        subCategory: newPlaylist.subCategory,
        musicCount: newPlaylist.musics.length,
        createdAt: newPlaylist.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating admin playlist:', err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Bu kategori ve alt kategori kombinasyonu zaten mevcut',
        error: 'Duplicate category combination' 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Error creating admin playlist',
      error: err.message 
    });
  }
};

// Kullanıcılar için normal playlist oluşturma (mobil app'ten) - Authentication ZORUNLU
exports.createUserPlaylist = async (req, res) => {
  try {
    const { name, description, genre, isPublic, musicIds } = req.body;
    const userId = req.userId; // Authentication middleware'den gelir

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required for user playlists' 
      });
    }

    if (!name) {
      return res.status(400).json({ 
        success: false,
        message: 'Playlist name is required' 
      });
    }

    if (!genre) {
      return res.status(400).json({ 
        success: false,
        message: 'Genre is required' 
      });
    }

    const newPlaylist = new Playlist({
      name,
      description: description || '',
      userId,
      genre,
      isPublic: isPublic || false,
      musics: musicIds || [],
      isAdminPlaylist: false
    });

    await newPlaylist.save();
    
    res.status(201).json({
      success: true,
      playlist: {
        _id: newPlaylist._id,
        name: newPlaylist.name,
        genre: newPlaylist.genre,
        isPublic: newPlaylist.isPublic,
        musicCount: newPlaylist.musics.length,
        createdAt: newPlaylist.createdAt
      }
    });
  } catch (err) {
    console.error('Error creating user playlist:', err);
    res.status(400).json({ 
      success: false,
      message: 'Error creating user playlist',
      error: err.message 
    });
  }
};

// Kategoriye göre admin playlist'leri getir (mobil app için)
exports.getPlaylistsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const playlists = await Playlist.find({ 
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
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Playlist.countDocuments({ 
      mainCategory: category,
      isAdminPlaylist: true,
      isPublic: true 
    });

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        mainCategory: playlist.mainCategory,
        subCategory: playlist.subCategory,
        musicCount: playlist.musics?.length || 0,
        owner: {
          _id: playlist.userId._id,
          username: playlist.userId.username,
          displayName: `${playlist.userId.firstName} ${playlist.userId.lastName}`,
          profileImage: playlist.userId.profileImage || null
        },
        musics: playlist.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: playlist.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: skip + playlists.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching playlists by category:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching playlists by category',
      error: err.message 
    });
  }
};

// Kullanıcının playlist'lerini getir (sadece kullanıcı playlist'leri)
exports.getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ 
      userId: req.params.userId,
      isAdminPlaylist: false // Sadece kullanıcı playlist'leri
    })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .lean();

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        genre: playlist.genre,
        isPublic: playlist.isPublic,
        musicCount: playlist.musics?.length || 0,
        musics: playlist.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: playlist.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching user playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user playlists',
      error: err.message 
    });
  }
};

// Admin paneli için sadece admin playlist'leri getir
exports.getAllAdminPlaylists = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let filter = { isAdminPlaylist: true };
    if (category && category !== 'all') {
      filter.mainCategory = category;
    }

    const playlists = await Playlist.find(filter)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Playlist.countDocuments(filter);

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        mainCategory: playlist.mainCategory,
        subCategory: playlist.subCategory,
        musicCount: playlist.musics?.length || 0,
        owner: {
          _id: 'admin',
          username: 'admin',
          displayName: 'Admin User',
        },
        musics: playlist.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: playlist.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: skip + playlists.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching admin playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching admin playlists',
      error: err.message 
    });
  }
};

// Admin playlist güncelleme - Authentication YOK
exports.updateAdminPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, musicIds } = req.body;

    console.log('Updating admin playlist:', id, { name, description, musicIds }); // Debug log

    const playlist = await Playlist.findOne({ _id: id, isAdminPlaylist: true });
    if (!playlist) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin playlist not found' 
      });
    }

    // Müziklerin varlığını kontrol et
    if (musicIds && musicIds.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musicIds } });
      if (existingMusics.length !== musicIds.length) {
        return res.status(400).json({ 
          success: false,
          message: 'Some music tracks do not exist' 
        });
      }

      // Eklenen müziklerin kategorilerini ana kategori ile aynı yap
      await Music.updateMany(
        { _id: { $in: musicIds } },
        { category: playlist.mainCategory }
      );
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(musicIds && { musics: musicIds })
      },
      { new: true }
    );

    res.json({
      success: true,
      playlist: {
        _id: updatedPlaylist._id,
        name: updatedPlaylist.name,
        description: updatedPlaylist.description,
        mainCategory: updatedPlaylist.mainCategory,
        subCategory: updatedPlaylist.subCategory,
        musicCount: updatedPlaylist.musics.length,
        createdAt: updatedPlaylist.createdAt
      }
    });
  } catch (err) {
    console.error('Error updating admin playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating admin playlist',
      error: err.message 
    });
  }
};

// Admin playlist silme - Authentication YOK
exports.deleteAdminPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Deleting admin playlist:', id); // Debug log
    
    // Sadece admin playlist'i sil
    const deletedPlaylist = await Playlist.findOneAndDelete({ 
      _id: id, 
      isAdminPlaylist: true 
    });
    
    if (!deletedPlaylist) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin playlist not found' 
      });
    }

    console.log('Admin playlist deleted successfully:', id); // Debug log

    res.json({
      success: true,
      message: 'Admin playlist deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting admin playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting admin playlist',
      error: err.message 
    });
  }
};

// User playlist silme - Authentication ZORUNLU
exports.deleteUserPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // Authentication middleware'den gelir
    
    console.log('Deleting user playlist:', id, 'by user:', userId); // Debug log
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }

    // Sadece kendi playlist'ini silebilir
    const deletedPlaylist = await Playlist.findOneAndDelete({ 
      _id: id, 
      userId: userId,
      isAdminPlaylist: false 
    });
    
    if (!deletedPlaylist) {
      return res.status(404).json({ 
        success: false,
        message: 'User playlist not found or unauthorized' 
      });
    }

    console.log('User playlist deleted successfully:', id); // Debug log

    res.json({
      success: true,
      message: 'User playlist deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting user playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting user playlist',
      error: err.message 
    });
  }
};

// Kullanıcılar için public playlist'ler (hem admin hem user - mobil app için)
exports.getPublicPlaylists = async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = { isPublic: true };
    
    // Sadece user playlist'leri isteniyor
    if (type === 'user') {
      filter.isAdminPlaylist = false;
    }
    // Sadece admin playlist'leri isteniyor  
    else if (type === 'admin') {
      filter.isAdminPlaylist = true;
    }
    // Her ikisi de (default)

    const playlists = await Playlist.find(filter)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
        options: { limit: 10 }
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName profileImage'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Playlist.countDocuments(filter);

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        type: playlist.isAdminPlaylist ? 'admin' : 'user',
        // Admin playlist alanları
        mainCategory: playlist.mainCategory,
        subCategory: playlist.subCategory,
        // User playlist alanları
        genre: playlist.genre,
        musicCount: playlist.musics?.length || 0,
        owner: {
          _id: playlist.userId._id,
          username: playlist.userId.username,
          displayName: `${playlist.userId.firstName} ${playlist.userId.lastName}`,
          profileImage: playlist.userId.profileImage || null
        },
        musics: playlist.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: playlist.createdAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        hasMore: skip + playlists.length < total
      }
    });
  } catch (err) {
    console.error('Error fetching public playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching public playlists',
      error: err.message 
    });
  }
};

// HOT sayfası için her kategoriden son admin playlist
exports.getLatestPlaylistsByCategory = async (req, res) => {
  try {
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const latestPlaylists = [];

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
        latestPlaylists.push({
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

    res.json({
      success: true,
      hotPlaylists: latestPlaylists
    });
  } catch (err) {
    console.error('Error fetching latest playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching latest playlists',
      error: err.message 
    });
  }
};