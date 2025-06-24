import crypto from 'crypto';
import { backendConfig } from '../config.js';
import { garudaSentryCalls } from '../supabase.js';

// Verify ElevenLabs webhook signature
function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    console.warn('No webhook secret configured - skipping signature verification');
    return true;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Process post-call webhook data
export async function handlePostCallWebhook(req, res) {
  try {
    const signature = req.headers['x-elevenlabs-signature'];
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature if secret is configured
    if (backendConfig.webhookSecret && signature) {
      const isValid = verifyWebhookSignature(payload, signature, backendConfig.webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    const webhookData = req.body;
    console.log('Received ElevenLabs post-call webhook:', JSON.stringify(webhookData, null, 2));
    
    // Extract conversation ID from the webhook data
    const conversationId = webhookData.conversation_id;
    
    if (!conversationId) {
      console.error('No conversation_id found in webhook data');
      return res.status(400).json({ error: 'Missing conversation_id' });
    }
    
    // Check if we have a record for this conversation
    try {
      const existingCall = await garudaSentryCalls.getByConversationId(conversationId);
      
      if (existingCall) {
        // Update existing record with post-call data
        const updatedCall = await garudaSentryCalls.updatePostCallData(conversationId, webhookData);
        console.log('Updated call record with post-call data:', updatedCall);
        
        res.status(200).json({ 
          success: true, 
          message: 'Post-call data processed successfully',
          call_id: updatedCall.id
        });
      } else {
        // Create new record if it doesn't exist (fallback case)
        console.log('No existing call record found, creating new one');
        
        const newCallData = {
          conversation_id: conversationId,
          intent: webhookData.intent || 'unknown',
          caller_phone: webhookData.conversation_data?.caller_phone || null
        };
        
        const newCall = await garudaSentryCalls.create(newCallData);
        console.log('Created new call record from webhook:', newCall);
        
        res.status(201).json({ 
          success: true, 
          message: 'New call record created from webhook',
          call_id: newCall.id
        });
      }
    } catch (dbError) {
      console.error('Database error processing webhook:', dbError);
      res.status(500).json({ error: 'Database error processing webhook' });
    }
    
  } catch (error) {
    console.error('Error processing ElevenLabs webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Health check for webhook endpoint
export function webhookHealthCheck(req, res) {
  res.status(200).json({ 
    status: 'OK', 
    message: 'ElevenLabs webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}