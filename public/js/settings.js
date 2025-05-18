document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }
  
  // DOM elements
  const profileForm = document.getElementById('profile-form');
  const passwordForm = document.getElementById('password-form');
  const savePrivacyBtn = document.getElementById('save-privacy');
  const deleteAccountBtn = document.getElementById('delete-account');
  const bioInput = document.getElementById('bio');
  const skillsInput = document.getElementById('skills');
  const interestsInput = document.getElementById('interests');
  const emailInput = document.getElementById('email');
  const usernameInput = document.getElementById('username');
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const showEmailCheckbox = document.getElementById('show-email');
  const showInterestsCheckbox = document.getElementById('show-interests');
  
  // Load user data
  loadUserData();
  
  // Handle profile form submission
  profileForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const bio = bioInput.value.trim();
    const skills = skillsInput.value.trim();
    const interests = interestsInput.value.trim();
    
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
        alert('Profile updated successfully!');
      } else {
        const data = await response.json();
        alert(data.message || 'Error updating profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('An error occurred while updating your profile');
    }
  });
  
  // Handle password form submission
  passwordForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation password do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters long');
      return;
    }
    
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      if (response.ok) {
        alert('Password changed successfully!');
        // Clear password fields
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
      } else {
        const data = await response.json();
        alert(data.message || 'Error changing password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('An error occurred while changing your password');
    }
  });
  
  // Handle privacy settings
  savePrivacyBtn.addEventListener('click', function() {
    // This is a placeholder for future functionality
    alert('Privacy settings saved!');
    // In a real implementation, this would save to the server
  });
  
  // Handle account deletion
  deleteAccountBtn.addEventListener('click', function() {
    const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    
    if (confirmed) {
      // This is a placeholder for future functionality
      alert('Account deletion is not implemented in this demo.');
      // In a real implementation, this would call an API endpoint to delete the account
    }
  });
  
  // Load user data from API
  async function loadUserData() {
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const user = data.user;
        
        // Set form values
        bioInput.value = user.bio || '';
        skillsInput.value = user.skills || '';
        interestsInput.value = user.interests || '';
        emailInput.value = user.email || '';
        usernameInput.value = user.username || '';
        
        // Privacy settings would also be loaded here in a real implementation
      } else {
        console.error('Error loading user data');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }
});
