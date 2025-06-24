import { Conversation } from '@elevenlabs/client';
import { supabase, garudaSentryCalls } from './supabase.js';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');

let conversation;
let currentCallRecord = null;

async function getSignedUrl() {
    const response = await fetch('http://localhost:3001/api/get-signed-url');
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
                // Create a call record when conversation starts
                createCallRecord();
                connectionStatus.textContent = 'Connected';
                connectionStatus.style.color = '#10b981';
                startButton.disabled = true;
                stopButton.disabled = false;
                console.log('PCR CAD Voice AI: Connected to conversation');
            },
            onDisconnect: () => {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.style.color = '#ef4444';
                startButton.disabled = false;
                stopButton.disabled = true;
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

async function createCallRecord() {
    try {
        // Generate a unique conversation ID
        const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const callData = {
            conversation_id: conversationId,
            intent: 'unknown',
            caller_phone: null // Will be updated if phone number is detected
        };
        
        currentCallRecord = await garudaSentryCalls.create(callData);
        console.log('PCR CAD Voice AI: Call record created:', currentCallRecord);
    } catch (error) {
        console.error('PCR CAD Voice AI: Failed to create call record:', error);
    }
}

async function stopConversation() {
    if (conversation) {
        try {
            await conversation.endSession();
            conversation = null;
            currentCallRecord = null;
            console.log('PCR CAD Voice AI: Conversation ended');
        } catch (error) {
            console.error('PCR CAD Voice AI: Error ending conversation:', error);
        }
    }
}

// Function to update call intent (can be called when intent is detected)
async function updateCallIntent(intent) {
    if (currentCallRecord) {
        try {
            await garudaSentryCalls.updateIntent(currentCallRecord.conversation_id, intent);
            console.log('PCR CAD Voice AI: Call intent updated to:', intent);
        } catch (error) {
            console.error('PCR CAD Voice AI: Failed to update call intent:', error);
        }
    }
}

// Function to update caller phone (can be called when phone number is detected)
async function updateCallerPhone(phoneNumber) {
    if (currentCallRecord) {
        try {
            await garudaSentryCalls.updateCallerPhone(currentCallRecord.conversation_id, phoneNumber);
            console.log('PCR CAD Voice AI: Caller phone updated to:', phoneNumber);
        } catch (error) {
            console.error('PCR CAD Voice AI: Failed to update caller phone:', error);
        }
    }
}

// Event listeners
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

// Initialize the application
console.log('PCR CAD Voice AI: Frontend initialized and ready');
console.log('PCR CAD Voice AI: Supabase connected to:', import.meta.env.SUPABASE_URL);

// Make functions available globally for debugging/testing
window.updateCallIntent = updateCallIntent;
window.updateCallerPhone = updateCallerPhone;
window.garudaSentryCalls = garudaSentryCalls;