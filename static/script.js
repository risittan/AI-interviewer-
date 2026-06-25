document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadBox = document.getElementById('uploadBox');
    const fileNameDisplay = document.getElementById('fileName');
    const extractBtn = document.getElementById('extractBtn');
    const resultsSection = document.getElementById('resultsSection');
    const logsContainer = document.getElementById('logsContainer');
    const finalResponse = document.getElementById('finalResponse');

    let selectedFile = null;

    // Handle drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--accent-color)';
        uploadBox.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
    });

    uploadBox.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--border-color)';
        uploadBox.style.backgroundColor = 'transparent';
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--border-color)';
        uploadBox.style.backgroundColor = 'transparent';

        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Handle click upload
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    function handleFileSelect(file) {
        if (!file.name.endsWith('.docx')) {
            alert('Please select a valid Word Document (.docx)');
            return;
        }
        selectedFile = file;
        fileNameDisplay.textContent = file.name;
        fileNameDisplay.style.color = 'var(--text-primary)';
        fileNameDisplay.style.fontWeight = '600';
        extractBtn.disabled = false;
    }

    extractBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI update for loading
        extractBtn.disabled = true;
        extractBtn.innerHTML = '<span class="loader"></span> Processing...';
        resultsSection.classList.remove('hidden');
        logsContainer.innerHTML = '';
        finalResponse.innerHTML = '<span class="loader" style="border-top-color: var(--accent-color);"></span> Waiting for AI response...';

        addLog('info', `Uploading ${selectedFile.name}...`);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Server error occurred');
            }

            // Render logs dynamically with delays for cool effect
            renderLogsSequentially(data.logs, data.final_response);

        } catch (error) {
            addLog('error', error.message);
            finalResponse.innerHTML = `<span style="color: var(--error-color)">Error: ${error.message}</span>`;
            extractBtn.disabled = false;
            extractBtn.innerHTML = 'Extract Text';
        }
    });

    function addLog(type, message, args = null) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;

        let content = `<strong>[${type.toUpperCase()}]</strong> ${message}`;
        if (args) {
            content += `<br><span style="color: var(--text-secondary)">Arguments: ${JSON.stringify(args)}</span>`;
        }

        div.innerHTML = content;
        logsContainer.appendChild(div);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    async function renderLogsSequentially(logs, finalText) {
        logsContainer.innerHTML = ''; // Clear initial logs

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            addLog(log.type, log.message, log.args);
            // Wait 600ms between logs for visual effect
            await new Promise(r => setTimeout(r, 600));
        }

        finalResponse.innerHTML = finalText || '<em>No final response text generated.</em>';

        // Save CV text globally and show interview section
        window.extractedCVText = finalText || '';
        if (window.extractedCVText) {
            document.getElementById('interviewSection').classList.remove('hidden');
        }

        // Reset button
        extractBtn.disabled = false;
        extractBtn.innerHTML = 'Extract Text';

        // Scroll to the response
        finalResponse.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const startInterviewBtn = document.getElementById('startInterviewBtn');
    const questionContainer = document.getElementById('questionContainer');
    const qaHistoryContainer = document.getElementById('qaHistoryContainer');
    const answerSection = document.getElementById('answerSection');
    const answerInput = document.getElementById('answerInput');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');

    let previousQaHistory = '';
    let currentQuestion = '';
    
    let questionCount = 0;
    const MAX_QUESTIONS = 5;
    let interviewScores = [];

    function fallbackBrowserTTS(text) {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            }
            window.speechSynthesis.speak(utterance);
        } else {
            console.error("Browser does not support Speech Synthesis.");
        }
    }

    async function playTTS(text) {
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.warn("ElevenLabs TTS failed. Using browser TTS fallback.", errorData.error || response.statusText);
                fallbackBrowserTTS(text);
                return;
            }
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.play().catch(e => {
                console.error("Audio playback prevented by browser:", e);
                fallbackBrowserTTS(text);
            });
        } catch (error) {
            console.error("Error playing TTS:", error);
            fallbackBrowserTTS(text);
        }
    }

    async function fetchNextQuestion() {
        if (questionCount >= MAX_QUESTIONS) {
            showFinalSummary();
            return;
        }
        
        questionCount++;
        startInterviewBtn.style.display = 'none';
        answerSection.classList.add('hidden');
        questionContainer.innerHTML = `<span class="loader"></span> Generating Question ${questionCount} of ${MAX_QUESTIONS}...`;

        try {
            const response = await fetch('/api/generate_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cv_text: window.extractedCVText,
                    previous_qa_history: previousQaHistory
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate question');
            }

            currentQuestion = data.question;
            questionContainer.innerHTML = `<div style="padding: 1rem; background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid var(--accent-color); margin-bottom: 1rem;"><strong>AI:</strong> ${currentQuestion}</div>`;
            answerSection.classList.remove('hidden');
            answerInput.value = '';
            answerInput.focus();

            // Speak the question
            playTTS(currentQuestion);

        } catch (error) {
            questionContainer.innerHTML = `<span style="color: var(--error-color)">Error: ${error.message}</span>`;
            startInterviewBtn.style.display = 'inline-block';
            startInterviewBtn.innerHTML = 'Retry Generating Question';
        }
    }

    if (startInterviewBtn) {
        startInterviewBtn.addEventListener('click', fetchNextQuestion);
    }

    if (submitAnswerBtn) {
        submitAnswerBtn.addEventListener('click', async () => {
            const answer = answerInput.value.trim();
            if (!answer) return;

            // Add to history state
            const qaPair = `Q: ${currentQuestion}\nA: ${answer}\n\n`;
            previousQaHistory += qaPair;

            // Display in history container
            const historyEntry = document.createElement('div');
            historyEntry.style.marginBottom = '1rem';
            historyEntry.style.padding = '0.75rem';
            historyEntry.style.backgroundColor = 'var(--bg-secondary)';
            historyEntry.style.borderRadius = '4px';
            historyEntry.innerHTML = `<div style="margin-bottom: 0.5rem;"><strong>Q:</strong> ${currentQuestion}</div><div><strong>You:</strong> ${answer}</div>`;
            qaHistoryContainer.appendChild(historyEntry);

            // Disable UI during scoring
            submitAnswerBtn.disabled = true;
            answerInput.disabled = true;
            const recordAnswerBtn = document.getElementById('recordAnswerBtn');
            if (recordAnswerBtn) recordAnswerBtn.disabled = true;
            
            const originalBtnText = submitAnswerBtn.innerHTML;
            submitAnswerBtn.innerHTML = '<span class="loader" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span> Scoring...';

            try {
                // Call /api/score
                const scoreResponse = await fetch('/api/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: currentQuestion,
                        answer: answer,
                        cv_text: window.extractedCVText
                    })
                });

                if (scoreResponse.ok) {
                    const scoreData = await scoreResponse.json();
                    
                    // Display score and feedback below the answer
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.style.marginTop = '0.75rem';
                    feedbackDiv.style.padding = '0.75rem';
                    feedbackDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                    feedbackDiv.style.borderLeft = '3px solid var(--accent-color)';
                    feedbackDiv.style.borderRadius = '0 4px 4px 0';
                    feedbackDiv.innerHTML = `
                        <div style="font-weight: 600; color: var(--accent-color); margin-bottom: 0.5rem;">Score: ${scoreData.score}/10 - ${scoreData.verdict}</div>
                        <div style="margin-bottom: 0.25rem;"><strong>Strength:</strong> ${scoreData.strength}</div>
                        <div><strong>Improvement:</strong> ${scoreData.improvement}</div>
                    `;
                    historyEntry.appendChild(feedbackDiv);
                    
                    if (scoreData && typeof scoreData.score === 'number') {
                        interviewScores.push(scoreData.score);
                    }
                } else {
                    console.error("Failed to get score");
                }
            } catch (err) {
                console.error("Error calling score API:", err);
            } finally {
                submitAnswerBtn.disabled = false;
                answerInput.disabled = false;
                if (recordAnswerBtn) recordAnswerBtn.disabled = false;
                submitAnswerBtn.innerHTML = originalBtnText;
            }

            // Generate next question or show summary
            if (questionCount >= MAX_QUESTIONS) {
                showFinalSummary();
            } else {
                fetchNextQuestion();
            }
        });
    }
    
    function showFinalSummary() {
        answerSection.classList.add('hidden');
        questionContainer.classList.add('hidden');
        
        const sum = interviewScores.reduce((a, b) => a + b, 0);
        const avg = interviewScores.length > 0 ? (sum / interviewScores.length).toFixed(1) : 0;
        
        const summaryDiv = document.createElement('div');
        summaryDiv.style.marginTop = '2rem';
        summaryDiv.style.padding = '1.5rem';
        summaryDiv.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        summaryDiv.style.border = '2px solid #10b981';
        summaryDiv.style.borderRadius = '8px';
        summaryDiv.style.textAlign = 'center';
        
        summaryDiv.innerHTML = `
            <h3 style="color: #10b981; font-size: 1.5rem; margin-bottom: 1rem;">Interview Complete!</h3>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">You've completed all ${MAX_QUESTIONS} questions.</p>
            <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1rem;">
                Final Score: ${avg} / 10
            </div>
            <p style="color: var(--text-secondary);">Review your full Q&A history above to see detailed feedback on each answer.</p>
            <button onclick="window.scrollTo({top: 0, behavior: 'smooth'})" class="btn primary-btn" style="margin-top: 1rem;">Back to Top</button>
        `;
        
        document.getElementById('interviewSection').appendChild(summaryDiv);
    }

    const recordAnswerBtn = document.getElementById('recordAnswerBtn');
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    if (recordAnswerBtn) {
        recordAnswerBtn.addEventListener('click', async () => {
            if (!isRecording) {
                // Start recording
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) audioChunks.push(e.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const formData = new FormData();
                        formData.append('file', audioBlob, 'answer.webm');

                        recordAnswerBtn.innerHTML = '<span class="loader" style="width:12px;height:12px;border-width:2px;display:inline-block;"></span> Transcribing...';
                        recordAnswerBtn.disabled = true;
                        submitAnswerBtn.disabled = true;
                        answerInput.disabled = true;

                        try {
                            const response = await fetch('/api/stt', {
                                method: 'POST',
                                body: formData
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.error || 'STT failed');

                            answerInput.value += (answerInput.value ? ' ' : '') + data.text;
                        } catch (err) {
                            console.error('STT Error:', err);
                            alert('Transcription failed: ' + err.message);
                        } finally {
                            recordAnswerBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg> Record Voice';
                            recordAnswerBtn.disabled = false;
                            submitAnswerBtn.disabled = false;
                            answerInput.disabled = false;
                            answerInput.focus();
                        }
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    recordAnswerBtn.innerHTML = '<span style="color:var(--error-color);">&#9608;</span> Stop Recording';
                } catch (err) {
                    console.error("Error accessing microphone:", err);
                    alert("Could not access microphone.");
                }
            } else {
                // Stop recording
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                isRecording = false;
            }
        });
    }
});
