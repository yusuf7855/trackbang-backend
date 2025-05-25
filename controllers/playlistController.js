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