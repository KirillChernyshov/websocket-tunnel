import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text());
app.use(express.raw());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Test endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Test Local Server',
    uptime: process.uptime(),
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Hello from local server!',
    method: req.method,
    path: req.path,
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/echo', (req, res) => {
  res.json({
    message: 'Echo response',
    receivedData: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
});

app.put('/api/data/:id', (req, res) => {
  res.json({
    message: `Updated item ${req.params.id}`,
    id: req.params.id,
    data: req.body,
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

app.delete('/api/data/:id', (req, res) => {
  res.json({
    message: `Deleted item ${req.params.id}`,
    id: req.params.id,
    timestamp: new Date().toISOString(),
  });
});

// Simulate different response times
app.get('/api/slow', (req, res) => {
  const delay = parseInt(req.query.delay as string) || 2000;
  setTimeout(() => {
    res.json({
      message: `Slow response after ${delay}ms`,
      delay,
      timestamp: new Date().toISOString(),
    });
  }, delay);
});

// Simulate errors
app.get('/api/error/:code', (req, res) => {
  const code = parseInt(req.params.code) || 500;
  res.status(code).json({
    error: true,
    statusCode: code,
    message: `Simulated error with status ${code}`,
    timestamp: new Date().toISOString(),
  });
});

// Catch-all endpoint
app.use('*', (req, res) => {
  res.json({
    message: 'Catch-all endpoint',
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test Local Server running on http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoints:`);
  console.log(`   GET  /api/test`);
  console.log(`   POST /api/echo`);
  console.log(`   PUT  /api/data/:id`);
  console.log(`   DELETE /api/data/:id`);
  console.log(`   GET  /api/slow?delay=2000`);
  console.log(`   GET  /api/error/404`);
});
