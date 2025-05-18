const express = require('express');
const db = require('../db');
const router = express.Router();

// Search for users
router.get('/users', (req, res) => {
  const query = req.query.q;
  const userId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  // Get user's blocked users
  db.get('SELECT blocked_users, following FROM users WHERE id = ?', [userId], (err, currentUser) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user data', error: err.message });
    }
    
    const blockedUsers = JSON.parse(currentUser.blocked_users || '[]');
    const following = JSON.parse(currentUser.following || '[]');
    
    // Create placeholders for blocked users
    let blockedPlaceholders = '';
    let params = [`%${query}%`, userId];
    
    if (blockedUsers.length > 0) {
      blockedPlaceholders = 'AND id NOT IN (' + blockedUsers.map(() => '?').join(',') + ')';
      params = params.concat(blockedUsers);
    }
    
    // Search for users
    db.all(
      `SELECT id, username, bio 
       FROM users 
       WHERE (username LIKE ? OR bio LIKE ?) 
       AND id != ?
       ${blockedPlaceholders}
       LIMIT 20`,
      [`%${query}%`, `%${query}%`, userId, ...blockedUsers],
      (err, users) => {
        if (err) {
          return res.status(500).json({ message: 'Error searching users', error: err.message });
        }
        
        // Add is_following flag
        users = users.map(user => ({
          ...user,
          is_following: following.includes(user.id)
        }));
        
        res.json({ users });
      }
    );
  });
});

// Search for posts
router.get('/posts', (req, res) => {
  const query = req.query.q;
  const userId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  // Get user's blocked users
  db.get('SELECT blocked_users FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user data', error: err.message });
    }
    
    const blockedUsers = JSON.parse(user.blocked_users || '[]');
    
    // Create placeholders for blocked users
    let blockedPlaceholders = '';
    let params = [`%${query}%`, userId];
    
    if (blockedUsers.length > 0) {
      blockedPlaceholders = 'AND p.user_id NOT IN (' + blockedUsers.map(() => '?').join(',') + ')';
      params = params.concat(blockedUsers);
    }
    
    // Search for posts
    db.all(
      `SELECT p.*, u.username, 
          (SELECT COUNT(*) FROM post_interactions 
           WHERE post_id = p.id AND interaction_type = 'interested') as interested_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.content LIKE ? 
       AND p.is_archived = 0
       ${blockedPlaceholders}
       ORDER BY p.created_at DESC
       LIMIT 50`,
      params,
      (err, posts) => {
        if (err) {
          return res.status(500).json({ message: 'Error searching posts', error: err.message });
        }
        
        res.json({ posts });
      }
    );
  });
});

// Search for communities
router.get('/communities', (req, res) => {
  const query = req.query.q;
  const userId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  db.all(
    `SELECT 
      c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
      EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) as is_member
    FROM communities c
    WHERE c.name LIKE ? OR c.description LIKE ?
    ORDER BY c.name ASC
    LIMIT 20`,
    [userId, `%${query}%`, `%${query}%`],
    (err, communities) => {
      if (err) {
        return res.status(500).json({ message: 'Error searching communities', error: err.message });
      }
      
      res.json({ communities });
    }
  );
});

// Combined search (users, posts, communities)
router.get('/all', (req, res) => {
  const query = req.query.q;
  const userId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  // Get user's blocked users
  db.get('SELECT blocked_users, following FROM users WHERE id = ?', [userId], (err, currentUser) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user data', error: err.message });
    }
    
    const blockedUsers = JSON.parse(currentUser.blocked_users || '[]');
    const following = JSON.parse(currentUser.following || '[]');
    
    // Create promises for concurrent searches
    const userPromise = new Promise((resolve, reject) => {
      // Search for users
      let blockedPlaceholders = '';
      let params = [`%${query}%`, `%${query}%`, userId];
      
      if (blockedUsers.length > 0) {
        blockedPlaceholders = 'AND id NOT IN (' + blockedUsers.map(() => '?').join(',') + ')';
        params = params.concat(blockedUsers);
      }
      
      db.all(
        `SELECT id, username, bio 
         FROM users 
         WHERE (username LIKE ? OR bio LIKE ?) 
         AND id != ?
         ${blockedPlaceholders}
         LIMIT 5`,
        params,
        (err, users) => {
          if (err) {
            reject(err);
          } else {
            // Add is_following flag
            users = users.map(user => ({
              ...user,
              is_following: following.includes(user.id)
            }));
            
            resolve(users);
          }
        }
      );
    });
    
    const postPromise = new Promise((resolve, reject) => {
      // Search for posts
      let blockedPlaceholders = '';
      let params = [`%${query}%`];
      
      if (blockedUsers.length > 0) {
        blockedPlaceholders = 'AND p.user_id NOT IN (' + blockedUsers.map(() => '?').join(',') + ')';
        params = params.concat(blockedUsers);
      }
      
      db.all(
        `SELECT p.*, u.username, 
            (SELECT COUNT(*) FROM post_interactions 
             WHERE post_id = p.id AND interaction_type = 'interested') as interested_count
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.content LIKE ? 
         AND p.is_archived = 0
         ${blockedPlaceholders}
         ORDER BY p.created_at DESC
         LIMIT 5`,
        params,
        (err, posts) => {
          if (err) {
            reject(err);
          } else {
            resolve(posts);
          }
        }
      );
    });
    
    const communityPromise = new Promise((resolve, reject) => {
      // Search for communities
      db.all(
        `SELECT 
          c.*,
          (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
          EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) as is_member
        FROM communities c
        WHERE c.name LIKE ? OR c.description LIKE ?
        ORDER BY c.name ASC
        LIMIT 5`,
        [userId, `%${query}%`, `%${query}%`],
        (err, communities) => {
          if (err) {
            reject(err);
          } else {
            resolve(communities);
          }
        }
      );
    });
    
    // Combine all search results
    Promise.all([userPromise, postPromise, communityPromise])
      .then(([users, posts, communities]) => {
        res.json({
          users,
          posts,
          communities
        });
      })
      .catch(error => {
        res.status(500).json({ message: 'Error performing search', error: error.message });
      });
  });
});

module.exports = router;
