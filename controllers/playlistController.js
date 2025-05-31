const Playlist = require('../models/Playlist');
const Music = require('../models/Music');

exports.createPlaylist = async (req, res) => {
  try {
    const { name, description, mainCategory, subCategory, musicIds } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Playlist name is required' });
    }

    if (!mainCategory) {
      return res.status(400).json({ message: 'Main category is required' });
    }

    if (!subCategory) {
      return res.status(400).json({ message: 'Sub category is required' });
    }

    // Müziklerin varlığını kontrol et
    if (musicIds && musicIds.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musicIds } });
      if (existingMusics.length !== musicIds.length) {
        return res.status(400).json({ message: 'Some music tracks do not exist' });
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
      userId,
      mainCategory,
      subCategory: subCategory.toUpperCase(),
      musics: musicIds || [],
      isPublic: true // Admin tarafından eklenen playlist'ler otomatik public
    });

    await newPlaylist.save();
    
    const populatedPlaylist = await Playlist.findById(newPlaylist._id)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName',
      });

    res.status(201).json({
      success: true,
      playlist: populatedPlaylist
    });
  } catch (err) {
    console.error('Error creating playlist:', err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: 'Bu kategori ve alt kategori kombinasyonu zaten mevcut',
        error: 'Duplicate category combination' 
      });
    }
    res.status(400).json({ 
      message: 'Error creating playlist',
      error: err.message 
    });
  }
};

exports.getPlaylistsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const playlists = await Playlist.find({ 
      mainCategory: category,
      isPublic: true 
    })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Playlist.countDocuments({ 
      mainCategory: category,
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

// HOT sayfası için her kategoriden son playlist
exports.getLatestPlaylistsByCategory = async (req, res) => {
  try {
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const latestPlaylists = [];

    for (const category of categories) {
      const latestPlaylist = await Playlist.findOne({ 
        mainCategory: category,
        isPublic: true 
      })
        .populate({
          path: 'musics',
          select: 'title artist spotifyId category likes userLikes beatportUrl',
          options: { limit: 10 } // İlk 10 şarkıyı al
        })
        .populate({
          path: 'userId',
          select: 'username firstName lastName'
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

exports.getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.params.userId })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId',
      })
      .lean();

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        mainCategory: playlist.mainCategory,
        subCategory: playlist.subCategory,
        musicCount: playlist.musics?.length || 0,
        musics: playlist.musics?.map(music => ({
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId
        })) || [],
        createdAt: playlist.createdAt
      }))
    });
  } catch (err) {
    console.error('Error fetching playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching playlists',
      error: err.message 
    });
  }
};

exports.getAllPlaylists = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let filter = { isPublic: true };
    if (category && category !== 'all') {
      filter.mainCategory = category;
    }

    const playlists = await Playlist.find(filter)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName'
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
          _id: playlist.userId._id,
          username: playlist.userId.username,
          displayName: `${playlist.userId.firstName} ${playlist.userId.lastName}`,
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
    console.error('Error fetching all playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching all playlists',
      error: err.message 
    });
  }
};

exports.deletePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedPlaylist = await Playlist.findByIdAndDelete(id);
    
    if (!deletedPlaylist) {
      return res.status(404).json({ 
        success: false,
        message: 'Playlist not found' 
      });
    }

    res.json({
      success: true,
      message: 'Playlist deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting playlist',
      error: err.message 
    });
  }
};

exports.updatePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, musicIds } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ 
        success: false,
        message: 'Playlist not found' 
      });
    }

    // Müziklerin varlığını kontrol et
    if (musicIds && musicIds.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musicIds } });
      if (existingMusics.length !== musicIds.length) {
        return res.status(400).json({ message: 'Some music tracks do not exist' });
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
    ).populate({
      path: 'musics',
      select: 'title artist spotifyId category likes userLikes beatportUrl',
    }).populate({
      path: 'userId',
      select: 'username firstName lastName',
    });

    res.json({
      success: true,
      playlist: updatedPlaylist
    });
  } catch (err) {
    console.error('Error updating playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating playlist',
      error: err.message 
    });
  }
};