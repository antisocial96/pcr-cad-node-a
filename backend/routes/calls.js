import express from 'express';
import { emergencyCallsDB } from '../lib/supabase.js';

const router = express.Router();

// GET /api/calls - Get all emergency calls
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      intent: req.query.intent,
      priority_level: req.query.priority_level ? parseInt(req.query.priority_level) : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const calls = await emergencyCallsDB.getAll(filters);
    res.json({ success: true, data: calls });
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/calls/priority - Get calls sorted by priority
router.get('/priority', async (req, res) => {
  try {
    const calls = await emergencyCallsDB.getByPriority();
    res.json({ success: true, data: calls });
  } catch (error) {
    console.error('Error fetching calls by priority:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/calls/:conversationId - Get specific call by conversation ID
router.get('/:conversationId', async (req, res) => {
  try {
    const call = await emergencyCallsDB.getByConversationId(req.params.conversationId);
    
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }

    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/calls/:conversationId - Update call status/details
router.put('/:conversationId', async (req, res) => {
  try {
    const updates = req.body;
    const call = await emergencyCallsDB.update(req.params.conversationId, updates);
    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Error updating call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;