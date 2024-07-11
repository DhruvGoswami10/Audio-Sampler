const pads = document.querySelectorAll('.pad');
const fileInput = document.getElementById('fileInput');
const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const saveButton = document.getElementById('saveButton');
const clearAllButton = document.getElementById('clearAllButton');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const savedPadsList = document.getElementById('savedPadsList');
const pitchSlider = document.getElementById('pitchSlider');
const gainSlider = document.getElementById('gainSlider');
const lowPassSlider = document.getElementById('lowPassSlider');

let audioContext;
let mediaRecorder;
let chunks = [];
let recordedAudio;
let padSounds = {};

const savedSystems = JSON.parse(localStorage.getItem('savedSystems')) || {};

function updateSlider(slider) {
    const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(to right, orange ${value}%, #e0e0e0 ${value}%)`;
}

// Initialize the sliders
document.querySelectorAll('#sliders input[type=range]').forEach(slider => {
    updateSlider(slider);
    slider.addEventListener('input', () => updateSlider(slider)); // Add input event listener to each slider
});

function updateSavedPadsList() {
    savedPadsList.innerHTML = '';
    Object.keys(savedSystems).forEach(systemName => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = systemName;
        listItem.onclick = () => loadSystem(systemName);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = (event) => {
            event.stopPropagation();
            deleteSystem(systemName);
        };

        listItem.appendChild(deleteButton);
        savedPadsList.appendChild(listItem);
    });
}

function loadSound(event) {
    const padNumber = prompt('Enter pad number (1-9):');
    if (padNumber < 1 || padNumber > 9) return;

    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const audio = new Audio(e.target.result);
        setupAudioNodes(padNumber, audio); // Setup audio nodes including gain and low pass
    };
    
    reader.readAsDataURL(file);
}

function setupAudioNodes(padNumber, audio) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const source = audioContext.createMediaElementSource(audio);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = gainSlider.value; // Set initial gain value from slider

    const lowPassFilter = audioContext.createBiquadFilter();
    lowPassFilter.type = 'lowpass';
    lowPassFilter.frequency.value = lowPassSlider.value;

    source.connect(gainNode).connect(lowPassFilter).connect(audioContext.destination);

    padSounds[padNumber] = { audio: audio, source: source, gainNode: gainNode, lowPassFilter: lowPassFilter };
}

function playSound(padNumber) {
    const sound = padSounds[padNumber];
    if (sound) {
        sound.audio.currentTime = 0;
        sound.audio.play();
    }
}

function startRecording() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => chunks.push(event.data);
            mediaRecorder.onstop = saveRecording;
            mediaRecorder.start();
            
            recordButton.disabled = true;
            stopButton.disabled = false;
        });
}

function stopRecording() {
    mediaRecorder.stop();
    recordButton.disabled = false;
    stopButton.disabled = true;
}

function saveRecording() {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    recordedAudio = new Audio(url);
    
    const padNumber = prompt('Enter pad number (1-9) to save recording:');
    if (padNumber < 1 || padNumber > 9) return;
    
    setupAudioNodes(padNumber, recordedAudio);
    chunks = [];
}

function handleKeyDown(event) {
    if(document.activeElement === searchInput){
        return;
    }

    const key = event.key;
    if (key >= 1 && key <= 9) {
        playSound(key);
    } else if (key === 'r' || key === 'R') {
        startRecording();
    } else if (key === 's' || key === 'S') {
        stopRecording();
    }
}

function saveSystem() {
    const systemName = prompt('Enter a name for the system:');
    if (!systemName) return;

    const systemData = {};
    Object.keys(padSounds).forEach(padNumber => {
        systemData[padNumber] = {
            src: padSounds[padNumber].audio.src,
            gain: padSounds[padNumber].gainNode.gain.value,
            lowPass: padSounds[padNumber].lowPassFilter.frequency.value,
            pitch: padSounds[padNumber].audio.playbackRate
        };
    });

    savedSystems[systemName] = systemData;
    localStorage.setItem('savedSystems', JSON.stringify(savedSystems));
    updateSavedPadsList();
}

function loadSystem(systemName) {
    clearAllPads(); // Clear all pads before loading the new system

    const systemData = savedSystems[systemName];
    if (!systemData) return;

    Object.keys(systemData).forEach(padNumber => {
        const audio = new Audio(systemData[padNumber].src);
        setupAudioNodes(padNumber, audio);
        padSounds[padNumber].gainNode.gain.value = systemData[padNumber].gain;
        padSounds[padNumber].lowPassFilter.frequency.value = systemData[padNumber].lowPass;
        padSounds[padNumber].audio.playbackRate = systemData[padNumber].pitch;
    });

    alert(`${systemName} system loaded successfully!`); // Add popup notification
}

function deleteSystem(systemName) {
    delete savedSystems[systemName];
    localStorage.setItem('savedSystems', JSON.stringify(savedSystems));
    updateSavedPadsList();
}

function clearAllPads() {
    Object.keys(padSounds).forEach(padNumber => {
        const sound = padSounds[padNumber];
        if (sound) {
            sound.audio.pause();
            sound.audio.currentTime = 0;
        }
    });
    padSounds = {};
}

function clearPad(padNumber) {
    if (padSounds[padNumber]) {
        padSounds[padNumber].audio.pause();
        delete padSounds[padNumber];
    }
}

fileInput.addEventListener('change', loadSound);
recordButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
saveButton.addEventListener('click', saveSystem);
clearAllButton.addEventListener('click', clearAllPads);

document.addEventListener('keydown', handleKeyDown);

searchForm.addEventListener('submit', event => {
    event.preventDefault();
    const query = searchInput.value.toLowerCase();
    const filteredSystems = Object.keys(savedSystems).filter(systemName => systemName.toLowerCase().includes(query));
    
    savedPadsList.innerHTML = '';
    filteredSystems.forEach(systemName => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = systemName;
        listItem.onclick = () => loadSystem(systemName);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = (event) => {
            event.stopPropagation();
            deleteSystem(systemName);
        };

        listItem.appendChild(deleteButton);
        savedPadsList.appendChild(listItem);

    });
});

function updateGain(value) {
    Object.keys(padSounds).forEach(padNumber => {
        const sound = padSounds[padNumber];
        if (sound) {
            sound.gainNode.gain.setValueAtTime(value, audioContext.currentTime);
        }
    });
}

function updateLowPass(value) {
    Object.keys(padSounds).forEach(padNumber => {
        const sound = padSounds[padNumber];
        if (sound) {
            sound.lowPassFilter.frequency.setValueAtTime(value, audioContext.currentTime);
        }
    });
}

function updatePitch(value) {
    Object.keys(padSounds).forEach(padNumber => {
        const sound = padSounds[padNumber];
        if (sound && sound.audio) {
            sound.audio.playbackRate = value;
        }
    });
}

gainSlider.addEventListener('input', (event) => updateGain(event.target.value));
lowPassSlider.addEventListener('input', (event) => updateLowPass(event.target.value));
pitchSlider.addEventListener('input', (event) => updatePitch(event.target.value));

updateSavedPadsList();
