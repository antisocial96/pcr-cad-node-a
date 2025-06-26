import { Conversation } from '@elevenlabs/client';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');
const callsContainer = document.getElementById('callsContainer');

let conversation;
let conversationId = null;

async function getSignedUrl() {
    try {
        const response = await fetch('http://localhost:3001/api/get-signed-url');
        if (!response.ok) {
            throw new Error(`Failed to get signed url: ${response.statusText}`);
        }
        const { signedUrl } = await response.json();
        return signedUrl;
    } catch (error) {
        console.error('Error getting signed URL:', error);
        throw error;
    }
}

async function startConversation() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const signedUrl = await getSignedUrl();

        conversation = await Conversation.startSession({
            signedUrl,
            onConnect: () => {
                connectionStatus.textContent = 'Connected';
                connectionStatus.style.color = '#10b981';
                startButton.disabled = true;
                stopButton.disabled = false;
                
                if (conversation && conversation.conversationId) {
                    conversationId = conversation.conversationId;
                    console.log('Connected with conversation ID:', conversationId);
                }
            },
            onDisconnect: () => {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.style.color = '#ef4444';
                startButton.disabled = false;
                stopButton.disabled = true;
                conversationId = null;
            },
            onError: (error) => {
                console.error('Conversation error:', error);
                connectionStatus.textContent = 'Error';
                connectionStatus.style.color = '#ef4444';
                startButton.disabled = false;
                stopButton.disabled = true;
            },
            onModeChange: (mode) => {
                agentStatus.textContent = mode.mode === 'speaking' ? 'speaking' : 'listening';
                agentStatus.style.color = mode.mode === 'speaking' ? '#3b82f6' : '#10b981';
            },
        });
    } catch (error) {
        console.error('Failed to start conversation:', error);
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
            
            // Fetch updated data after conversation ends
            setTimeout(() => {
                fetchAndDisplayCalls();
            }, 100);
        } catch (error) {
            console.error('Error ending conversation:', error);
        }
    }
}

async function fetchAndDisplayCalls() {
    try {
        // Reset app to default state
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = '#ef4444';
        agentStatus.textContent = 'listening';
        agentStatus.style.color = '#10b981';
        startButton.disabled = false;
        stopButton.disabled = true;
        
        const response = await fetch('http://localhost:3001/api/calls');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch calls: ${response.statusText}`);
        }
        
        const calls = await response.json();
        displayCalls(calls);
        
    } catch (error) {
        console.error('Failed to fetch call records:', error);
        callsContainer.innerHTML = `
            <p style="text-align: center; color: #ef4444;">
                Failed to load call records: ${error.message}
            </p>
        `;
    }
}

function displayCalls(calls) {
    if (!calls || calls.length === 0) {
        callsContainer.innerHTML = `
            <p style="text-align: center; color: #666;">
                No call records found.
            </p>
        `;
        return;
    }
    
    // Sort by timestamp descending to ensure most recent calls first
    const sortedCalls = calls.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentCalls = sortedCalls.slice(0, 2);
    
    const callsHtml = recentCalls.map(call => {
        const intent = call.intent || 'unknown';
        const callIdLast4 = call.conversation_id ? call.conversation_id.slice(-4) : 'N/A';
        const timestamp = call.timestamp ? new Date(call.timestamp).toLocaleString() : 'N/A';
        
        // Use red for all non-unknown intents, gray for unknown
        const intentColor = intent === 'unknown' ? '#666' : '#ef4444';
        
        return `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 10px; background: #f9fafb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #374151;">Call ID: ...${callIdLast4}</strong>
                    <span style="background: ${intentColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                        ${intent.toUpperCase()}
                    </span>
                </div>
                <div style="color: #6b7280; font-size: 12px;">
                    ${timestamp}
                </div>
            </div>
        `;
    }).join('');
    
    const totalRecordsNote = calls.length > 2 ? 
        `<p style="text-align: center; color: #666; font-size: 12px; margin-top: 10px;">
            Showing 2 most recent calls (${calls.length} total)
        </p>` : '';
    
    callsContainer.innerHTML = callsHtml + totalRecordsNote;
}

startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

// Load initial call records
fetchAndDisplayCalls();