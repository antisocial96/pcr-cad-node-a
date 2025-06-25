import { Conversation } from '@elevenlabs/client';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');

let conversation;
let conversationId = null;

async function getSignedUrl() {
    const response = await fetch('https://nbcwwdwdgxlrkbdjoyub.supabase.co/functions/v1/get-signed-url');
    if (!response.ok) {
        throw new Error(`Failed to get signed url: ${response.statusText}`);
    }
    const { signedUrl } = await response.json();
    return signedUrl;
}

async function startConversation() {
    try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const signedUrl = await getSignedUrl();

        // Start the conversation
        conversation = await Conversation.startSession({
            signedUrl,
            onConnect: () => {
                connectionStatus.textContent = 'Connected';
                connectionStatus.style.color = '#10b981';
                startButton.disabled = true;
                stopButton.disabled = false;
                console.log('PCR CAD Voice AI: Connected to conversation');
                
                // Get the actual conversation ID from ElevenLabs
                if (conversation && conversation.conversationId) {
                    conversationId = conversation.conversationId;
                    console.log('PCR CAD Voice AI: Using ElevenLabs conversation ID:', conversationId);
                } else {
                    console.log('PCR CAD Voice AI: Waiting for conversation ID from webhook...');
                }
            },
            onDisconnect: () => {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.style.color = '#ef4444';
                startButton.disabled = false;
                stopButton.disabled = true;
                conversationId = null;
                console.log('PCR CAD Voice AI: Disconnected from conversation');
            },
            onError: (error) => {
                console.error('Error:', error);
                connectionStatus.textContent = 'Error';
                connectionStatus.style.color = '#ef4444';
                startButton.disabled = false;
                stopButton.disabled = true;
            },
            onModeChange: (mode) => {
                agentStatus.textContent = mode.mode === 'speaking' ? 'speaking' : 'listening';
                agentStatus.style.color = mode.mode === 'speaking' ? '#3b82f6' : '#10b981';
                console.log('PCR CAD Voice AI: Mode changed to', mode.mode);
            },
        });
    } catch (error) {
        console.error('PCR CAD Voice AI: Failed to start conversation:', error);
        connectionStatus.textContent = 'Failed to connect';
        connectionStatus.style.color = '#ef4444';
    }
}

async function stopConversation() {
    if (conversation) {
        try {
            await conversation.endSession();
            conversation = null;
            conversationId = null;
            console.log('PCR CAD Voice AI: Conversation ended');
        } catch (error) {
            console.error('PCR CAD Voice AI: Error ending conversation:', error);
        }
    }
}

// Function to update call intent (can be called when intent is detected)
async function updateCallIntent(intent) {
    if (conversationId) {
        try {
            const response = await fetch('https://nbcwwdwdgxlrkbdjoyub.supabase.co/functions/v1/calls-update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    conversation_id: conversationId,
                    intent,
                    action: 'update_intent'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update call intent: ${response.statusText}`);
            }
            
            console.log('PCR CAD Voice AI: Call intent updated to:', intent);
        } catch (error) {
            console.error('PCR CAD Voice AI: Failed to update call intent:', error);
        }
    }
}

// Function to update caller phone (can be called when phone number is detected)
async function updateCallerPhone(phoneNumber) {
    if (conversationId) {
        try {
            const response = await fetch('https://nbcwwdwdgxlrkbdjoyub.supabase.co/functions/v1/calls-update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    conversation_id: conversationId,
                    caller_phone: phoneNumber,
                    action: 'update_phone'
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update caller phone: ${response.statusText}`);
            }
            
            console.log('PCR CAD Voice AI: Caller phone updated to:', phoneNumber);
        } catch (error) {
            console.error('PCR CAD Voice AI: Failed to update caller phone:', error);
        }
    }
}

// Function to create a new call record (can be called when conversation starts)
async function createCallRecord(callData) {
    try {
        const response = await fetch('https://nbcwwdwdgxlrkbdjoyub.supabase.co/functions/v1/create_call', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(callData)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create call record: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('PCR CAD Voice AI: Call record created:', result);
        return result;
    } catch (error) {
        console.error('PCR CAD Voice AI: Failed to create call record:', error);
        throw error;
    }
}

// Event listeners
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

// Initialize the application
console.log('PCR CAD Voice AI: Frontend initialized and ready');

// Make functions available globally for debugging/testing
window.updateCallIntent = updateCallIntent;
window.updateCallerPhone = updateCallerPhone;
window.createCallRecord = createCallRecord;