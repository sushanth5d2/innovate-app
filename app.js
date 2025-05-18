require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const db = require('./db');
const authMiddleware = require('./middlewares/auth');

// Routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const messagesRoutes = require('./routes/messages');
const communitiesRoutes = require('./routes/communities');
const eventsRoutes = require('./routes/events');
const usersRoutes = require('./routes/users');
const searchRoutes = require('./routes/search');
const notificationsRoutes = require('./routes/notifications');
const remindersRoutes = require('./routes/reminders'); // Add this line

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(morgan('dev'));
// Increase body parser limits to effectively unlimited
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', authMiddleware, postsRoutes);
app.use('/api/messages', authMiddleware, messagesRoutes);
app.use('/api/communities', authMiddleware, communitiesRoutes);
app.use('/api/events', authMiddleware, eventsRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/search', authMiddleware, searchRoutes);
app.use('/api/notifications', authMiddleware, notificationsRoutes);
app.use('/api/reminders', authMiddleware, remindersRoutes); // Add this line

// Fallback route for SPA - serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection
const connectedUsers = {};

io.on('connection', (socket) => {
  console.log('New socket connection');
  
  // Authenticate socket connection
  socket.on('authenticate', (data) => {
    const userId = data.userId;
    if (userId) {
      console.log(`User ${userId} authenticated socket`);
      connectedUsers[userId] = socket.id;
      socket.userId = userId;
    }
  });
  
  // Handle private messages
  socket.on('private_message', (data) => {
    const receiverId = data.receiverId;
    const senderId = socket.userId;
    
    if (receiverId && connectedUsers[receiverId]) {
      io.to(connectedUsers[receiverId]).emit('new_message', {
        message: data.message,
        senderId: senderId,
        timestamp: new Date()
      });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete connectedUsers[socket.userId];
    }
  });
});

// Send notifications via socket
function sendNotification(userId, notification) {
  if (connectedUsers[userId]) {
    io.to(connectedUsers[userId]).emit('new_notification', notification);
  }
}

// Custom 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Innovate server running on port ${PORT}`);
});

// Export sendNotification for use in other files
module.exports = { sendNotification };
