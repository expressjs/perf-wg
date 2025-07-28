const start = process.hrtime();
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware stack
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory data storage
const db = {
  users: new Map(),
  tasks: new Map(),
  lists: new Map(),
  sessions: new Map()
};

// Initialize with some data
let taskIdCounter = 1;
let listIdCounter = 1;
let userIdCounter = 1;

// Helper functions
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const session = db.sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = db.users.get(session.userId);
  req.token = token;
  next();
};

// Validation middleware
const validateTask = (req, res, next) => {
  const { title } = req.body;
  
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  next();
};

const validateList = (req, res, next) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  next();
};

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Todo API',
    version: '1.0.0',
    endpoints: {
      auth: ['/api/auth/register', '/api/auth/login', '/api/auth/logout', '/api/auth/me'],
      tasks: ['/api/tasks', '/api/tasks/:id'],
      lists: ['/api/lists', '/api/lists/:id', '/api/lists/:id/tasks'],
      utility: ['/api/stats', '/api/export', '/api/tasks/search']
    }
  });
});

// Auth routes
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  
  // Check if user exists
  const existingUser = Array.from(db.users.values()).find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }
  
  const userId = userIdCounter++;
  const user = {
    id: userId,
    email,
    name,
    password: hashPassword(password),
    createdAt: new Date()
  };
  
  db.users.set(userId, user);
  
  // Create session
  const token = generateToken();
  db.sessions.set(token, { userId, createdAt: new Date() });
  
  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name },
    token
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  const user = Array.from(db.users.values()).find(u => u.email === email);
  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Create session
  const token = generateToken();
  db.sessions.set(token, { userId: user.id, createdAt: new Date() });
  
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token
  });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  db.sessions.delete(req.token);
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { id, email, name, createdAt } = req.user;
  res.json({ id, email, name, createdAt });
});

// Task routes
app.get('/api/tasks', authMiddleware, (req, res) => {
  const { page = 1, limit = 20, status, listId } = req.query;
  const offset = (page - 1) * limit;
  
  let tasks = Array.from(db.tasks.values()).filter(task => task.userId === req.user.id);
  
  // Filter by status
  if (status) {
    tasks = tasks.filter(task => task.status === status);
  }
  
  // Filter by list
  if (listId) {
    tasks = tasks.filter(task => task.listId === parseInt(listId));
  }
  
  // Sort by creation date (newest first)
  tasks.sort((a, b) => b.createdAt - a.createdAt);
  
  const total = tasks.length;
  const paginatedTasks = tasks.slice(offset, offset + parseInt(limit));
  
  res.json({
    tasks: paginatedTasks,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

app.get('/api/tasks/:id', authMiddleware, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.tasks.get(taskId);
  
  if (!task || task.userId !== req.user.id) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json(task);
});

app.post('/api/tasks', authMiddleware, validateTask, (req, res) => {
  const { title, description, listId, dueDate, priority } = req.body;
  
  const taskId = taskIdCounter++;
  const task = {
    id: taskId,
    userId: req.user.id,
    title: title.trim(),
    description: description || '',
    listId: listId ? parseInt(listId) : null,
    status: 'pending',
    priority: priority || 'medium',
    dueDate: dueDate ? new Date(dueDate) : null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.tasks.set(taskId, task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', authMiddleware, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.tasks.get(taskId);
  
  if (!task || task.userId !== req.user.id) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const { title, description, listId, status, dueDate, priority } = req.body;
  
  // Update fields if provided
  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description;
  if (listId !== undefined) task.listId = listId ? parseInt(listId) : null;
  if (status !== undefined) task.status = status;
  if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
  if (priority !== undefined) task.priority = priority;
  
  task.updatedAt = new Date();
  
  res.json(task);
});

app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.tasks.get(taskId);
  
  if (!task || task.userId !== req.user.id) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  db.tasks.delete(taskId);
  res.status(204).send();
});

// List routes
app.get('/api/lists', authMiddleware, (req, res) => {
  const lists = Array.from(db.lists.values())
    .filter(list => list.userId === req.user.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Add task count to each list
  const listsWithCounts = lists.map(list => {
    const taskCount = Array.from(db.tasks.values())
      .filter(task => task.userId === req.user.id && task.listId === list.id)
      .length;
    
    return { ...list, taskCount };
  });
  
  res.json(listsWithCounts);
});

app.get('/api/lists/:id', authMiddleware, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = db.lists.get(listId);
  
  if (!list || list.userId !== req.user.id) {
    return res.status(404).json({ error: 'List not found' });
  }
  
  const taskCount = Array.from(db.tasks.values())
    .filter(task => task.userId === req.user.id && task.listId === list.id)
    .length;
  
  res.json({ ...list, taskCount });
});

app.post('/api/lists', authMiddleware, validateList, (req, res) => {
  const { name, description, color } = req.body;
  
  const listId = listIdCounter++;
  const list = {
    id: listId,
    userId: req.user.id,
    name: name.trim(),
    description: description || '',
    color: color || '#0066cc',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.lists.set(listId, list);
  res.status(201).json({ ...list, taskCount: 0 });
});

app.get('/api/lists/:id/tasks', authMiddleware, (req, res) => {
  const listId = parseInt(req.params.id);
  const list = db.lists.get(listId);
  
  if (!list || list.userId !== req.user.id) {
    return res.status(404).json({ error: 'List not found' });
  }
  
  const tasks = Array.from(db.tasks.values())
    .filter(task => task.userId === req.user.id && task.listId === listId)
    .sort((a, b) => b.createdAt - a.createdAt);
  
  res.json({
    list,
    tasks
  });
});

// Search route
app.get('/api/tasks/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  const query = q.toLowerCase();
  const tasks = Array.from(db.tasks.values())
    .filter(task => {
      if (task.userId !== req.user.id) return false;
      
      return task.title.toLowerCase().includes(query) ||
             task.description.toLowerCase().includes(query);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  
  res.json({ 
    query: q,
    count: tasks.length,
    tasks 
  });
});

// Stats route
app.get('/api/stats', authMiddleware, (req, res) => {
  const userTasks = Array.from(db.tasks.values())
    .filter(task => task.userId === req.user.id);
  
  const stats = {
    total: userTasks.length,
    byStatus: {
      pending: userTasks.filter(t => t.status === 'pending').length,
      inProgress: userTasks.filter(t => t.status === 'in_progress').length,
      completed: userTasks.filter(t => t.status === 'completed').length
    },
    byPriority: {
      high: userTasks.filter(t => t.priority === 'high').length,
      medium: userTasks.filter(t => t.priority === 'medium').length,
      low: userTasks.filter(t => t.priority === 'low').length
    },
    lists: db.lists.size,
    overdue: userTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length
  };
  
  res.json(stats);
});

// Export route
app.get('/api/export', authMiddleware, (req, res) => {
  const userTasks = Array.from(db.tasks.values())
    .filter(task => task.userId === req.user.id);
  
  const userLists = Array.from(db.lists.values())
    .filter(list => list.userId === req.user.id);
  
  const exportData = {
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    },
    lists: userLists,
    tasks: userTasks,
    exportedAt: new Date()
  };
  
  res.json(exportData);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Start server
const server = app.listen(PORT, (err) => {
  if (err) {
    console.error(`Error starting server: ${err.message}`)
    process.exit(1)
  }
  console.log(`Todo API server listening on port ${PORT}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Node version: ${process.version}`);
  console.log(`startup: ${process.hrtime(start)}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;
