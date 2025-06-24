import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import callsRouter from './routes/calls.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/calls', callsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PCR Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`PCR Backend server running on port ${PORT}`);
});