document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId) {
    // Redirect to login if not logged in
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
      window.location.href = 'login.html';
    }
    return;
  }
  
  // Force username loading at the very top
  (function fixUsername() {
    const username = localStorage.getItem('username');
    const profileName = document.querySelector('.profile-name');
    
    if (profileName) {
      // Force username into profile display
      if (!username || username === 'undefined') {
        // Try to reload username from API
        fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        .then(res => res.json())
        .then(data => {
          if (data.user && data.user.username) {
            localStorage.setItem('username', data.user.username);
            profileName.textContent = data.user.username;
          } else {
            profileName.textContent = 'My Profile';
          }
        })
        .catch(err => {
          console.error("Error fetching username:", err);
          profileName.textContent = 'My Profile';
        });
      } else {
        profileName.textContent = username;
      }
    }
  })();
  
  // Update profile name in navigation
  const profileName = document.querySelector('.profile-name');
  if (profileName) {
    profileName.textContent = username;
  }
  
  // Add notification indicator if needed
  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    // Add notification bell to navigation
    if (!document.querySelector('.notification-bell')) {
      const notificationLi = document.createElement('li');
      notificationLi.innerHTML = `
        <a href="notifications.html" class="notification-bell">
          <i class="fas fa-bell"></i>
          <span class="notification-badge hidden">0</span>
        </a>
      `;
      navLinks.appendChild(notificationLi);
    }
    
    // Get unread notification count
    fetchUnreadNotificationCount();
  }
  
  // Add logout button (direct approach)
  const navProfile = document.querySelector('.nav-profile');
  if (navProfile) {
    // Create wrapper for profile and logout
    const navActions = document.createElement('div');
    navActions.className = 'nav-actions';
    
    // Move existing profile link into wrapper
    const profileLink = document.getElementById('profile-link');
    if (profileLink) {
      navProfile.innerHTML = '';
      navActions.appendChild(profileLink);
    }
    
    // Add logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'logout-btn';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    logoutBtn.addEventListener('click', function() {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      
      // Redirect to login
      window.location.href = 'login.html';
    });
    
    navActions.appendChild(logoutBtn);
    navProfile.appendChild(navActions);
  }
  
  // Fetch unread notification count
  async function fetchUnreadNotificationCount() {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        updateNotificationBadge(data.count);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  }
  
  // Update notification badge
  function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }
  
  // Check if token is valid (can be done periodically)
  checkTokenValidity();
  
  async function checkTokenValidity() {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.valid) {
          // Token is invalid or expired, log out
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('username');
          
          if (!window.location.pathname.includes('login.html') && 
              !window.location.pathname.includes('register.html')) {
            window.location.href = 'login.html';
          }
        }
      } else {
        // Error with verification, likely token is invalid
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html')) {
          window.location.href = 'login.html';
        }
      }
    } catch (error) {
      console.error('Error verifying token:', error);
    }
  }
});
