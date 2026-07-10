# A.I. Interviewer — Tool Calling Demo

**Status: Work in Progress (Post-Grad AI Engineering Project)**  
*Demonstrates LLM tool-calling, multimodal audio capabilities, and context-aware conversation flows.*

---

## 🎯 What This Is

An **AI-powered technical interview simulator** that:
1. Extracts text from candidate CVs using Python's `python-docx` library
2. Uses a **local offline LLM model** (Ollama + qwen35-claude-coder) to generate questions and score answers  
3. Integrates with **ElevenLabs API** for Text-to-Speech (TTS) and Speech-to-Text (STT)
4. Implements **security-first design** using LLM-as-Judge classifiers

---

## 📊 Architecture Overview

### Quick Reference: View the Full Diagram
Open [`architecture.html`](./architecture.html) in your browser for a complete visual architecture diagram showing all layers, data flows, and request patterns. This is designed specifically to explain this project to interviewers!

See also: [`ARCHITECTURE_SUMMARY.md`](./ARCHITECTURE_SUMMARY.md) with detailed talking points.

### Architecture Layers
```
┌───────────── Frontend ────────────┐
│ HTML/CSS/JS · Fetch API · TTS    │
└─────────────┬─────────────────────┘
              ↓ HTTP POST (FormData / JSON)
┌───────────── Flask Routes ────────────┐
│ GET  / → render index.html           │
│ POST /upload                          │
│ POST /api/generate_question          │
│ POST /api/score                      │
│ POST /api/tts                        │
│ POST /api/stt                        │
└───────┬───────────────────────────────┘
        ↓ call_local_api() → Ollama :11434
    (with TOOLS_SCHEMA JSON)
┌───────────── Python Tools ────────────┐
│ extract_cv_text(file_path)           │
│ generate_next_question(cv, history)  │
│ score_answer(question, answer, cv)    │
│ _llm_classify_question(text)         │
└─────────────┬─────────────────────────┘
             ↓ HTTPS REST API (ElevenLabs/OpenRouter)
┌────────── External APIs ─────────────┐
│ ElevenLabs TTS: text → audio/mpeg   │
│ ElevenLabs STT: webm → transcript    │
│ OpenRouter: security classifier       │
```

---

## 🚀 Features

| Feature | Description | Tech Stack |
|---------|-------------|------------|
| **CV Parsing** | Extracts text from `.docx` CV files using `python-docx` | Python + Ollama tool calling |
| **Dynamic Question Gen** | AI generates one relevant question based on CV and Q&A history | qwen35-claude-coder:4b (local) |
| **AI Scoring System** | Evaluates answers 0-10 with strength/improvement feedback | JSON output parsing + validation |
| **Text-to-Speech** | Reads questions aloud using ElevenLabs Adam voice | eleven_turbo_v2_5 model |
| **Speech-to-Text** | Transcribes candidate's spoken responses to text | scribe_v2 STT model |

---

## 🛠️ Technologies Used

### Backend (Python)
```python
Flask 1.0+      # Web framework, routes (/upload, /api/*)
Ollama API     # Local LLM at localhost:11434/api/chat
requests       # HTTP client for Ollama/ElevenLabs APIs
dotenv         # Environment variable loading (.env file)
python-docx    # CV text extraction from .docx files
```

### Frontend (JavaScript/HTML/CSS)
- **HTML5** - UI structure with drag-drop upload zone, results cards
- **CSS3** - Glassmorphism dark theme using CSS custom properties
- **Vanilla JavaScript** - Fetch API for HTTP calls, MediaRecorder for voice capture

---

## 🔑 Key Technical Highlights (For Interviews)

### 1. Tool Calling / Function Calling Pattern
The AI receives a `TOOLS_SCHEMA` JSON array containing function definitions and can autonomously decide when to invoke them — e.g., calling `extract_cv_text()` after receiving the file path from user input. This enables **reasoning chains** where the model extracts data, passes it back as conversation history, then makes follow-up calls for final answers.

### 2. Security: LLM-as-Judge
We use a separate LLM call (`_llm_classify_question()`) to verify generated questions aren't prompt injections. The classifier returns ONLY "YES" or "NO". If the model doesn't explicitly confirm, we default to REJECT for safety — this is defense-in-depth against adversarial inputs.

### 3. Offline-First Design
The primary AI logic runs **entirely locally** via Ollama (`localhost:11434/api/chat stream:false`). Only TTS/STT and the security classifier use external APIs (ElevenLabs, OpenRouter). This means core interview functionality works without internet once Ollama is running.

### 4. No Recursive Tool Calling
For question generation and scoring: `call_local_api(messages, api_key, tools=None)` — passing `tools=None` prevents the model from trying to call its own tools on generated output (e.g., "What tool should I use?"). Forces direct JSON/text response for predictable parsing.

---

## 📁 Project Structure
```
D:\PROJECT\Tool_calling/
├── app.py              # Flask routes + Python tools (+ call_local_api helper)
├── requirements.txt    # flask, python-docx, requests, dotenv
├── .env               # OPENROUTER_API_KEY, ELEVENLABS_API_KEY (never commit!)
├── uploads/           # CV files stored here (.docx only)
│   └── cv_{filename}.docx
├── templates/index.html  # Frontend UI template
├── static/style.css     # Glassmorphism dark theme
├── static/script.js     # Fetch API · TTS player · MediaRecorder STT
├── architecture.html    # Visual architecture diagram (VIEW THIS!)
└── ARCHITECTURE_SUMMARY.md  # Detailed talking points for interviews
```

---

## 🚀 Setup Instructions

### Prerequisites
1. **Ollama installed** with model: `ollama pull qwen35-claude-coder:4b` (or similar)
2. **ElevenLabs account**: Get API key from https://elevenlabs.io/
3. **OpenRouter account**: For security classifier

### Installation Steps
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Create .env file with your keys:
OPENROUTER_API_KEY=your_openrouter_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here

# 3. Start Flask app (runs on http://localhost:5000)
python app.py

# 4. Open browser to see the interview simulator!
```

---

## 📊 Request Flow Example (CV Upload)

1. **User** drags `.docx` file into upload zone → JavaScript sends `POST /upload` with FormData
2. **Flask** saves file to `uploads/`, calls Ollama via `call_local_api()` with user request + TOOLS_SCHEMA
3. **Ollama (qwen)** responds: `{tool_calls: [{name: extract_cv_text, args: {file_path}}]}`
4. **Flask executes tool** → returns raw text string to LLM as message in conversation history
5. **Second Ollama call** processes full context + extracted CV → final answer returned with logs
6. **UI displays**: Extracted CV text (stored in `window.extractedCVText`), API call logs

---

## 🎓 Common Interview Questions & Answers

### Q: Why use a local model instead of calling an external AI API?
**A:** Three reasons:  
1. **Privacy**: CV data stays on-premises, never sent to external services during processing  
2. **Cost Control**: No per-token charges for core interview logic (only TTS/STT billed)  
3. **Latency**: Local calls are faster than network round-trips  

### Q: How does the AI know which tools to call?
**A:** The app passes a `TOOLS_SCHEMA` JSON array containing function definitions with names, descriptions, and parameter schemas. When Ollama receives this schema alongside user messages, it can autonomously decide when to invoke functions — e.g., calling `extract_cv_text()` after receiving the file path from the AI itself (not directly from users).

### Q: What's your security approach against prompt injection?
**A:** Double-layered defense:  
1. **Input Sanitization**: XML escaping (`<` → `&lt;`) in all prompts via `sanitize_input()`  
2. **LLM-as-Judge Classifier**: Separate LLM call that returns ONLY "YES" or "NO". If the model doesn't explicitly confirm, we default to REJECT for safety  

### Q: How do you handle voice input/output?
**A:** 
- **TTS (Output)**: POST /api/tts → ElevenLabs text-to-speech (Adam voice, eleven_turbo_v2_5) → audio/mpeg blob streamed back  
- **STT (Input)**: MediaRecorder captures mic → POST /api/stt → ElevenLabs scribe_v2 model converts webm to transcript  

### Q: Can this work offline?
**A:** Yes! The primary AI logic runs entirely locally via Ollama (`localhost:11434/api/chat stream:false`). Only TTS/STT and the security classifier use external APIs. Core interview functionality works without internet once Ollama is running.

---

## 📈 Next Steps / Future Enhancements
- [ ] Add question retry mechanism (if AI fails to generate valid Q)
- [ ] Implement candidate profile persistence across interviews  
- [ ] Add time-based scoring adjustments for longer/shorter answers  
- [ ] Support multiple CV formats (.pdf, .txt in addition to .docx)

---

## 📄 License & Credits

Built as part of a post-graduation AI engineering track project.  

**Models**: qwen35-claude-coder:4b (Ollama), scribe_v2 (ElevenLabs STT)  
**Voice**: Adam voice, eleven_turbo_v2_5 model (ElevenLabs TTS)
