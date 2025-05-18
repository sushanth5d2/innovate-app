# Innovate App

Innovate is a professional networking platform for innovators, creators, and professionals to connect, collaborate, and share ideas.

## Features

- **User Profiles**: Create and customize your professional profile with skills, interests, and bio
- **Posts**: Share your ideas, projects, and updates with the community
- **Messaging**: Connect and communicate privately with other users
- **Communities**: Join topic-based communities to discuss shared interests
- **Events**: Create and attend professional events and meetups
- **Search**: Find users, posts, and communities relevant to your interests

## Setup and Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation Steps

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/innovate-app.git
   cd innovate-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Initialize the database with sample data:
   ```
   npm run init-db
   ```

4. Start the server:
   ```
   npm start
   ```

5. Access the application:
   Open your browser and navigate to `http://localhost:3000`

## Development

### Project Structure

- `/public`: Static files (HTML, CSS, client-side JS)
- `/routes`: API routes for the backend
- `/middlewares`: Express middlewares
- `/data`: Database files

### Sample Users

The database initialization script creates five sample users:

1. john_doe (john@example.com) - Software Engineer
2. jane_smith (jane@example.com) - UX Designer
3. alex_wilson (alex@example.com) - AI Researcher
4. sarah_johnson (sarah@example.com) - Mobile Developer
5. michael_brown (michael@example.com) - DevOps Engineer

All users have the password: `password123`

## API Documentation

### Authentication

- `POST /api/auth/register`: Register a new user
- `POST /api/auth/login`: Login and receive authentication token
- `GET /api/auth/verify`: Verify authentication token

### Users

- `GET /api/users/me`: Get current user profile
- `GET /api/users/:id`: Get user profile by ID
- `PUT /api/users/update-profile`: Update user profile
- `GET /api/users/:id/posts`: Get posts by a specific user
- `GET /api/users/:id/following`: Get users followed by a specific user
- `GET /api/users/:id/followers`: Get followers of a specific user
- `POST /api/users/:id/follow`: Follow a user
- `POST /api/users/:id/unfollow`: Unfollow a user
- `POST /api/users/:id/block`: Block a user

### Posts

- `GET /api/posts`: Get all posts (feed)
- `POST /api/posts`: Create a new post
- `GET /api/posts/:id`: Get a specific post
- `DELETE /api/posts/:id`: Delete a post
- `POST /api/posts/:id/interest`: Show interest in a post

### Messages

- `GET /api/messages/conversations`: Get all conversations
- `GET /api/messages/conversation/:contactId`: Get messages with a specific user
- `POST /api/messages`: Send a message

### Communities

- `GET /api/communities`: Get all communities
- `GET /api/communities/my-communities`: Get communities the user is a member of
- `POST /api/communities`: Create a new community
- `GET /api/communities/:id`: Get a specific community
- `POST /api/communities/:id/join`: Join a community
- `POST /api/communities/:id/leave`: Leave a community
- `GET /api/communities/:id/posts`: Get posts in a community
- `POST /api/communities/:id/posts`: Create a post in a community

### Events

- `GET /api/events`: Get all events for current user
- `POST /api/events`: Create a new event
- `GET /api/events/:id`: Get a specific event
- `GET /api/events/:id/attendees`: Get attendees for an event
- `PUT /api/events/:id/status`: Update attendee status
- `PUT /api/events/:id`: Update an event
- `DELETE /api/events/:id`: Delete (cancel) an event

### Search

- `GET /api/search/users`: Search for users
- `GET /api/search/posts`: Search for posts
- `GET /api/search/communities`: Search for communities
- `GET /api/search/all`: Combined search

### Notifications

- `GET /api/notifications`: Get all notifications
- `GET /api/notifications/unread-count`: Get unread notifications count
- `PUT /api/notifications/:id/read`: Mark a notification as read
- `POST /api/notifications/mark-all-read`: Mark all notifications as read
- `DELETE /api/notifications/:id`: Delete a notification
- `DELETE /api/notifications`: Clear all notifications

## License

MIT
