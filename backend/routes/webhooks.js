import express from 'express';
import { garudaSentryCallsDB } from '../lib/supabase.js';

const router = express.Router();

// ElevenLabs webhook endpoint for conversation events
router.post('/elevenlabs', async (req, res) => {
  try {
    console.log('ElevenLabs webhook received:', JSON.stringify(req.body, null, 2));
    
    const { event_type, conversation_id, conversation } = req.body;
    
    // Handle different event types
    switch (event_type) {
      case 'conversation.started':
        await handleConversationStarted(conversation_id, conversation);
        break;
        
      case 'conversation.ended':
        await handleConversationEnded(conversation_id, conversation);
        break;
        
      case 'conversation.updated':
        await handleConversationUpdated(conversation_id, conversation);
        break;
        
      default:
        console.log(`Unhandled event type: ${event_type}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('Error processing ElevenLabs webhook:', error);
    // Still return 200 to prevent ElevenLabs from retrying
    res.status(200).json({ success: false, error: error.message });
  }
});

// Handle conversation started event
async function handleConversationStarted(conversationId, conversation) {
  console.log(`Conversation started: ${conversationId}`);
  
  try {
    // Extract caller phone if available
    const callerPhone = conversation?.caller_phone || null;
    
    // Create initial call record
    await garudaSentryCallsDB.create({
      conversation_id: conversationId,
      intent: 'unknown', // Will be updated as conversation progresses
      caller_phone: callerPhone
    });
    
    console.log(`Created call record for conversation: ${conversationId}`);
  } catch (error) {
    // If record already exists, that's okay
    if (error.code === '23505') { // Unique constraint violation
      console.log(`Call record already exists for conversation: ${conversationId}`);
    } else {
      throw error;
    }
  }
}

// Handle conversation ended event
async function handleConversationEnded(conversationId, conversation) {
  console.log(`Conversation ended: ${conversationId}`);
  
  try {
    // Extract intent from conversation data
    const intent = extractIntentFromConversation(conversation);
    
    // Update the call record with final intent
    await garudaSentryCallsDB.update(conversationId, {
      intent: intent
    });
    
    console.log(`Updated call record with intent "${intent}" for conversation: ${conversationId}`);
  } catch (error) {
    console.error(`Error updating conversation ${conversationId}:`, error);
  }
}

// Handle conversation updated event
async function handleConversationUpdated(conversationId, conversation) {
  console.log(`Conversation updated: ${conversationId}`);
  
  try {
    // Extract current intent from conversation
    const intent = extractIntentFromConversation(conversation);
    
    // Only update if we have a meaningful intent
    if (intent && intent !== 'unknown') {
      await garudaSentryCallsDB.update(conversationId, {
        intent: intent
      });
      
      console.log(`Updated call record with intent "${intent}" for conversation: ${conversationId}`);
    }
  } catch (error) {
    console.error(`Error updating conversation ${conversationId}:`, error);
  }
}

// Extract intent from conversation data
function extractIntentFromConversation(conversation) {
  if (!conversation) return 'unknown';
  
  // Get the conversation transcript or messages
  const transcript = conversation.transcript || '';
  const messages = conversation.messages || [];
  
  // Combine all text content
  let fullText = transcript;
  if (messages.length > 0) {
    fullText += ' ' + messages.map(msg => msg.content || msg.text || '').join(' ');
  }
  
  // Convert to lowercase for analysis
  const text = fullText.toLowerCase();
  
  // Intent detection keywords
  const intentKeywords = {
    fire: ['fire', 'burning', 'smoke', 'flames', 'burn', 'arson', 'explosion'],
    medical: ['medical', 'ambulance', 'heart attack', 'stroke', 'injury', 'accident', 'bleeding', 'unconscious', 'emergency medical', 'hospital', 'doctor', 'hurt', 'pain', 'sick'],
    police: ['police', 'crime', 'robbery', 'theft', 'assault', 'break in', 'burglary', 'violence', 'domestic', 'fight', 'weapon', 'gun', 'knife'],
    traffic: ['car accident', 'traffic', 'collision', 'crash', 'vehicle', 'highway', 'road'],
    rescue: ['rescue', 'trapped', 'stuck', 'water rescue', 'mountain rescue', 'search and rescue']
  };
  
  // Check for intent keywords
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return intent;
      }
    }
  }
  
  return 'unknown';
}

export default router;