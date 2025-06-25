import { Conversation } from '@elevenlabs/client';
import { supabase } from './supabase.js';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');
const callsContainer = document.getElementById('callsContainer');

let conversation;
let conversationId = null;

async function getSignedUrl() {
    const response = await fetch('/api/get-signed-url');
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
            
            // Fetch and display call data after conversation ends
            setTimeout(() => {
                fetchAndDisplayCalls();
            }, 2000); // Wait 2 seconds for webhook processing
        } catch (error) {
            console.error('PCR CAD Voice AI: Error ending conversation:', error);
        }
    }
}

// Function to update call intent (can be called when intent is detected)
async function updateCallIntent(intent) {
    if (conversationId) {
        try {
            const response = await fetch(`/api/calls/${conversationId}/intent`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ intent })
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
            const response = await fetch(`/api/calls/${conversationId}/phone`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ caller_phone: phoneNumber })
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

// Function to fetch and display all call records
async function fetchAndDisplayCalls() {
    try {
        console.log('PCR CAD Voice AI: Fetching call records...');
        const response = await fetch('/api/calls');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch calls: ${response.statusText}`);
        }
        
        const calls = await response.json();
        console.log('PCR CAD Voice AI: Retrieved call records:', calls);
        
        displayCalls(calls);
        
    } catch (error) {
        console.error('PCR CAD Voice AI: Failed to fetch call records:', error);
        callsContainer.innerHTML = `
            <p style="text-align: center; color: #ef4444;">
                Failed to load call records: ${error.message}
            </p>
        `;
    }
}

// Function to display call records in the UI
function displayCalls(calls) {
    if (!calls || calls.length === 0) {
        callsContainer.innerHTML = `
            <p style="text-align: center; color: #666;">
                No call records found.
            </p>
        `;
        return;
    }
    
    const callsHtml = calls.map(call => {
        const timestamp = call.timestamp ? new Date(call.timestamp).toLocaleString() : 'N/A';
        const intent = call.intent || 'unknown';
        const phone = call.caller_phone || 'N/A';
        const conversationId = call.conversation_id || 'N/A';
        
        // Color code intents
        let intentColor = '#666';
        if (intent === 'emergency') intentColor = '#ef4444';
        else if (intent === 'medical') intentColor = '#f59e0b';
        else if (intent === 'fire') intentColor = '#dc2626';
        else if (intent === 'police') intentColor = '#3b82f6';
        else if (intent !== 'unknown') intentColor = '#10b981';
        
        return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #374151;">Call ID: ${conversationId.substring(0, 8)}...</strong>
                    <span style="background: ${intentColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        ${intent.toUpperCase()}
                    </span>
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp}</p>
                    <p style="margin: 5px 0;"><strong>Conversation ID:</strong> ${conversationId}</p>
                </div>
            </div>
        `;
    }).join('');
    
    callsContainer.innerHTML = callsHtml;
}

// Event listeners
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

// Initialize the application
console.log('PCR CAD Voice AI: Frontend initialized and ready');
console.log('PCR CAD Voice AI: Supabase connected to:', import.meta.env.VITE_SUPABASE_URL);

// Load call records on page load to show existing data
fetchAndDisplayCalls();

// Make functions available globally for debugging/testing
window.updateCallIntent = updateCallIntent;