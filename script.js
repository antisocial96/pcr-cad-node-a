// PCR Emergency Call System - Frontend
console.log('PCR Emergency Call System - Frontend initialized');

// API configuration
const API_BASE_URL = 'http://localhost:3001/api';

// DOM elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');

// Application state
let isConnected = false;
let currentConversationId = null;

// Event listeners
startButton?.addEventListener('click', startConversation);
stopButton?.addEventListener('click', stopConversation);

async function startConversation() {
    try {
        updateUI('connecting');
        
        // Simulate conversation start
        currentConversationId = `conv_${Date.now()}`;
        
        // Create call record in database
        await createCallRecord(currentConversationId);
        
        isConnected = true;
        updateUI('connected');
        
        console.log('Conversation started:', currentConversationId);
    } catch (error) {
        console.error('Failed to start conversation:', error);
        updateUI('error');
    }
}

async function stopConversation() {
    try {
        if (currentConversationId) {
            // Update call record
            await updateCallRecord(currentConversationId, { intent: 'completed' });
        }
        
        isConnected = false;
        currentConversationId = null;
        updateUI('disconnected');
        
        console.log('Conversation stopped');
    } catch (error) {
        console.error('Failed to stop conversation:', error);
    }
}

async function createCallRecord(conversationId) {
    const response = await fetch(`${API_BASE_URL}/calls`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            conversation_id: conversationId,
            intent: 'unknown',
            caller_phone: '+1234567890' // Mock phone number
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to create call record');
    }
    
    return response.json();
}

async function updateCallRecord(conversationId, updates) {
    const response = await fetch(`${API_BASE_URL}/calls/${conversationId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
        throw new Error('Failed to update call record');
    }
    
    return response.json();
}

function updateUI(state) {
    switch (state) {
        case 'connecting':
            startButton.disabled = true;
            stopButton.disabled = true;
            connectionStatus.textContent = 'Connecting...';
            connectionStatus.style.color = '#ff9800';
            agentStatus.textContent = 'initializing';
            break;
            
        case 'connected':
            startButton.disabled = true;
            stopButton.disabled = false;
            stopButton.style.opacity = '1';
            connectionStatus.textContent = 'Connected';
            connectionStatus.style.color = '#4CAF50';
            agentStatus.textContent = 'listening';
            break;
            
        case 'disconnected':
            startButton.disabled = false;
            stopButton.disabled = true;
            stopButton.style.opacity = '0.6';
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.style.color = '#f44336';
            agentStatus.textContent = 'offline';
            break;
            
        case 'error':
            startButton.disabled = false;
            stopButton.disabled = true;
            stopButton.style.opacity = '0.6';
            connectionStatus.textContent = 'Error';
            connectionStatus.style.color = '#f44336';
            agentStatus.textContent = 'error';
            break;
    }
}