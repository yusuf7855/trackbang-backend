// controllers/searchController.js - Yeni unified search controller
const User = require('../models/userModel');
const Playlist = require('../models/Playlist');
const Music = require('../models/Music');

// Genel arama fonksiyonu - kullanıcı, playlist ve müzik arama
exports.searchAll = async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Search query must be at least 2 characters long' 
      });
    }

    const searchTerm = query.trim();
    let results = {};

    // Type belirtilmemişse veya 'all' ise tümünü ara
    if (!type || type === 'all') {
      const [users, playlists, musics] = await Promise.all([
        searchUsers(searchTerm),
        searchPlaylists(searchTerm),
        searchMusics(searchTerm)
      ]);
      
      results = {
        users: users.slice(0, 5), // İlk 5 kullanıcı
        playlists: playlists.slice(0, 10), // İlk 10 playlist
        musics: musics.slice(0, 10) // İlk 10 müzik
      };
    } else {
      // Spesifik tip arama
      switch (type) {
        case 'users':
          results.users = await searchUsers(searchTerm);
          break;
        case 'playlists':
          results.playlists = await searchPlaylists(searchTerm);
          break;
        case 'musics':
          results.musics = await searchMusics(searchTerm);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid search type'
          });
      }
    }

    res.json({
      success: true,
      query: searchTerm,
      results
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({
      success: false,
      message: 'Arama sırasında bir hata oluştu',
      error: err.message
    });
  }
};

// Kullanıcı arama fonksiyonu
async function searchUsers(searchTerm) {
  return await User.find({
    $or: [
      { username: { $regex: searchTerm, $options: 'i' } },
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } },
      { 
        $expr: {
          $regexMatch: {
            input: { $concat: ["$firstName", " ", "$lastName"] },
            regex: searchTerm,
            options: "i"
          }
        }
      }
    ]
  })
  .select('username firstName lastName profileImage bio followers following')
  .limit(20)
  .lean()
  .then(users => users.map(user => ({
    ...user,
    type: 'user',
    profileImage: user.profileImage && user.profileImage !== 'image.jpg' 
      ? user.profileImage 
      : null,
    followerCount: user.followers?.length || 0,
    followingCount: user.following?.length || 0
  })));
}

// Playlist arama fonksiyonu
async function searchPlaylists(searchTerm) {
  return await Playlist.find({
    $and: [
      {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      },
      {
        $or: [
          { isPublic: true }, // Public playlist'ler
          { isAdminPlaylist: true } // Admin playlist'leri
        ]
      }
    ]
  })
  .populate({
    path: 'userId',
    select: 'username firstName lastName profileImage'
  })
  .populate({
    path: 'musics',
    select: 'title artist',
    options: { limit: 3 } // Sadece ilk 3 müziği göster
  })
  .sort({ createdAt: -1 })
  .limit(20)
  .lean()
  .then(playlists => playlists.map(playlist => ({
    ...playlist,
    type: 'playlist',
    musicCount: playlist.musics?.length || 0,
    owner: playlist.userId ? {
      _id: playlist.userId._id,
      username: playlist.userId.username,
      firstName: playlist.userId.firstName,
      lastName: playlist.userId.lastName,
      profileImage: playlist.userId.profileImage && playlist.userId.profileImage !== 'image.jpg' 
        ? playlist.userId.profileImage 
        : null
    } : null,
    previewMusics: playlist.musics?.slice(0, 3) || []
  })));
}

// Müzik arama fonksiyonu - Çoklu sanatçı desteği ile
async function searchMusics(searchTerm) {
  return await Music.find({
    $or: [
      { title: { $regex: searchTerm, $options: 'i' } },
      { artist: { $regex: searchTerm, $options: 'i' } }, // Backward compatibility
      { artists: { $regex: searchTerm, $options: 'i' } } // Yeni çoklu sanatçı desteği
    ]
  })
  .select('title artist artists category likes userLikes beatportUrl spotifyId')
  .sort({ likes: -1 }) // En çok beğenilenden sırala
  .limit(20)
  .lean()
  .then(musics => musics.map(music => ({
    ...music,
    type: 'music',
    likeCount: music.likes || 0,
    // Display sanatçıları - yeni sistem varsa onu kullan, yoksa eski sistemi
    displayArtists: music.artists && music.artists.length > 0 
      ? music.artists.join(', ') 
      : music.artist || 'Unknown Artist'
  })));
}

// Kullanıcının kendi private playlist'lerinde arama
exports.searchUserPrivatePlaylists = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.userId; // Auth middleware'den

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const playlists = await Playlist.find({
      userId: userId,
      isAdminPlaylist: false,
      isPublic: false,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    })
    .populate({
      path: 'musics',
      select: 'title artist spotifyId category likes userLikes beatportUrl',
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    res.json({
      success: true,
      results: {
        privatePlaylists: playlists.map(playlist => ({
          ...playlist,
          type: 'private_playlist',
          musicCount: playlist.musics?.length || 0
        }))
      }
    });

  } catch (err) {
    console.error('Error searching private playlists:', err);
    res.status(500).json({
      success: false,
      message: 'Private playlist arama hatası',
      error: err.message
    });
  }
};