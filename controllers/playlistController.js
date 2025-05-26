const Playlist = require('../models/Playlist');

exports.createPlaylist = async (req, res) => {
  try {
    const { name, musicId, genre, isPublic } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized access' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Playlist name is required' });
    }

    if (!genre) {
      return res.status(400).json({ message: 'Genre is required' });
    }

    const newPlaylist = new Playlist({
      name,
      userId,
      genre,
      isPublic: isPublic || false,
      musics: musicId ? [musicId] : []
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
    console.error('Error creating playlist:', err);
    res.status(400).json({ 
      message: 'Error creating playlist',
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
        genre: playlist.genre,
        isPublic: playlist.isPublic,
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

exports.getPublicPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId',
      })
      .populate({
        path: 'userId',
        select: 'username', // Include username of the playlist owner
      })
      .lean();

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        genre: playlist.genre,
        musicCount: playlist.musics?.length || 0,
        owner: playlist.userId.username,
        musics: playlist.musics?.map(music => ({
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId
        })) || [],
        createdAt: playlist.createdAt
      }))
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

exports.getPrivatePlaylists = async (req, res) => {
  try {
    // Only allow users to access their own private playlists
    const playlists = await Playlist.find({ 
      userId: req.userId,
      isPublic: false 
    })
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
        genre: playlist.genre,
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
    console.error('Error fetching private playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching private playlists',
      error: err.message 
    });
  }
};


exports.searchPrivatePlaylists = async (req, res) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Search query is required' 
      });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Case insensitive regex search
    const searchRegex = new RegExp(query, 'i');
    
    const results = await Playlist.find({
      userId,
      isPublic: false,
      $or: [
        { name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } }
      ]
    })
    .populate({
      path: 'musics',
      select: 'title artist spotifyId',
    })
    .sort({ name: 1 })
    .lean();

    res.json({
      success: true,
      playlists: results.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        genre: playlist.genre,
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
    console.error('Search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during search',
      error: err.message 
    });
  }
};

// Get public playlists for World tab
exports.getPublicPlaylistsForWorld = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const playlists = await Playlist.find({ 
      isPublic: true 
    })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
        options: { limit: 10 } // Limit musics per playlist for performance
      })
      .populate({
        path: 'userId',
        select: 'username firstName lastName profileImage'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Playlist.countDocuments({ isPublic: true });

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        genre: playlist.genre,
        musicCount: playlist.musics?.length || 0,
        owner: {
          _id: playlist.userId._id,
          username: playlist.userId.username,
          displayName: `${playlist.userId.firstName} ${playlist.userId.lastName}`,
          profileImage: playlist.userId.profileImage
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

// Get following users' playlists for House tab
exports.getFollowingPlaylists = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get user's following list
    const User = require('../models/userModel');
    const user = await User.findById(userId).select('following');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingIds = user.following || [];
    
    if (followingIds.length === 0) {
      return res.json({
        success: true,
        playlists: [],
        pagination: {
          current: parseInt(page),
          total: 0,
          hasMore: false
        }
      });
    }

    const playlists = await Playlist.find({ 
      userId: { $in: followingIds },
      isPublic: true // Only public playlists from following users
    })
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
        options: { limit: 10 } // Limit musics per playlist for performance
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
      userId: { $in: followingIds },
      isPublic: true 
    });

    res.json({
      success: true,
      playlists: playlists.map(playlist => ({
        _id: playlist._id,
        name: playlist.name,
        description: playlist.description || '',
        genre: playlist.genre,
        musicCount: playlist.musics?.length || 0,
        owner: {
          _id: playlist.userId._id,
          username: playlist.userId.username,
          displayName: `${playlist.userId.firstName} ${playlist.userId.lastName}`,
          profileImage: playlist.userId.profileImage
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
    console.error('Error fetching following playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching following playlists',
      error: err.message 
    });
  }
};