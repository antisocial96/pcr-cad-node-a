import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import callsRouter from './routes/calls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory (.env file)
const envPath = join(__dirname, '../.env');
config({ path: envPath });

// Debug environment loading
console.log('Loading environment from:', envPath);
console.log('Environment variables loaded:', {
  PORT: process.env.PORT || 'not set',
  SUPABASE_URL: process.env.SUPABASE_URL ? 'loaded' : 'missing',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'loaded' : 'missing',
  NODE_ENV: process.env.NODE_ENV || 'not set'
});

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
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`PCR Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/api/calls`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});