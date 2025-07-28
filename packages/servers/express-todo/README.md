# Todo API - Express Performance Reference Application

A RESTful Todo API built with Express.js, designed as a reference application for performance benchmarking.

## Features

- **Authentication**: Token-based auth with register/login/logout
- **Task Management**: Full CRUD operations for tasks
- **Lists/Projects**: Organize tasks into lists
- **Search**: Search tasks by title or description
- **Filtering**: Filter tasks by status, list, pagination
- **Statistics**: Dashboard stats for tasks
- **Data Export**: Export all user data as JSON

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout (requires auth)
- `GET /api/auth/me` - Get current user (requires auth)

### Tasks
- `GET /api/tasks` - List tasks (paginated, filterable)
- `GET /api/tasks/:id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/search?q=query` - Search tasks

### Lists
- `GET /api/lists` - Get all lists
- `GET /api/lists/:id` - Get single list
- `POST /api/lists` - Create list
- `GET /api/lists/:id/tasks` - Get tasks in list

### Utility
- `GET /api/stats` - Get user statistics
- `GET /api/export` - Export all data

## Running the Server

```bash
npm install
npm start
```

The server runs on port 3000 by default (or PORT env variable).

## Running Benchmarks

```bash
# Against local server (default)
node benchmark.js

# Against remote server
BASE_URL=https://my-express-app.com node benchmark.js

# With custom port
PORT=8080 BASE_URL=http://localhost:8080 node benchmark.js
```

## Authentication

All `/api` routes except auth endpoints require authentication via Bearer token:

```
Authorization: Bearer <token>
```

## Data Models

### Task
```json
{
  "id": 1,
  "userId": 1,
  "title": "Complete project",
  "description": "Finish the Express app",
  "listId": 1,
  "status": "pending|in_progress|completed",
  "priority": "low|medium|high",
  "dueDate": "2024-12-31T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### List
```json
{
  "id": 1,
  "userId": 1,
  "name": "Work",
  "description": "Work-related tasks",
  "color": "#0066cc",
  "taskCount": 5,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Example Usage

### Register and Create a Task

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"Test User"}'

# Response includes token
# {"user":{...},"token":"abc123..."}

# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer abc123..." \
  -d '{"title":"My first task","description":"Testing the API"}'
```

## Performance Considerations

This application is designed for performance benchmarking:

- Uses in-memory storage (no database overhead)
- Includes common middleware patterns
- Provides various payload sizes and complexities
- Includes both CPU-bound (search) and I/O-like operations
- Supports high-concurrency scenarios

## Middleware Stack

- `helmet` - Security headers
- `cors` - CORS support
- `compression` - Response compression
- `morgan` - Request logging
- `cookie-parser` - Cookie parsing
- `body-parser` - Body parsing (JSON/URL-encoded)
