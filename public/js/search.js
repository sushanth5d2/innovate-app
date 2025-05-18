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
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchTypeTabs = document.querySelectorAll('.search-type-tabs .tab-btn');
  const initialState = document.getElementById('initial-state');
  const noResults = document.getElementById('no-results');
  const loadingResults = document.getElementById('loading-results');
  const resultsContainer = document.getElementById('results-container');
  const usersSection = document.getElementById('users-section');
  const usersResults = document.getElementById('users-results');
  const postsSection = document.getElementById('posts-section');
  const postsResults = document.getElementById('posts-results');
  const communitiesSection = document.getElementById('communities-section');
  const communitiesResults = document.getElementById('communities-results');
  const moreUsersBtn = document.getElementById('more-users');
  const morePostsBtn = document.getElementById('more-posts');
  const moreCommunitiesBtn = document.getElementById('more-communities');
  
  // Templates
  const userCardTemplate = document.getElementById('user-card-template');
  const postTemplate = document.getElementById('post-template');
  const communityCardTemplate = document.getElementById('community-card-template');
  
  // Variables
  let currentSearchType = 'all';
  let lastQuery = '';
  let isSearching = false;
  
  // Set focus on search input
  searchInput.focus();
  
  // Handle search form submission
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const query = searchInput.value.trim();
    if (query.length < 2) {
      return;
    }
    
    performSearch(query);
  });
  
  // Handle search input changes (live search)
  searchInput.addEventListener('input', debounce(function() {
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
      // Show initial state if input is cleared
      if (query.length === 0) {
        showInitialState();
      }
      return;
    }
    
    performSearch(query);
  }, 500));
  
  // Handle search type tabs
  searchTypeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Update active tab
      searchTypeTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update search type
      currentSearchType = this.getAttribute('data-type');
      
      // Re-perform search with current query if there is one
      if (lastQuery) {
        performSearch(lastQuery);
      }
    });
  });
  
  // More results buttons
  moreUsersBtn.addEventListener('click', function() {
    loadMoreResults('users');
  });
  
  morePostsBtn.addEventListener('click', function() {
    loadMoreResults('posts');
  });
  
  moreCommunitiesBtn.addEventListener('click', function() {
    loadMoreResults('communities');
  });
  
  // Perform search
  async function performSearch(query) {
    if (isSearching || query === lastQuery) return;
    
    lastQuery = query;
    isSearching = true;
    
    // Show loading state
    showLoadingState();
    
    try {
      let endpoint;
      
      switch (currentSearchType) {
        case 'users':
          endpoint = `/api/search/users?q=${encodeURIComponent(query)}`;
          break;
        case 'posts':
          endpoint = `/api/search/posts?q=${encodeURIComponent(query)}`;
          break;
        case 'communities':
          endpoint = `/api/search/communities?q=${encodeURIComponent(query)}`;
          break;
        default:
          endpoint = `/api/search/all?q=${encodeURIComponent(query)}`;
      }
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        displayResults(data);
      } else {
        showNoResults();
      }
    } catch (error) {
      console.error('Error performing search:', error);
      showNoResults();
    } finally {
      isSearching = false;
    }
  }
  
  // Display search results
  function displayResults(data) {
    // Hide loading state
    loadingResults.classList.add('hidden');
    
    // Show results container
    resultsContainer.classList.remove('hidden');
    
    // Reset sections
    usersSection.classList.add('hidden');
    postsSection.classList.add('hidden');
    communitiesSection.classList.add('hidden');
    
    // Check if we have any results
    const hasUsers = data.users && data.users.length > 0;
    const hasPosts = data.posts && data.posts.length > 0;
    const hasCommunities = data.communities && data.communities.length > 0;
    
    if (!hasUsers && !hasPosts && !hasCommunities) {
      showNoResults();
      return;
    }
    
    // Display users if available
    if (hasUsers && (currentSearchType === 'all' || currentSearchType === 'users')) {
      usersSection.classList.remove('hidden');
      renderUsers(data.users);
    }
    
    // Display posts if available
    if (hasPosts && (currentSearchType === 'all' || currentSearchType === 'posts')) {
      postsSection.classList.remove('hidden');
      renderPosts(data.posts);
    }
    
    // Display communities if available
    if (hasCommunities && (currentSearchType === 'all' || currentSearchType === 'communities')) {
      communitiesSection.classList.remove('hidden');
      renderCommunities(data.communities);
    }
  }
  
  // Render users results
  function renderUsers(users) {
    usersResults.innerHTML = '';
    
    users.forEach(user => {
      const userCard = document.importNode(userCardTemplate.content, true).querySelector('.user-card');
      
      userCard.querySelector('.user-name').textContent = user.username;
      userCard.querySelector('.user-bio').textContent = user.bio || 'No bio available';
      
      // Set up follow button
      const followBtn = userCard.querySelector('.btn-follow');
      
      if (user.is_following) {
        followBtn.textContent = 'Following';
        followBtn.classList.add('following');
      } else {
        followBtn.textContent = 'Follow';
      }
      
      // Handle follow/unfollow
      followBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        
        const action = user.is_following ? 'unfollow' : 'follow';
        
        try {
          const response = await fetch(`/api/users/${user.id}/${action}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            user.is_following = !user.is_following;
            followBtn.textContent = user.is_following ? 'Following' : 'Follow';
            followBtn.classList.toggle('following');
          } else {
            const data = await response.json();
            alert(data.message || `Failed to ${action} user`);
          }
        } catch (error) {
          console.error(`Error ${action}ing user:`, error);
        }
      });
      
      // Handle click on user card (navigate to profile)
      userCard.addEventListener('click', function(e) {
        if (e.target !== followBtn) {
          window.location.href = `profile.html?id=${user.id}`;
        }
      });
      
      usersResults.appendChild(userCard);
    });
    
    // Show/hide "View more" button
    moreUsersBtn.classList.toggle('hidden', users.length < 20);
  }
  
  // Render posts results
  function renderPosts(posts) {
    postsResults.innerHTML = '';
    
    posts.forEach(post => {
      const postElement = document.importNode(postTemplate.content, true).querySelector('.post');
      
      postElement.querySelector('.author-name').textContent = post.username;
      postElement.querySelector('.post-time').textContent = formatDate(post.created_at);
      postElement.querySelector('.post-text').textContent = post.content;
      postElement.querySelector('.interested-count').textContent = `${post.interested_count || 0} interested`;
      
      // Set post image if exists
      if (post.image_url) {
        postElement.querySelector('.post-image-container').innerHTML = `
          <img src="${post.image_url}" alt="Post image">
        `;
      }
      
      // Handle click on post (navigate to post details)
      postElement.addEventListener('click', function() {
        window.location.href = `post.html?id=${post.id}`;
      });
      
      postsResults.appendChild(postElement);
    });
    
    // Show/hide "View more" button
    morePostsBtn.classList.toggle('hidden', posts.length < 20);
  }
  
  // Render communities results
  function renderCommunities(communities) {
    communitiesResults.innerHTML = '';
    
    communities.forEach(community => {
      const communityCard = document.importNode(communityCardTemplate.content, true).querySelector('.community-card');
      
      communityCard.querySelector('.community-name').textContent = community.name;
      communityCard.querySelector('.community-description').textContent = community.description || 'No description';
      communityCard.querySelector('.count').textContent = community.member_count || 0;
      
      // Set up join/view button
      const communityBtn = communityCard.querySelector('.community-btn');
      
      if (community.is_member) {
        communityBtn.textContent = 'View';
        communityBtn.classList.add('joined');
      } else {
        communityBtn.textContent = 'Join';
      }
      
      // Handle join/view
      communityBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        
        if (community.is_member) {
          // View community
          window.location.href = `community.html?id=${community.id}`;
        } else {
          // Join community
          try {
            const response = await fetch(`/api/communities/${community.id}/join`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              community.is_member = true;
              communityBtn.textContent = 'View';
              communityBtn.classList.add('joined');
            } else {
              const data = await response.json();
              alert(data.message || 'Failed to join community');
            }
          } catch (error) {
            console.error('Error joining community:', error);
          }
        }
      });
      
      // Handle click on community card (navigate to community)
      communityCard.addEventListener('click', function(e) {
        if (e.target !== communityBtn) {
          window.location.href = `community.html?id=${community.id}`;
        }
      });
      
      communitiesResults.appendChild(communityCard);
    });
    
    // Show/hide "View more" button
    moreCommunitiesBtn.classList.toggle('hidden', communities.length < 20);
  }
  
  // Load more results
  function loadMoreResults(type) {
    // This would implement pagination for search results
    // For now, just alert that this feature is coming soon
    alert('Load more functionality coming soon!');
  }
  
  // Show initial state
  function showInitialState() {
    initialState.classList.remove('hidden');
    noResults.classList.add('hidden');
    loadingResults.classList.add('hidden');
    resultsContainer.classList.add('hidden');
  }
  
  // Show loading state
  function showLoadingState() {
    initialState.classList.add('hidden');
    noResults.classList.add('hidden');
    loadingResults.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
  }
  
  // Show no results state
  function showNoResults() {
    initialState.classList.add('hidden');
    noResults.classList.remove('hidden');
    loadingResults.classList.add('hidden');
    resultsContainer.classList.add('hidden');
  }
  
  // Helper function for debouncing
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
  
  // Format date helper
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
});
