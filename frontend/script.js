import { Conversation } from '@elevenlabs/client';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');

let conversation;

async function startConversation() {
    try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Start the conversation
        conversation = await Conversation.startSession({
            agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID,
            onConnect: () => {
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
                console.error('PCR CAD Voice AI Error:', error);
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
            console.log('PCR CAD Voice AI: Conversation ended');
        } catch (error) {
            console.error('PCR CAD Voice AI: Error ending conversation:', error);
        }
    }
}

// Event listeners
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

// Initialize the application
console.log('PCR CAD Voice AI: Frontend initialized and ready');