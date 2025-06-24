import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import callsRouter from './routes/calls.js';

// Load environment variables from root directory
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/calls', callsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PCR Backend is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`PCR Backend server running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});