const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'message-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function(req, file, cb) {
    // Allow more file types for messages
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt)$/)) {
      return cb(new Error('Only images and documents are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get all conversations for current user
router.get('/conversations', (req, res) => {
  const userId = req.user.id;
  
  // This query gets the latest message for each conversation
  const query = `
    SELECT 
      CASE 
        WHEN m.sender_id = ? THEN m.receiver_id 
        ELSE m.sender_id 
      END as contact_id,
      u.username as contact_name,
      m.content as last_message,
      m.created_at as last_message_time,
      (SELECT COUNT(*) FROM messages 
       WHERE sender_id = contact_id 
       AND receiver_id = ? 
       AND is_read = 0) as unread_count
    FROM messages m
    JOIN users u ON (
      CASE 
        WHEN m.sender_id = ? THEN m.receiver_id 
        ELSE m.sender_id 
      END = u.id
    )
    WHERE (m.sender_id = ? OR m.receiver_id = ?)
    AND m.id IN (
      SELECT MAX(id) FROM messages
      WHERE (sender_id = ? AND receiver_id = contact_id)
      OR (sender_id = contact_id AND receiver_id = ?)
      GROUP BY 
        CASE 
          WHEN sender_id = ? THEN receiver_id 
          ELSE sender_id 
        END
    )
    ORDER BY m.created_at DESC
  `;
  
  db.all(query, [userId, userId, userId, userId, userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching conversations', error: err.message });
    }
    
    res.json({ conversations });
  });
});

// Get messages for a specific conversation
router.get('/conversation/:contactId', (req, res) => {
  const userId = req.user.id;
  const contactId = req.params.contactId;
  
  // First, check if contact exists
  db.get('SELECT * FROM users WHERE id = ?', [contactId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking user', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get messages
    const query = `
      SELECT m.*, 
        CASE WHEN m.sender_id = ? THEN 1 ELSE 0 END as is_outgoing
      FROM messages m
      WHERE (m.sender_id = ? AND m.receiver_id = ?)
      OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `;
    
    db.all(query, [userId, userId, contactId, contactId, userId], (err, messages) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching messages', error: err.message });
      }
      
      // Mark messages as read
      db.run(
        'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
        [contactId, userId],
        (err) => {
          if (err) {
            console.error('Error marking messages as read:', err.message);
          }
        }
      );
      
      res.json({ 
        messages,
        contact: {
          id: user.id,
          username: user.username
        }
      });
    });
  });
});

// Send a message
router.post('/', upload.single('attachment'), (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.user.id;
  const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!receiverId) {
    return res.status(400).json({ message: 'Receiver ID is required' });
  }
  
  if (!content && !attachmentUrl) {
    return res.status(400).json({ message: 'Message must have content or an attachment' });
  }
  
  // Check if receiver exists
  db.get('SELECT * FROM users WHERE id = ?', [receiverId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking user', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Insert message
    const query = 'INSERT INTO messages (sender_id, receiver_id, content, attachment_url) VALUES (?, ?, ?, ?)';
    
    db.run(query, [senderId, receiverId, content, attachmentUrl], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error sending message', error: err.message });
      }
      
      // Get the sent message
      db.get(
        'SELECT *, 1 as is_outgoing FROM messages WHERE id = ?',
        [this.lastID],
        (err, message) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching sent message', error: err.message });
          }
          
          // Create notification for the receiver
          db.get('SELECT username FROM users WHERE id = ?', [senderId], (err, sender) => {
            if (!err && sender) {
              db.run(
                'INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
                [
                  receiverId,
                  'new_message',
                  `New message from ${sender.username}`,
                  senderId
                ]
              );
            }
          });
          
          res.status(201).json({
            message: 'Message sent successfully',
            data: message
          });
        }
      );
    });
  });
});

// Delete a message
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Check if message exists and belongs to user
  db.get('SELECT * FROM messages WHERE id = ?', [id], (err, message) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking message', error: err.message });
    }
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Only the sender can delete a message completely
    if (message.sender_id === userId) {
      db.run('DELETE FROM messages WHERE id = ?', [id], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error deleting message', error: err.message });
        }
        
        res.json({ message: 'Message deleted successfully' });
      });
    } else if (message.receiver_id === userId) {
      // Receiver can only hide the message for themselves (not implemented here)
      res.status(403).json({ message: 'Only the sender can delete a message' });
    } else {
      res.status(403).json({ message: 'You do not have permission to delete this message' });
    }
  });
});

// Mark message as read
router.put('/:id/read', (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Check if message is addressed to the current user
  db.get('SELECT * FROM messages WHERE id = ? AND receiver_id = ?', [id, userId], (err, message) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking message', error: err.message });
    }
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found or not addressed to you' });
    }
    
    // Mark as read
    db.run('UPDATE messages SET is_read = 1 WHERE id = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error marking message as read', error: err.message });
      }
      
      res.json({ message: 'Message marked as read' });
    });
  });
});

module.exports = router;
