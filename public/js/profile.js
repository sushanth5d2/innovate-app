document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }
  
  // Update profile name in navigation
  const profileName = document.querySelector('.profile-name');
  if (profileName) {
    profileName.textContent = username;
  }
  
  // DOM elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const editProfileModal = document.getElementById('edit-profile-modal');
  const editProfileForm = document.getElementById('edit-profile-form');
  const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-modal');
  const profileActions = document.getElementById('profile-actions');
  const userActionMenu = document.getElementById('user-action-menu');
  const postTemplate = document.getElementById('post-template');
  const userCardTemplate = document.getElementById('user-card-template');
  
  // Variables for profile data
  let profileData = null;
  let isOwnProfile = true;
  
  // Get profile ID from URL or default to current user
  const urlParams = new URLSearchParams(window.location.search);
  const profileId = urlParams.get('id') || userId;
  isOwnProfile = profileId === userId;
  
  // Load profile data
  loadProfile(profileId);
  
  // Tab navigation
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      const tabName = this.getAttribute('data-tab');
      this.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // Load data for the selected tab
      if (tabName === 'posts') {
        loadUserPosts(profileId);
      } else if (tabName === 'following') {
        loadFollowing(profileId);
      } else if (tabName === 'followers') {
        loadFollowers(profileId);
      }
    });
  });
  
  // Close modals
  closeModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      editProfileModal.classList.add('hidden');
    });
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target === editProfileModal) {
      editProfileModal.classList.add('hidden');
    }
    
    // Close user action menu
    if (!e.target.closest('#user-action-menu') && !e.target.closest('#user-actions-btn')) {
      userActionMenu.classList.add('hidden');
    }
  });
  
  // Handle edit profile form submission
  editProfileForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const bio = document.getElementById('edit-bio').value;
    const skills = document.getElementById('edit-skills').value;
    const interests = document.getElementById('edit-interests').value;
    
    try {
      const response = await fetch('/api/users/update-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bio,
          skills,
          interests
        })
      });
      
      if (response.ok) {
        // Close modal
        editProfileModal.classList.add('hidden');
        
        // Reload profile
        loadProfile(profileId);
      } else {
        const data = await response.json();
        alert(data.message || 'Error updating profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating your profile');
    }
  });
  
  // Load profile data
  async function loadProfile(id) {
    try {
      // Show loading state
      document.getElementById('profile-username').textContent = 'Loading...';
      
      const response = await fetch(`/api/users/${id === userId ? 'me' : id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from server:', errorData);
        document.getElementById('profile-username').textContent = 'Error loading profile';
        alert(errorData.message || 'Error loading profile');
        return;
      }
      
      const data = await response.json();
      console.log('Profile data received:', data); // Debug log
      
      if (data && data.user) {
        profileData = data.user;
        renderProfile();
      } else {
        console.error('Invalid profile data format:', data);
        document.getElementById('profile-username').textContent = 'Error loading profile';
        alert('Invalid profile data received from server');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      document.getElementById('profile-username').textContent = 'Error loading profile';
      alert('An error occurred while loading the profile: ' + error.message);
    }
  }
  
  // Render profile data
  function renderProfile() {
    if (!profileData) {
      console.error('No profile data to render');
      return;
    }
    
    console.log('Rendering profile with data:', profileData); // Debug log
    
    // Set profile info - with better error handling
    document.getElementById('profile-username').textContent = profileData.username || 'No username';
    document.getElementById('post-count').innerHTML = `<i class="fas fa-file-alt"></i> ${profileData.post_count || 0} posts`;
    
    // Check if following/followers arrays exist before trying to access length
    const followingCount = (profileData.following && Array.isArray(profileData.following)) 
      ? profileData.following.length : 0;
    const followersCount = (profileData.followers && Array.isArray(profileData.followers)) 
      ? profileData.followers.length : 0;
      
    document.getElementById('following-count').innerHTML = `<i class="fas fa-user-friends"></i> ${followingCount} following`;
    document.getElementById('follower-count').innerHTML = `<i class="fas fa-users"></i> ${followersCount} followers`;
    
    // Set bio
    document.getElementById('profile-bio').textContent = profileData.bio || 'No bio available';
    
    // Set skills
    const skillsContainer = document.getElementById('profile-skills');
    if (profileData.skills && profileData.skills.trim().length > 0) {
      const skillsArray = profileData.skills.split(',').map(skill => skill.trim());
      skillsContainer.innerHTML = '';
      
      skillsArray.forEach(skill => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag';
        tagElement.textContent = skill;
        skillsContainer.appendChild(tagElement);
      });
    } else {
      skillsContainer.innerHTML = '<p>No skills listed</p>';
    }
    
    // Set interests
    const interestsContainer = document.getElementById('profile-interests');
    if (profileData.interests && profileData.interests.trim().length > 0) {
      const interestsArray = profileData.interests.split(',').map(interest => interest.trim());
      interestsContainer.innerHTML = '';
      
      interestsArray.forEach(interest => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag';
        tagElement.textContent = interest;
        interestsContainer.appendChild(tagElement);
      });
    } else {
      interestsContainer.innerHTML = '<p>No interests listed</p>';
    }
    
    // Set profile actions
    if (isOwnProfile) {
      profileActions.innerHTML = `
        <button id="edit-profile-btn" class="btn-primary">Edit Profile</button>
      `;
      
      document.getElementById('edit-profile-btn').addEventListener('click', function() {
        // Fill form with current data
        document.getElementById('edit-bio').value = profileData.bio || '';
        document.getElementById('edit-skills').value = profileData.skills || '';
        document.getElementById('edit-interests').value = profileData.interests || '';
        
        // Show modal
        editProfileModal.classList.remove('hidden');
      });
    } else {
      // Check if following
      const isFollowing = profileData.followers.includes(parseInt(userId));
      
      profileActions.innerHTML = `
        <button id="follow-btn" class="btn-primary ${isFollowing ? 'following' : ''}">
          ${isFollowing ? 'Following' : 'Follow'}
        </button>
        <button id="message-btn" class="btn-outline">Message</button>
        <button id="user-actions-btn" class="btn-text"><i class="fas fa-ellipsis-h"></i></button>
      `;
      
      // Handle follow button
      document.getElementById('follow-btn').addEventListener('click', async function() {
        try {
          const action = isFollowing ? 'unfollow' : 'follow';
          const response = await fetch(`/api/users/${profileId}/${action}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            // Update UI
            this.classList.toggle('following');
            this.textContent = this.classList.contains('following') ? 'Following' : 'Follow';
            
            // Update counts
            loadProfile(profileId);
          } else {
            const data = await response.json();
            alert(data.message || `Failed to ${action}`);
          }
        } catch (error) {
          console.error(`Error ${isFollowing ? 'unfollowing' : 'following'} user:`, error);
          alert(`An error occurred while ${isFollowing ? 'unfollowing' : 'following'} this user`);
        }
      });
      
      // Handle message button
      document.getElementById('message-btn').addEventListener('click', function() {
        window.location.href = `messages.html?user=${profileId}`;
      });
      
      // Handle user actions button
      document.getElementById('user-actions-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        userActionMenu.classList.toggle('hidden');
        
        // Position the menu
        const rect = this.getBoundingClientRect();
        userActionMenu.style.top = `${rect.bottom + 10}px`;
        userActionMenu.style.right = `${window.innerWidth - rect.right}px`;
      });
      
      // User action menu items
      document.getElementById('menu-block').addEventListener('click', async function() {
        if (confirm(`Are you sure you want to block ${profileData.username}?`)) {
          try {
            const response = await fetch(`/api/users/${profileId}/block`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              alert(`You have blocked ${profileData.username}`);
              window.location.href = 'home.html';
            } else {
              const data = await response.json();
              alert(data.message || 'Failed to block user');
            }
          } catch (error) {
            console.error('Error blocking user:', error);
            alert('An error occurred while blocking this user');
          }
        }
        
        userActionMenu.classList.add('hidden');
      });
      
      document.getElementById('menu-report').addEventListener('click', function() {
        alert('Report functionality coming soon');
        userActionMenu.classList.add('hidden');
      });
      
      document.getElementById('menu-mute').addEventListener('click', function() {
        alert('Mute functionality coming soon');
        userActionMenu.classList.add('hidden');
      });
      
      document.getElementById('menu-message').addEventListener('click', function() {
        window.location.href = `messages.html?user=${profileId}`;
      });
    }
    
    // Load posts for initial view if about tab is active
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab.getAttribute('data-tab') === 'posts') {
      loadUserPosts(profileId);
    }
  }
  
  // Load user posts - Completely rewritten for reliability
  async function loadUserPosts(id) {
    const postsContainer = document.getElementById('profile-posts');
    
    try {
      postsContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading posts...
        </div>
      `;
      
      console.log(`Requesting posts for user ID: ${id}`);
      
      const response = await fetch(`/api/users/${id}/posts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Log the raw response for debugging
      console.log(`Posts API response status: ${response.status}`);
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      // Parse the JSON after logging the raw text
      const data = JSON.parse(responseText);
      console.log('Parsed posts data:', data);
      
      if (data && data.posts) {
        if (data.posts.length === 0) {
          postsContainer.innerHTML = '<p class="empty-message">No posts yet</p>';
          return;
        }
        
        postsContainer.innerHTML = '';
        
        data.posts.forEach(post => {
          console.log('Creating element for post:', post.id);
          const postElement = createProfilePostElement(post);
          postsContainer.appendChild(postElement);
        });
      } else {
        postsContainer.innerHTML = `<p class="error-message">Error loading posts: Invalid response format</p>`;
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      postsContainer.innerHTML = `<p class="error-message">Error loading posts: ${error.message}</p>`;
    }
  }
  
  // Create a simpler post element specifically for profile view
  function createProfilePostElement(post) {
    // Create container
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.dataset.postId = post.id;
    
    // Create post HTML
    postElement.innerHTML = `
      <div class="post-header">
        <div class="post-author">
          <div class="author-avatar">
            <i class="fas fa-user-circle"></i>
          </div>
          <div class="author-info">
            <h4 class="author-name">${post.username || 'Unknown User'}</h4>
            <span class="post-time">${formatDate(post.created_at)}</span>
          </div>
        </div>
      </div>
      <div class="post-content">
        <p class="post-text">${post.content || ''}</p>
        ${post.image_url ? `
          <div class="post-image-container">
            <img src="${post.image_url}" alt="Post image">
          </div>
        ` : ''}
      </div>
      <div class="post-actions">
        <button class="btn-interest ${post.is_interested ? 'active' : ''}">
          <i class="fas fa-star"></i> I'm Interested
        </button>
        <button class="btn-share">
          <i class="fas fa-share"></i> Share
        </button>
      </div>
      <div class="post-stats">
        <span class="interested-count">${post.interested_count || 0} interested</span>
      </div>
    `;
    
    // Add click event to open the full post
    postElement.addEventListener('click', function(e) {
      if (!e.target.closest('button')) {
        window.location.href = `post.html?id=${post.id}`;
      }
    });
    
    // Setup interest button
    const interestBtn = postElement.querySelector('.btn-interest');
    interestBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      try {
        const response = await fetch(`/api/posts/${post.id}/interest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.classList.toggle('active');
          postElement.querySelector('.interested-count').textContent = 
            `${data.interested_count} interested`;
        }
      } catch (error) {
        console.error('Error showing interest:', error);
      }
    });
    
    // Setup share button
    const shareBtn = postElement.querySelector('.btn-share');
    shareBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      
      const postUrl = `${window.location.origin}/post.html?id=${post.id}`;
      copyToClipboard(postUrl);
      alert('Link copied to clipboard!');
    });
    
    return postElement;
  }
  
  // Ensure posts load when tab is clicked and on initial load
  document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    
    // Force reload posts when posts tab is clicked
    const postsTab = document.querySelector('[data-tab="posts"]');
    if (postsTab) {
      postsTab.addEventListener('click', function() {
        console.log(`Force loading posts for profile ID: ${profileId}`);
        loadUserPosts(profileId);
      });
    }

    // Wait a bit before trying to load posts on initial render
    setTimeout(() => {
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.getAttribute('data-tab') === 'posts') {
        console.log('Initial load of profile posts');
        loadUserPosts(profileId);
      }
    }, 500);
  });
  
  // Load following
  async function loadFollowing(id) {
    const followingContainer = document.getElementById('profile-following');
    
    try {
      followingContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading following...
        </div>
      `;
      
      const response = await fetch(`/api/users/${id}/following`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (!data.users || data.users.length === 0) {
          followingContainer.innerHTML = '<p>Not following anyone yet</p>';
          return;
        }
        
        followingContainer.innerHTML = '';
        
        data.users.forEach(user => {
          const userCard = createUserCard(user);
          followingContainer.appendChild(userCard);
        });
      } else {
        followingContainer.innerHTML = `<p>Error loading following: ${data.message}</p>`;
      }
    } catch (error) {
      console.error('Error loading following:', error);
      followingContainer.innerHTML = '<p>Error loading following</p>';
    }
  }
  
  // Load followers
  async function loadFollowers(id) {
    const followersContainer = document.getElementById('profile-followers');
    
    try {
      followersContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading followers...
        </div>
      `;
      
      const response = await fetch(`/api/users/${id}/followers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (!data.users || data.users.length === 0) {
          followersContainer.innerHTML = '<p>No followers yet</p>';
          return;
        }
        
        followersContainer.innerHTML = '';
        
        data.users.forEach(user => {
          const userCard = createUserCard(user);
          followersContainer.appendChild(userCard);
        });
      } else {
        followersContainer.innerHTML = `<p>Error loading followers: ${data.message}</p>`;
      }
    } catch (error) {
      console.error('Error loading followers:', error);
      followersContainer.innerHTML = '<p>Error loading followers</p>';
    }
  }
  
  // Create post element
  function createPostElement(post) {
    const postElement = document.importNode(postTemplate.content, true);
    
    // Set post content
    postElement.querySelector('.author-name').textContent = post.username;
    postElement.querySelector('.post-time').textContent = formatDate(post.created_at);
    postElement.querySelector('.post-text').textContent = post.content;
    
    // Set post image if exists
    if (post.image_url) {
      postElement.querySelector('.post-image-container').innerHTML = `
        <img src="${post.image_url}" alt="Post image">
      `;
    }
    
    // Set post stats
    postElement.querySelector('.interested-count').textContent = 
      `${post.interested_count || 0} interested`;
    
    // Set post ID
    const postDiv = postElement.querySelector('.post');
    postDiv.setAttribute('data-post-id', post.id);
    
    // Setup post event listeners
    setupPostEventListeners(postElement, post);
    
    return postElement.firstElementChild;
  }
  
  // Setup post event listeners
  function setupPostEventListeners(postElement, post) {
    const postDiv = postElement.querySelector('.post');
    const interestBtn = postElement.querySelector('.btn-interest');
    const contactBtn = postElement.querySelector('.btn-contact');
    const shareBtn = postElement.querySelector('.btn-share');
    
    // Handle interest button
    interestBtn.addEventListener('click', async function() {
      try {
        const response = await fetch(`/api/posts/${post.id}/interest`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Update interest count
          const data = await response.json();
          postDiv.querySelector('.interested-count').textContent = 
            `${data.interested_count} interested`;
        }
      } catch (error) {
        console.error('Error showing interest:', error);
      }
    });
    
    // Handle contact button
    contactBtn.addEventListener('click', function() {
      window.location.href = `messages.html?user=${post.user_id}`;
    });
    
    // Handle share button
    shareBtn.addEventListener('click', async function() {
      const postUrl = `${window.location.origin}/post.html?id=${post.id}`;
      
      // Use Web Share API if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Innovate Post',
            text: `Check out this post by ${post.username}`,
            url: postUrl
          });
        } catch (error) {
          console.error('Error sharing:', error);
          copyToClipboard(postUrl);
        }
      } else {
        copyToClipboard(postUrl);
      }
    });
  }
  
  // Create user card
  function createUserCard(user) {
    const userCard = document.importNode(userCardTemplate.content, true);
    
    // Set user info
    userCard.querySelector('.user-name').textContent = user.username;
    userCard.querySelector('.user-bio').textContent = user.bio || 'No bio available';
    
    // Set user ID
    const card = userCard.querySelector('.user-card');
    card.setAttribute('data-user-id', user.id);
    
    // Check if current user is following this user
    const isFollowing = user.is_following;
    const followBtn = userCard.querySelector('.btn-follow');
    
    if (isFollowing) {
      followBtn.classList.add('following');
      followBtn.textContent = 'Following';
    }
    
    // Open profile on click
    card.addEventListener('click', function(e) {
      if (e.target !== followBtn) {
        window.location.href = `profile.html?id=${user.id}`;
      }
    });
    
    // Handle follow button
    followBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      try {
        const action = isFollowing ? 'unfollow' : 'follow';
        const response = await fetch(`/api/users/${user.id}/${action}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Update UI
          this.classList.toggle('following');
          this.textContent = this.classList.contains('following') ? 'Following' : 'Follow';
        } else {
          const data = await response.json();
          alert(data.message || `Failed to ${action}`);
        }
      } catch (error) {
        console.error(`Error ${isFollowing ? 'unfollowing' : 'following'} user:`, error);
        alert(`An error occurred while ${isFollowing ? 'unfollowing' : 'following'} this user`);
      }
    });
    
    return card;
  }
  
  // Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHour < 24) {
      return `${diffHour}h ago`;
    } else if (diffDay < 7) {
      return `${diffDay}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Link copied to clipboard');
      })
      .catch(err => {
        console.error('Error copying to clipboard:', err);
        
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Link copied to clipboard');
      });
  }
});
