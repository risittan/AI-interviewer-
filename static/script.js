document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // ELEMENT REFERENCES (mapped to new HTML IDs)
    // =============================================
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');          // was: uploadBox
    const selectedFileDisplay = document.getElementById('selectedFileDisplay'); // was: fileName
    const extractBtn = document.getElementById('extractBtn');
    const resultsCard = document.querySelector('.results-card');      // was: resultsSection (no ID)
    const logsContainer = document.getElementById('logsContainer');
    const finalResponse = document.getElementById('finalResponse');
    const interviewCard = document.querySelector('.interview-card');    // was: interviewSection (no ID)
    const responseDisplay = document.querySelector('.response-display');

    // Interview elements
    const startInterviewBtn = document.getElementById('startInterviewBtn');
    const questionContainer = document.getElementById('questionContainer');
    const aiQuestionText = document.getElementById('aiQuestionText');    // new: actual <p> for question text
    const questionBadge = document.querySelector('.question-badge');    // new: "Question X of 5" badge
    const playAiAudioBtn = document.getElementById('playAiAudioBtn');
    const qaHistoryContainer = document.getElementById('qaHistoryContainer');
    const answerSection = document.getElementById('answerSection');
    const actionButtons = document.querySelector('.action-buttons');    // new: wrapper div for buttons
    const answerInput = document.getElementById('answerInput');
    const submitAnswerForm = document.getElementById('submitAnswerForm');  // was: submitAnswerBtn (now a form)
    const submitAnswerBtn = submitAnswerForm ? submitAnswerForm.querySelector('button[type="submit"]') : null;
    const recordAnswerBtn = document.getElementById('recordAnswerBtn');
    const finalSummaryDisplay = document.getElementById('finalSummaryDisplay'); // new: pre-existing summary div

    let selectedFile = null;

    // =============================================
    // HELPERS: show/hide using hidden-section class
    // =============================================
    function show(el) { if (el) el.classList.remove('hidden-section'); }
    function hide(el) { if (el) el.classList.add('hidden-section'); }

    // =============================================
    // DRAG & DROP (uses #dropZone, was #uploadBox)
    // =============================================
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
        });
    }

    function handleFileSelect(file) {
        if (!file.name.endsWith('.docx')) {
            alert('Please select a valid Word Document (.docx)');
            return;
        }
        selectedFile = file;

        // Update the selected file display (was: fileNameDisplay.textContent)
        if (selectedFileDisplay) {
            selectedFileDisplay.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${file.name}
            `;
            show(selectedFileDisplay);
        }

        extractBtn.disabled = false;
        extractBtn.classList.remove('disabled-btn');
        extractBtn.removeAttribute('aria-disabled');
    }

    // =============================================
    // EXTRACT BUTTON CLICK
    // =============================================
    if (extractBtn) {
        extractBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            extractBtn.disabled = true;
            extractBtn.innerHTML = '<span class="loader"></span> Processing...';
            show(resultsCard);
            logsContainer.innerHTML = '';
            finalResponse.innerHTML = '<span class="loader"></span> Waiting for AI response...';
            hide(responseDisplay);

            addLog('info', `Uploading ${selectedFile.name}...`);

            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await fetch('/upload', { method: 'POST', body: formData });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Server error occurred');
                renderLogsSequentially(data.logs, data.final_response);
            } catch (error) {
                addLog('error', error.message);
                finalResponse.innerHTML = `<span style="color: var(--error)">Error: ${error.message}</span>`;
                show(responseDisplay);
                extractBtn.disabled = false;
                extractBtn.innerHTML = 'Extract CV Text &bull; Process with AI';
            }
        });
    }

    // =============================================
    // LOG HELPERS
    // =============================================
    function addLog(type, message, args = null) {
        const div = document.createElement('div');
        div.className = `log-entry ${type}`;
        let content = `<strong>[${type.toUpperCase()}]</strong> ${message}`;
        if (args) content += `<br><span style="color: var(--text-secondary)">Args: ${JSON.stringify(args)}</span>`;
        div.innerHTML = content;
        logsContainer.appendChild(div);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    async function renderLogsSequentially(logs, finalText) {
        logsContainer.innerHTML = '';
        for (const log of logs) {
            addLog(log.type, log.message, log.args);
            await new Promise(r => setTimeout(r, 600));
        }

        finalResponse.textContent = finalText || 'No final response text generated.';
        show(responseDisplay);

        // Store CV text globally and reveal interview section
        window.extractedCVText = finalText || '';
        if (window.extractedCVText) show(interviewCard);

        extractBtn.disabled = false;
        extractBtn.innerHTML = 'Extract CV Text &bull; Process with AI';
        finalResponse.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // =============================================
    // INTERVIEW STATE
    // =============================================
    let previousQaHistory = '';
    let currentQuestion = '';
    let questionCount = 0;
    const MAX_QUESTIONS = 5;
    let interviewScores = [];

    // =============================================
    // TTS
    // =============================================
    function fallbackBrowserTTS(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) utterance.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        window.speechSynthesis.speak(utterance);
    }

    async function playTTS(text) {
        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!res.ok) { fallbackBrowserTTS(text); return; }
            const blob = await res.blob();
            const audio = new Audio(URL.createObjectURL(blob));
            audio.play().catch(() => fallbackBrowserTTS(text));
        } catch {
            fallbackBrowserTTS(text);
        }
    }

    // =============================================
    // FETCH NEXT QUESTION
    // =============================================
    async function fetchNextQuestion() {
        if (questionCount >= MAX_QUESTIONS) {
            showFinalSummary();
            return;
        }

        questionCount++;
        hide(startInterviewBtn);
        hide(answerSection);
        hide(actionButtons);

        // Show question container with loading state
        show(questionContainer);
        if (questionBadge) questionBadge.textContent = `Question ${questionCount} of ${MAX_QUESTIONS}`;
        aiQuestionText.textContent = '';
        aiQuestionText.innerHTML = `<span class="loader"></span> Generating question ${questionCount} of ${MAX_QUESTIONS}...`;

        try {
            const res = await fetch('/api/generate_question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cv_text: window.extractedCVText,
                    previous_qa_history: previousQaHistory
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate question');

            currentQuestion = data.question;
            aiQuestionText.textContent = currentQuestion;

            // Show answer input area
            show(answerSection);
            show(actionButtons);
            show(playAiAudioBtn);
            answerInput.value = '';
            answerInput.focus();

            playTTS(currentQuestion);

        } catch (error) {
            aiQuestionText.innerHTML = `<span style="color: var(--error)">Error: ${error.message}</span>`;
            show(startInterviewBtn);
            startInterviewBtn.textContent = 'Retry';
        }
    }

    if (startInterviewBtn) {
        startInterviewBtn.addEventListener('click', fetchNextQuestion);
    }

    if (playAiAudioBtn) {
        playAiAudioBtn.addEventListener('click', () => {
            if (currentQuestion) playTTS(currentQuestion);
        });
    }

    // =============================================
    // SUBMIT ANSWER (via form submit event)
    // =============================================
    if (submitAnswerForm) {
        submitAnswerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const answer = answerInput.value.trim();
            if (!answer) return;

            // Update Q&A history
            previousQaHistory += `Q: ${currentQuestion}\nA: ${answer}\n\n`;

            // Render history entry
            const historyEntry = document.createElement('div');
            historyEntry.style.cssText = 'margin-bottom:1rem;padding:1rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;';
            historyEntry.innerHTML = `
                <div style="margin-bottom:0.5rem;font-weight:600;color:var(--accent)">Q${questionCount}. ${currentQuestion}</div>
                <div style="color:var(--text-secondary)"><strong style="color:var(--text-primary)">You:</strong> ${answer}</div>
            `;
            qaHistoryContainer.appendChild(historyEntry);

            // Disable UI while scoring
            if (submitAnswerBtn) { submitAnswerBtn.disabled = true; submitAnswerBtn.innerHTML = '<span class="loader"></span> Scoring...'; }
            answerInput.disabled = true;
            if (recordAnswerBtn) recordAnswerBtn.disabled = true;

            try {
                const scoreRes = await fetch('/api/score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: currentQuestion, answer, cv_text: window.extractedCVText })
                });

                if (scoreRes.ok) {
                    const s = await scoreRes.json();
                    const scoreColor = s.score >= 7 ? 'var(--success)' : s.score >= 4 ? 'var(--warning)' : 'var(--error)';
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.style.cssText = 'margin-top:0.75rem;padding:0.75rem 1rem;background:rgba(96,165,250,0.06);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;';
                    feedbackDiv.innerHTML = `
                        <div style="font-weight:700;color:${scoreColor};margin-bottom:0.4rem;font-size:1.05rem;">Score: ${s.score}/10 — ${s.verdict}</div>
                        <div style="margin-bottom:0.25rem"><strong>Strength:</strong> ${s.strength}</div>
                        <div><strong>Improve:</strong> ${s.improvement}</div>
                    `;
                    historyEntry.appendChild(feedbackDiv);
                    if (typeof s.score === 'number') interviewScores.push(s.score);
                }
            } catch (err) {
                console.error('Scoring error:', err);
            } finally {
                answerInput.disabled = false;
                if (recordAnswerBtn) recordAnswerBtn.disabled = false;
                if (submitAnswerBtn) { submitAnswerBtn.disabled = false; submitAnswerBtn.textContent = 'Submit Answer'; }
            }

            if (questionCount >= MAX_QUESTIONS) {
                showFinalSummary();
            } else {
                fetchNextQuestion();
            }
        });
    }

    // =============================================
    // FINAL SUMMARY
    // =============================================
    function showFinalSummary() {
        hide(questionContainer);

        const sum = interviewScores.reduce((a, b) => a + b, 0);
        const avg = interviewScores.length > 0 ? (sum / interviewScores.length).toFixed(1) : 0;
        const grade = avg >= 8 ? 'Excellent' : avg >= 6 ? 'Good' : avg >= 4 ? 'Developing' : 'Needs Work';

        finalSummaryDisplay.innerHTML = `
            <h3 style="color:var(--success);font-size:1.5rem;margin-bottom:0.75rem;">Interview Complete!</h3>
            <p style="color:var(--text-secondary);margin-bottom:1.25rem;">You completed all ${MAX_QUESTIONS} questions.</p>
            <div style="font-size:3rem;font-weight:800;color:var(--text-primary);margin-bottom:0.5rem;">${avg}<span style="font-size:1.5rem;color:var(--text-secondary)">/10</span></div>
            <div style="font-size:1.1rem;color:var(--accent);margin-bottom:1.5rem;">${grade}</div>
            <p style="color:var(--text-secondary);font-size:0.9rem;">Scroll up to review detailed feedback for each answer.</p>
            <button onclick="window.scrollTo({top:0,behavior:'smooth'})" class="btn btn-primary" style="margin-top:1.25rem;">Back to Top</button>
        `;
        show(finalSummaryDisplay);
        finalSummaryDisplay.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // =============================================
    // VOICE RECORDING (STT)
    // =============================================
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    if (recordAnswerBtn) {
        recordAnswerBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) audioChunks.push(e.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const fd = new FormData();
                        fd.append('file', audioBlob, 'answer.webm');

                        recordAnswerBtn.innerHTML = '<span class="loader"></span> Transcribing...';
                        recordAnswerBtn.disabled = true;
                        if (submitAnswerBtn) submitAnswerBtn.disabled = true;
                        answerInput.disabled = true;

                        try {
                            const res = await fetch('/api/stt', { method: 'POST', body: fd });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'STT failed');
                            answerInput.value += (answerInput.value ? ' ' : '') + data.text;
                        } catch (err) {
                            console.error('STT Error:', err);
                            alert('Transcription failed: ' + err.message);
                        } finally {
                            recordAnswerBtn.innerHTML = `
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><circle cx="12" cy="12" r="7"/></svg>
                                Record Voice Answer`;
                            recordAnswerBtn.disabled = false;
                            if (submitAnswerBtn) submitAnswerBtn.disabled = false;
                            answerInput.disabled = false;
                            answerInput.focus();
                        }
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    recordAnswerBtn.classList.add('recording');
                    recordAnswerBtn.innerHTML = '<span style="color:var(--error)">&#9608;</span> Stop Recording';

                } catch (err) {
                    console.error('Mic error:', err);
                    alert('Could not access microphone.');
                }
            } else {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(t => t.stop());
                }
                isRecording = false;
                recordAnswerBtn.classList.remove('recording');
            }
        });
    }
});
