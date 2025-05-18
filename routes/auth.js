const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validate required fields
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email and password are required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  
  // Validate password length
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }
  
  try {
    // Check if username is already taken
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking username', error: err.message });
      }
      
      if (user) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      
      // Check if email is already registered
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
          return res.status(500).json({ message: 'Error checking email', error: err.message });
        }
        
        if (user) {
          return res.status(400).json({ message: 'Email is already registered' });
        }
        
        // Hash the password
        bcrypt.hash(password, 10, (err, hash) => {
          if (err) {
            return res.status(500).json({ message: 'Error hashing password', error: err.message });
          }
          
          // Create the user
          db.run(
            'INSERT INTO users (username, email, password, following, followers, blocked_users) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, hash, '[]', '[]', '[]'],
            function (err) {
              if (err) {
                return res.status(500).json({ message: 'Error creating user', error: err.message });
              }
              
              // Generate JWT token
              const token = jwt.sign(
                { userId: this.lastID, username },
                process.env.JWT_SECRET || 'innovate-secret-key',
                { expiresIn: '7d' }
              );
              
              res.status(201).json({
                message: 'User registered successfully',
                token,
                user: {
                  id: this.lastID,
                  username,
                  email
                }
              });
            }
          );
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during registration', error: error.message });
  }
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  // Find user by email
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Compare password
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        return res.status(500).json({ message: 'Error verifying password', error: err.message });
      }
      
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'innovate-secret-key',
        { expiresIn: '7d' }
      );
      
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  });
});

// Verify token
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, message: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'innovate-secret-key');
    
    // Check if user exists
    db.get('SELECT id, username, email FROM users WHERE id = ?', 
      [decoded.userId], 
      (err, user) => {
        if (err) {
          return res.status(500).json({ valid: false, message: 'Error verifying token' });
        }
        
        if (!user) {
          return res.status(401).json({ valid: false, message: 'User not found' });
        }
        
        res.json({
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      }
    );
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ valid: false, message: 'Token expired' });
    }
    
    return res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

module.exports = router;
