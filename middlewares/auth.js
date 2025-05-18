const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'innovate-secret-key');
    
    // Add user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    return res.status(401).json({ message: 'Invalid token' });
  }
};
