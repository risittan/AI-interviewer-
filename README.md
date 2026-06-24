## AI Interviewer (Tool Calling Demo)
An advanced web application that simulates a technical interview. This project demonstrates LLM tool-calling (function calling), multimodal audio capabilities, and context-aware conversation flows.

## Features
- CV Parsing Tool: Automatically extracts text from uploaded `.docx` CVs using Python.
- Dynamic Question Generation: The AI uses a tool to generate relevant technical questions based on the candidate's CV and the previous Q&A history.
- AI Scoring System: The AI uses a tool to evaluate candidate answers out of 10, identifying strengths and areas for improvement.
- Text-to-Speech (TTS): Converts the AI's generated questions into natural audio using the ElevenLabs API.
- Speech-to-Text (STT): Transcribes the candidate's spoken audio responses back to text using the ElevenLabs `scribe_v2` model.

## Technologies Used
- **Backend:** Python, Flask
- **AI/LLM:** DeepSeek Chat via OpenRouter (with Tool/Function Calling schemas)
- **Audio/Speech API:** ElevenLabs TTS & STT

## Setup
1. Clone the repository and install dependencies from `requirements.txt`.
2. Create a `.env` file with your API keys:
   ```env
   OPENROUTER_API_KEY=your_openrouter_key
   ELEVENLABS_API_KEY=your_elevenlabs_key
   ```
3. Run the Flask application:
   ```bash
   python app.py
   ```
4. Open your browser to `http://localhost:5000`
