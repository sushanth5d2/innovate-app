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
  const searchInput = document.getElementById('search-communities');
  const createCommunityBtn = document.getElementById('create-community-btn');
  const createCommunityModal = document.getElementById('create-community-modal');
  const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-modal');
  const createCommunityForm = document.getElementById('create-community-form');
  const myCommunitiesContainer = document.getElementById('my-communities');
  const discoverCommunitiesContainer = document.getElementById('discover-communities');
  const communityCardTemplate = document.getElementById('community-card-template');
  
  // Load communities
  loadMyCommunities();
  loadDiscoverCommunities();
  
  // Handle search
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length >= 2) {
      searchCommunities(query);
    } else if (query.length === 0) {
      // Reset to normal view
      loadMyCommunities();
      loadDiscoverCommunities();
    }
  });
  
  // Show create community modal
  createCommunityBtn.addEventListener('click', function() {
    createCommunityModal.classList.remove('hidden');
  });
  
  // Close modal
  closeModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      createCommunityModal.classList.add('hidden');
    });
  });
  
  // Close modal when clicking outside
  createCommunityModal.addEventListener('click', function(e) {
    if (e.target === createCommunityModal) {
      createCommunityModal.classList.add('hidden');
    }
  });
  
  // Handle community creation form
  createCommunityForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('community-name').value.trim();
    const description = document.getElementById('community-description').value.trim();
    
    if (!name) {
      alert('Community name is required');
      return;
    }
    
    try {
      const response = await fetch('/api/communities', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Clear form and close modal
        createCommunityForm.reset();
        createCommunityModal.classList.add('hidden');
        
        // Reload communities
        loadMyCommunities();
        
        // Show success message
        alert('Community created successfully');
      } else {
        alert(data.message || 'Failed to create community');
      }
    } catch (error) {
      console.error('Error creating community:', error);
      alert('An error occurred while creating the community');
    }
  });
  
  // Load user's communities
  async function loadMyCommunities() {
    try {
      myCommunitiesContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading communities...
        </div>
      `;
      
      const response = await fetch('/api/communities/my-communities', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        renderCommunities(data.communities, myCommunitiesContainer, true);
      } else {
        myCommunitiesContainer.innerHTML = `<p>Error loading communities</p>`;
      }
    } catch (error) {
      console.error('Error loading my communities:', error);
      myCommunitiesContainer.innerHTML = `<p>Error loading communities</p>`;
    }
  }
  
  // Load discover communities
  async function loadDiscoverCommunities() {
    try {
      discoverCommunitiesContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading communities...
        </div>
      `;
      
      const response = await fetch('/api/communities', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Filter out communities the user is already a member of
        const communities = data.communities.filter(community => !community.is_member);
        renderCommunities(communities, discoverCommunitiesContainer, false);
      } else {
        discoverCommunitiesContainer.innerHTML = `<p>Error loading communities</p>`;
      }
    } catch (error) {
      console.error('Error loading discover communities:', error);
      discoverCommunitiesContainer.innerHTML = `<p>Error loading communities</p>`;
    }
  }
  
  // Search communities
  async function searchCommunities(query) {
    try {
      myCommunitiesContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Searching...
        </div>
      `;
      
      discoverCommunitiesContainer.innerHTML = '';
      
      const response = await fetch(`/api/communities/search/${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Split into my communities and others
        const myCommunities = data.communities.filter(community => community.is_member);
        const otherCommunities = data.communities.filter(community => !community.is_member);
        
        renderCommunities(myCommunities, myCommunitiesContainer, true);
        renderCommunities(otherCommunities, discoverCommunitiesContainer, false);
      } else {
        myCommunitiesContainer.innerHTML = `<p>Error searching communities</p>`;
      }
    } catch (error) {
      console.error('Error searching communities:', error);
      myCommunitiesContainer.innerHTML = `<p>Error searching communities</p>`;
    }
  }
  
  // Render communities
  function renderCommunities(communities, container, isMember) {
    container.innerHTML = '';
    
    if (!communities || communities.length === 0) {
      container.innerHTML = `<p class="no-communities">${isMember ? 'You are not a member of any communities yet' : 'No communities to discover'}</p>`;
      return;
    }
    
    communities.forEach(community => {
      const communityCard = createCommunityCard(community, isMember);
      container.appendChild(communityCard);
    });
  }
  
  // Create community card
  function createCommunityCard(community, isMember) {
    const card = document.importNode(communityCardTemplate.content, true).querySelector('.community-card');
    
    card.setAttribute('data-community-id', community.id);
    card.querySelector('.community-name').textContent = community.name;
    card.querySelector('.community-description').textContent = community.description || 'No description';
    card.querySelector('.count').textContent = community.member_count || 0;
    
    const joinBtn = card.querySelector('.join-community');
    
    if (isMember) {
      joinBtn.textContent = 'View';
      joinBtn.classList.add('joined');
    } else {
      joinBtn.textContent = 'Join';
    }
    
    // Make the entire card clickable to view community
    card.addEventListener('click', function(e) {
      if (!e.target.classList.contains('join-community')) {
        window.location.href = `community.html?id=${community.id}`;
      }
    });
    
    // Join/View button
    joinBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      if (isMember) {
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
            // Update UI
            joinBtn.textContent = 'View';
            joinBtn.classList.add('joined');
            
            // Reload communities
            loadMyCommunities();
            loadDiscoverCommunities();
          } else {
            const data = await response.json();
            alert(data.message || 'Failed to join community');
          }
        } catch (error) {
          console.error('Error joining community:', error);
          alert('An error occurred while joining the community');
        }
      }
    });
    
    return card;
  }
});
