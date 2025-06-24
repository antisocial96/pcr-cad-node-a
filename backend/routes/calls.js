import express from 'express';
import { garudaSentryCallsDB } from '../lib/supabase.js';

const router = express.Router();

// GET /api/calls - Get all garuda sentry calls
router.get('/', async (req, res) => {
  try {
    const filters = {
      intent: req.query.intent
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    const calls = await garudaSentryCallsDB.getAll(filters);
    res.json({ success: true, data: calls });
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/calls - Create new garuda sentry call
router.post('/', async (req, res) => {
  try {
    const callData = req.body;
    const call = await garudaSentryCallsDB.create(callData);
    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/calls/:conversationId - Get specific call by conversation ID
router.get('/:conversationId', async (req, res) => {
  try {
    const call = await garudaSentryCallsDB.getByConversationId(req.params.conversationId);
    
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
    const call = await garudaSentryCallsDB.update(req.params.conversationId, updates);
    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Error updating call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;