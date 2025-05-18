const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to database
const db = new sqlite3.Database(path.join(dataDir, 'innovate.db'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database schema and add sample data
function initializeDatabase() {
  db.serialize(() => {
    // Create tables
    const createTables = () => {
      return new Promise((resolve, reject) => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            bio TEXT,
            skills TEXT,
            interests TEXT,
            following TEXT DEFAULT '[]', 
            followers TEXT DEFAULT '[]',
            blocked_users TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          
          // Posts table
          db.run(`
            CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              content TEXT NOT NULL,
              image_url TEXT,
              poll_data TEXT,
              is_archived INTEGER DEFAULT 0,
              is_scheduled INTEGER DEFAULT 0,
              schedule_time TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id)
            )
          `, (err) => {
            if (err) reject(err);
            
            // Post interactions table
            db.run(`
              CREATE TABLE IF NOT EXISTS post_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                interaction_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(post_id, user_id, interaction_type)
              )
            `, (err) => {
              if (err) reject(err);
              
              // Messages table
              db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  sender_id INTEGER NOT NULL,
                  receiver_id INTEGER NOT NULL,
                  content TEXT,
                  attachment_url TEXT,
                  is_read INTEGER DEFAULT 0,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (sender_id) REFERENCES users (id),
                  FOREIGN KEY (receiver_id) REFERENCES users (id)
                )
              `, (err) => {
                if (err) reject(err);
                
                // Communities table
                db.run(`
                  CREATE TABLE IF NOT EXISTS communities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    admin_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (admin_id) REFERENCES users (id)
                  )
                `, (err) => {
                  if (err) reject(err);
                  
                  // Community members table
                  db.run(`
                    CREATE TABLE IF NOT EXISTS community_members (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      community_id INTEGER NOT NULL,
                      user_id INTEGER NOT NULL,
                      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (community_id) REFERENCES communities (id),
                      FOREIGN KEY (user_id) REFERENCES users (id),
                      UNIQUE(community_id, user_id)
                    )
                  `, (err) => {
                    if (err) reject(err);
                    
                    // Community posts table
                    db.run(`
                      CREATE TABLE IF NOT EXISTS community_posts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        community_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        image_url TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (community_id) REFERENCES communities (id),
                        FOREIGN KEY (user_id) REFERENCES users (id)
                      )
                    `, (err) => {
                      if (err) reject(err);
                      
                      // Events table
                      db.run(`
                        CREATE TABLE IF NOT EXISTS events (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          title TEXT NOT NULL,
                          description TEXT,
                          date TIMESTAMP NOT NULL,
                          creator_id INTEGER NOT NULL,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (creator_id) REFERENCES users (id)
                        )
                      `, (err) => {
                        if (err) reject(err);
                        
                        // Event attendees table
                        db.run(`
                          CREATE TABLE IF NOT EXISTS event_attendees (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            event_id INTEGER NOT NULL,
                            user_id INTEGER NOT NULL,
                            status TEXT DEFAULT 'pending',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (event_id) REFERENCES events (id),
                            FOREIGN KEY (user_id) REFERENCES users (id),
                            UNIQUE(event_id, user_id)
                          )
                        `, (err) => {
                          if (err) reject(err);
                          
                          // Notifications table
                          db.run(`
                            CREATE TABLE IF NOT EXISTS notifications (
                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                              user_id INTEGER NOT NULL,
                              type TEXT NOT NULL,
                              content TEXT NOT NULL,
                              related_id INTEGER,
                              is_read INTEGER DEFAULT 0,
                              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                              FOREIGN KEY (user_id) REFERENCES users (id)
                            )
                          `, (err) => {
                            if (err) reject(err);
                            
                            // FTS for community search
                            db.run(`
                              CREATE VIRTUAL TABLE IF NOT EXISTS community_search USING fts5(
                                name, 
                                description
                              )
                            `, (err) => {
                              if (err) reject(err);
                              
                              // Post poll votes table
                              db.run(`
                                CREATE TABLE IF NOT EXISTS post_poll_votes (
                                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                                  post_id INTEGER NOT NULL,
                                  user_id INTEGER NOT NULL,
                                  option_index INTEGER NOT NULL,
                                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                  FOREIGN KEY (post_id) REFERENCES posts (id),
                                  FOREIGN KEY (user_id) REFERENCES users (id),
                                  UNIQUE(post_id, user_id)
                                )
                              `, (err) => {
                                if (err) reject(err);
                                else resolve();
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    };
    
    // Create test users
    const createUsers = () => {
      return new Promise((resolve, reject) => {
        // Check if users already exist
        db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (result.count > 0) {
            console.log('Users already exist, skipping user creation');
            resolve();
            return;
          }
          
          // Create test users
          const users = [
            {
              username: 'john_doe',
              email: 'john@example.com',
              password: 'password123',
              bio: 'Software engineer passionate about web development',
              skills: 'JavaScript, React, Node.js',
              interests: 'Web Development, UI/UX, Open Source'
            },
            {
              username: 'jane_smith',
              email: 'jane@example.com',
              password: 'password123',
              bio: 'UX Designer with 5 years of experience',
              skills: 'UX Design, Figma, UI Prototyping',
              interests: 'Design Systems, Accessibility, Human-Computer Interaction'
            },
            {
              username: 'alex_wilson',
              email: 'alex@example.com',
              password: 'password123',
              bio: 'AI researcher and machine learning enthusiast',
              skills: 'Python, TensorFlow, Data Science',
              interests: 'Artificial Intelligence, Neural Networks, Data Visualization'
            },
            {
              username: 'sarah_johnson',
              email: 'sarah@example.com',
              password: 'password123',
              bio: 'Mobile app developer and entrepreneur',
              skills: 'Swift, Kotlin, Flutter',
              interests: 'Mobile Development, Startups, Tech Entrepreneurship'
            },
            {
              username: 'michael_brown',
              email: 'michael@example.com',
              password: 'password123',
              bio: 'DevOps engineer focused on cloud infrastructure',
              skills: 'AWS, Docker, Kubernetes',
              interests: 'Cloud Computing, Infrastructure as Code, CI/CD'
            }
          ];
          
          // Use Promise.all to hash all passwords
          Promise.all(users.map(user => 
            new Promise((resolve, reject) => {
              bcrypt.hash(user.password, 10, (err, hash) => {
                if (err) reject(err);
                else resolve({...user, password: hash});
              });
            })
          ))
          .then(usersWithHashedPasswords => {
            const insertUser = (index) => {
              if (index >= usersWithHashedPasswords.length) {
                resolve();
                return;
              }
              
              const user = usersWithHashedPasswords[index];
              db.run(
                'INSERT INTO users (username, email, password, bio, skills, interests, following, followers, blocked_users) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [user.username, user.email, user.password, user.bio, user.skills, user.interests, '[]', '[]', '[]'],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  console.log(`Created user: ${user.username}`);
                  insertUser(index + 1);
                }
              );
            };
            
            insertUser(0);
          })
          .catch(err => reject(err));
        });
      });
    };
    
    // Create communities
    const createCommunities = () => {
      return new Promise((resolve, reject) => {
        // Check if communities already exist
        db.get('SELECT COUNT(*) as count FROM communities', [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (result.count > 0) {
            console.log('Communities already exist, skipping community creation');
            resolve();
            return;
          }
          
          // Get user IDs
          db.all('SELECT id, username FROM users', [], (err, users) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Create communities
            const communities = [
              {
                name: 'Web Development',
                description: 'A community for web developers to share knowledge and resources',
                admin_id: users[0].id // john_doe
              },
              {
                name: 'UX/UI Design',
                description: 'Discuss design principles, tools, and techniques',
                admin_id: users[1].id // jane_smith
              },
              {
                name: 'Artificial Intelligence',
                description: 'Explore the latest in AI research and applications',
                admin_id: users[2].id // alex_wilson
              },
              {
                name: 'Mobile Development',
                description: 'For developers working on iOS, Android, and cross-platform apps',
                admin_id: users[3].id // sarah_johnson
              },
              {
                name: 'DevOps & Cloud',
                description: 'Share best practices for cloud infrastructure and deployment',
                admin_id: users[4].id // michael_brown
              }
            ];
            
            const insertCommunity = (index) => {
              if (index >= communities.length) {
                resolve();
                return;
              }
              
              const community = communities[index];
              db.run(
                'INSERT INTO communities (name, description, admin_id) VALUES (?, ?, ?)',
                [community.name, community.description, community.admin_id],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  const communityId = this.lastID;
                  
                  // Add admin as member
                  db.run(
                    'INSERT INTO community_members (community_id, user_id) VALUES (?, ?)',
                    [communityId, community.admin_id],
                    (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }
                      
                      // Add to search index
                      db.run(
                        'INSERT INTO community_search (rowid, name, description) VALUES (?, ?, ?)',
                        [communityId, community.name, community.description],
                        (err) => {
                          if (err) {
                            reject(err);
                            return;
                          }
                          
                          console.log(`Created community: ${community.name}`);
                          insertCommunity(index + 1);
                        }
                      );
                    }
                  );
                }
              );
            };
            
            insertCommunity(0);
          });
        });
      });
    };
    
    // Create some posts
    const createPosts = () => {
      return new Promise((resolve, reject) => {
        // Check if posts already exist
        db.get('SELECT COUNT(*) as count FROM posts', [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (result.count > 0) {
            console.log('Posts already exist, skipping post creation');
            resolve();
            return;
          }
          
          // Get user IDs
          db.all('SELECT id, username FROM users', [], (err, users) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Sample posts
            const posts = [
              {
                user_id: users[0].id,
                content: "Just launched my new React component library! Looking for collaborators to help expand it. Check it out and let me know what you think."
              },
              {
                user_id: users[1].id,
                content: "I'm creating a new design system and would love feedback from other designers. It focuses on accessibility and responsive layouts."
              },
              {
                user_id: users[2].id,
                content: "Working on a new machine learning model for natural language processing. Anyone interested in testing it out?"
              },
              {
                user_id: users[3].id,
                content: "Just published my new mobile app on both iOS and Android. It's a productivity tool for developers. Would love to get your thoughts!"
              },
              {
                user_id: users[4].id,
                content: "Looking for beta testers for my new CI/CD tool that simplifies AWS deployments. DM me if interested."
              },
              {
                user_id: users[0].id,
                content: "What frameworks is everyone using for their web projects in 2023? I'm considering trying out Svelte for my next project."
              },
              {
                user_id: users[1].id,
                content: "How do you handle design handoff to developers? Looking for better tools and processes to streamline our workflow."
              },
              {
                user_id: users[2].id,
                content: "Just published a research paper on neural networks. Happy to discuss the findings with anyone interested in AI advancement."
              },
              {
                user_id: users[3].id,
                content: "What's your take on cross-platform vs native mobile development in 2023? The landscape keeps changing rapidly."
              },
              {
                user_id: users[4].id,
                content: "Terraform vs. CloudFormation? What's your preference for infrastructure as code and why?"
              }
            ];
            
            const insertPost = (index) => {
              if (index >= posts.length) {
                resolve();
                return;
              }
              
              const post = posts[index];
              db.run(
                'INSERT INTO posts (user_id, content) VALUES (?, ?)',
                [post.user_id, post.content],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  console.log(`Created post by user ID ${post.user_id}`);
                  insertPost(index + 1);
                }
              );
            };
            
            insertPost(0);
          });
        });
      });
    };
    
    // Create some events
    const createEvents = () => {
      return new Promise((resolve, reject) => {
        // Check if events already exist
        db.get('SELECT COUNT(*) as count FROM events', [], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (result.count > 0) {
            console.log('Events already exist, skipping event creation');
            resolve();
            return;
          }
          
          // Get user IDs
          db.all('SELECT id, username FROM users', [], (err, users) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Create events (using dates relative to current date)
            const now = new Date();
            const events = [
              {
                title: 'Web Development Workshop',
                description: 'Learn the latest web development techniques and tools',
                date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                creator_id: users[0].id // john_doe
              },
              {
                title: 'UX Design Meetup',
                description: 'Networking event for UX designers to share ideas',
                date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                creator_id: users[1].id // jane_smith
              },
              {
                title: 'AI Research Presentation',
                description: 'Presenting new research in artificial intelligence',
                date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
                creator_id: users[2].id // alex_wilson
              },
              {
                title: 'Mobile App Development Hackathon',
                description: '24-hour hackathon focused on mobile app development',
                date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                creator_id: users[3].id // sarah_johnson
              },
              {
                title: 'Cloud Computing Conference',
                description: 'Annual conference on cloud technologies and practices',
                date: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
                creator_id: users[4].id // michael_brown
              }
            ];
            
            const insertEvent = (index) => {
              if (index >= events.length) {
                resolve();
                return;
              }
              
              const event = events[index];
              db.run(
                'INSERT INTO events (title, description, date, creator_id) VALUES (?, ?, ?, ?)',
                [event.title, event.description, event.date.toISOString(), event.creator_id],
                function(err) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  const eventId = this.lastID;
                  
                  // Add some attendees (other than creator)
                  const attendees = users
                    .filter(user => user.id !== event.creator_id)
                    .slice(0, 2); // Add 2 attendees
                  
                  if (attendees.length > 0) {
                    const attendeeValues = attendees.map(attendee => 
                      `(${eventId}, ${attendee.id}, 'going')`
                    ).join(', ');
                    
                    db.run(
                      `INSERT INTO event_attendees (event_id, user_id, status) VALUES ${attendeeValues}`,
                      function(err) {
                        if (err) {
                          console.error('Error adding attendees:', err.message);
                        }
                        
                        console.log(`Created event: ${event.title}`);
                        insertEvent(index + 1);
                      }
                    );
                  } else {
                    console.log(`Created event: ${event.title}`);
                    insertEvent(index + 1);
                  }
                }
              );
            };
            
            insertEvent(0);
          });
        });
      });
    };
    
    // Execute all initialization steps in sequence
    createTables()
      .then(() => createUsers())
      .then(() => createCommunities())
      .then(() => createPosts())
      .then(() => createEvents())
      .then(() => {
        console.log('Database initialized successfully with sample data');
        db.close();
      })
      .catch(err => {
        console.error('Error initializing database:', err);
        db.close();
      });
  });
}
