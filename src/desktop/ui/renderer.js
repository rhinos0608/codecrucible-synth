
const socket = io();
let currentMode = 'competitive';
let selectedVoices = [];
let isGenerating = false;

const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const outputSection = document.getElementById('outputSection');
const statusIndicator = document.getElementById('statusIndicator');
const voiceSelector = document.getElementById('voiceSelector');

// Load available voices
fetch('/api/voices')
    .then(res => res.json())
    .then(data => {
        selectedVoices = [...data.default];
        renderVoiceSelector(data.available);
    });

// Check status
fetch('/api/status')
    .then(res => res.json())
    .then(data => {
        if (data.model.available) {
            statusIndicator.innerHTML = '<span class="status-online">● Model Ready</span>';
        } else {
            statusIndicator.innerHTML = '<span class="status-offline">● Model Offline</span>';
        }
    })
    .catch(() => {
        statusIndicator.innerHTML = '<span class="status-offline">● Connection Error</span>';
    });

function renderVoiceSelector(voices) {
    voiceSelector.innerHTML = voices.map(voice => 
        `<div class="voice-chip ${selectedVoices.includes(voice) ? 'active' : ''}" data-voice="${voice}">
            ${voice}
        </div>`
    ).join('');
    
    // Add click handlers
    document.querySelectorAll('.voice-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const voice = chip.dataset.voice;
            if (selectedVoices.includes(voice)) {
                selectedVoices = selectedVoices.filter(v => v !== voice);
                chip.classList.remove('active');
            } else {
                selectedVoices.push(voice);
                chip.classList.add('active');
            }
        });
    });
}

// Mode selection
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    });
});

// Generate button
generateBtn.addEventListener('click', generateCode);

// Enter key to generate
promptInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        generateCode();
    }
});

function generateCode() {
    const prompt = promptInput.value.trim();
    if (!prompt || isGenerating) return;
    
    if (selectedVoices.length === 0) {
        alert('Please select at least one voice');
        return;
    }
    
    isGenerating = true;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    outputSection.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <div>Consulting ${selectedVoices.join(', ')} in ${currentMode} mode...</div>
        </div>
    `;
    
    socket.emit('generate_code', {
        prompt,
        voices: selectedVoices,
        mode: currentMode
    });
}

socket.on('generation_complete', (data) => {
    isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate';
    
    if (data.success) {
        displayResults(data.result, data.responses);
    } else {
        outputSection.innerHTML = `
            <div class="result">
                <h3 style="color: #ff6b6b;">Generation Failed</h3>
                <p>${data.error}</p>
            </div>
        `;
    }
});

function displayResults(synthesis, responses) {
    let html = '<div class="result">';
    
    // Synthesis result
    html += `
        <h3>🎉 Synthesis Result</h3>
        <div class="confidence">
            Quality Score: ${synthesis.qualityScore}/100 | 
            Confidence: ${Math.round(synthesis.confidence * 100)}% |
            Voices: ${synthesis.voicesUsed.join(' + ')}
        </div>
    `;
    
    if (synthesis.combinedCode) {
        html += `<div class="code-block">${escapeHtml(synthesis.combinedCode)}</div>`;
    }
    
    if (synthesis.reasoning) {
        html += `<p><strong>Reasoning:</strong> ${synthesis.reasoning}</p>`;
    }
    
    // Individual voice responses
    html += '<h4>Voice Contributions:</h4>';
    responses.forEach(response => {
        html += `
            <div class="voice-response">
                <div class="voice-name">${response.voice}</div>
                <div class="confidence">Confidence: ${Math.round(response.confidence * 100)}%</div>
                <div>${escapeHtml(response.content)}</div>
            </div>
        `;
    });
    
    html += '</div>';
    outputSection.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle menu actions from Electron
if (window.electronAPI) {
    window.electronAPI.onMenuAction((action, data) => {
        switch (action) {
            case 'quick-generate':
                promptInput.focus();
                break;
            case 'voice-council':
                // Select all voices
                selectedVoices = Array.from(document.querySelectorAll('.voice-chip')).map(chip => chip.dataset.voice);
                renderVoiceSelector(selectedVoices);
                break;
        }
    });
}
