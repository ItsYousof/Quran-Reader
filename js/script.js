const voiceBtn = document.getElementById('voice-btn');
let surahList = [];
let previousBtn = document.getElementById('previous-button');
let nextBtn = document.getElementById('next-button');
let currentAudioElement = null; // Store the currently reciteing audio element
let isreciteing = false;
let currentSurah = 1;
let currentAyah = 1;
let currentreciteingURL = '';
let isReaptingAyah = false;
let repeatingAyahURL = '';
let mediaRecorder;
let audioChunks = [];
let currentSurahSpan = document.getElementById('current-surah');
let currentAyahSpan = document.getElementById('current-ayah')
const settingsBtn = document.getElementById('settings');
const closeBtn = document.getElementById('close');
let errorSound = new Audio('../data/error.mp3');

let API_KEY = localStorage.getItem('API_KEY') || '';
if (!API_KEY) {
    API_KEY = prompt('Enter your OpenAI API key:');
    localStorage.setItem('API_KEY', API_KEY);
}

function showSettings() {
    const settingsContainer = document.getElementById('setting-content');
    settingsContainer.style.disrecite = 'flex';
    settingsContainer.style.opacity = '1';
}

function closeSettings() {
    const settingsContainer = document.getElementById('setting-content');
    settingsContainer.style.disrecite = 'none';
    settingsContainer.style.opacity = '0';
}

fetch('../data/surahs.json')
    .then(response => response.json())
    .then(data => {
        surahList = data;
    });

function reciteSurah(number) {
    // Set the current Surah and reset the Ayah
    currentSurah = number;
    currentAyah = 1; // Start from the first Ayah
    reciteAyah();
}

function reciteAyah() {
    // Update the current Ayah and recite the audio
    if (currentAudioElement) {
        currentAudioElement.pause(); // Stop any currently reciteing audio
    }

    let surahNumberString = currentSurah.toString().padStart(3, '0');
    let ayahNumberString = currentAyah.toString().padStart(3, '0');

    currentAudioElement = new Audio();
    currentAudioElement.src = `https://audio.qurancdn.com/Minshawi/Murattal/mp3/${surahNumberString}${ayahNumberString}.mp3`

    currentAudioElement.play();
    currentAudioElement.addEventListener('ended', fetchNextAyah); // Automatically go to the next ayah
}

function fetchNextAyah() {
    // Increment the Ayah number
    if (currentAyah) {
        currentAyah++;
    } else {
        console.log(`No more ayahs in Surah ${currentSurah}!`);
        currentAyah = 1; // Reset to the first Ayah if it's the last one
    }
    reciteAyah();
}

function repeatAyah() {
    if (currentAudioElement) {
        currentAudioElement.currentTime = 0; // Reset the audio
        currentAudioElement.play();
    }
}

function repeatAyahAndContinue() { 
    if (currentAudioElement) {
        isReaptingAyah = true;
        currentAudioElement.currentTime = 0; // Reset the audio
        currentAudioElement.loop = true;
        currentAudioElement.play();
        currentAudioElement.addEventListener('ended', () => {
            if (isReaptingAyah) { 
                currentAudioElement.currentTime = 0; // Reset the audio
                currentAudioElement.play();
            } else {
                fetchNextAyah();
            }   
        });
    }
}

function stopRepeatingAyah() {
    if (currentAudioElement) {
        isReaptingAyah = false;
        currentAudioElement.loop = false;
        fetchNextAyah();
    }
}


function fetchPreviousAyah() {
    // Decrement the Ayah number
    if (currentAyah > 1) {
        currentAyah--;
    } else {
        console.log(`Already at the first Ayah of Surah ${currentSurah}.`);
    }
    reciteAyah();
}

function repearSurah() {
    if (currentAudioElement) {
        currentAyah = 1;
        reciteAyah();
    }
}

function stopAudio() {
    if (currentAudioElement) {
        currentAudioElement.pause();
        isreciteing = false;
    }
}

// Function to continue the audio
function continueAudio() {
    if (currentAudioElement && !isreciteing) {
        currentAudioElement.play();
        isreciteing = true;
    }
}

function jumpToAyah(ayahNumber) {
    // Jump to a specific Ayah in the current Surah
    if (ayahNumber) {
        currentAyah = ayahNumber;
        reciteAyah();
    } else {
        console.log(`Invalid Ayah number!`);
    }
}

// Start recording
function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });
        });
}

// Stop recording and send to OpenAI for transcription
function stopRecording() {
    mediaRecorder.stop();
    mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
        audioChunks = []; // Clear the buffer for the next recording
        sendAudioToOpenAI(audioBlob);  // Send the audio to OpenAI for transcription
    });
}

function sendAudioToOpenAI(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');  // Whisper model for speech-to-text

    fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`
        },
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            const transcription = data.text;
            console.log("Transcription: ", transcription);
            handleTranscription(transcription);  // Use the transcribed text
        })
        .catch(error => console.error('Error:', error));
}

async function handleTranscription(transcription) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    {
                        "role": "system",
                        "content": "You are an assistant designed to interpret a user's intent from a transcript in JSON format."
                    },
                    {
                        "role": "user",
                        "content": `Take the transcript: '${transcription}' and determine the user's intent. If the user wants to recite a surah, respond with the JSON format: { "recite": { "surahName": "name", "surahNumber": "number" } }. If the user wants to go to a specific ayah, respond with: { \"jump\": { \"ayah\": \"1\" } }. If they want to repeat an ayah, respond with: { \"repeat\": true }. If they want to repeat and continue, respond with: { \"repeat\": true, \"continue\": true } if they want to stop repeating, respond with: { \"repeat\": false, \"continue\": false }. Do not include any other text beyond the required JSON format. Only return the exact JSON structure without any additional explanation. DO NOT INCLUDE ANY OTHER WORDS OTHER THAN THE REQUIRED JSON FORMAT. If the transcript has anything close to 'الزمر' then make it read surat 'الزمر' which is surah number 39. If the transcript seems confusing or unclear, try to find the surah name and give the required JSON format. Here is a list of surahs: ${surahList}.`
                    }
                ],
                max_tokens: 4000,
                temperature: 0
            })
        });

        const data = await response.json();

        console.log(data);
        if (response.ok) {
            try {
                let message = data.choices[0].message.content;

                // Use a regular expression to extract the valid JSON object
                const jsonMatch = message.match(/\{.*\}/);

                if (jsonMatch) {
                    message = JSON.parse(jsonMatch[0]); // Extract the JSON portion

                    if (message.recite) {
                        reciteSurah(message.recite.surahNumber);
                    } else if (message.jump) {
                        jumpToAyah(message.jump.ayah);
                    } else if (message.repeat) {
                        if (message.continue) {
                            repeatAyahAndContinue();
                        } else {
                            repeatAyah();
                        }
                    } else if (message.repeat) {
                        if (message.continue === false) {
                            stopRepeatingAyah();
                        }
                    }
                } else {
                    console.error('No valid JSON found in the response.');
                    errorSound.play();
                }
            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        } else {
            console.error('Error:', data.error.message);
            errorSound.play();
        }

    } catch (error) {
        console.error('Error:', error);
    }
}


// Trigger the start/stop recording on button press
voiceBtn.addEventListener('mousedown', () => {
    stopAudio();
    startRecording();
});

voiceBtn.addEventListener('dblclick', () => {
    continueAudio();
});

voiceBtn.addEventListener('mouseup', stopRecording);
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js')
        .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch((error) => {
            console.error('Service Worker registration failed:', error);
        });
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt event fired');
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-button').style.display = 'block';
});

document.getElementById('install-button').addEventListener('click', async () => { 
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice
            .then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                deferredPrompt = null;
            });
    }
})