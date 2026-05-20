from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from datetime import datetime
import os, uuid, requests as http_requests
from dotenv import load_dotenv

# ── AI Assistant system prompt built from Milena's CV & portfolio ──────────
MILENA_SYSTEM_PROMPT = """You are a professional AI assistant representing Milena Mayilyan.
Answer ONLY using the factual information provided below about Milena.
Do NOT invent, hallucinate, or assume any projects, skills, certifications, experiences, or personal details.
If the user asks something you cannot answer from this information, politely say:
"I don't have enough information about that yet. You can contact Milena directly through the Chat button and wait for her personal response."
If the user asks for personal or private information (exact address, relationship status, personal life details), respond:
"That's personal information that isn't relevant to Milena's professional profile. Feel free to reach out via the Chat button for anything professional!"
Maintain a professional, concise, friendly tone. Speak about Milena in the third person or as her representative.

=== MILENA MAYILYAN — PROFESSIONAL PROFILE ===

CONTACT & LOCATION:
- Email: milenamayilyan5@gmail.com | Phone: +374 98 52 61 49 | Location: Yerevan, Armenia

SUMMARY:
Motivated and detail-oriented Computer Science undergraduate with a strong foundation in analytical thinking, problem-solving, and software development principles. Experienced in academic and personal projects requiring creativity, precision, and a user-focused mindset. Eager to bring collaborative attitude, quick adaptability, and passion for building meaningful technology solutions.

EDUCATION:
1. Bachelor of Computer Science and Applied Mathematics — French University in Armenia (2023–2027)
2. Bachelor of Science and Engineering — Toulouse III - Paul Sabatier University (2024–2027)
3. TUMO Labs – ClimateNet Program (Project-Based Climate Research & Engineering) — March 2026 – Present

EXPERIENCE:
- Information Desk Assistant | Big Projects | TOON EXPO | March 2026
  • Registered visitors and assisted with attendee inquiries at the event information desk
  • Provided information about participating companies, projects, and general property-related questions
  • Directed visitors to appropriate company representatives when needed

PROJECTS:
1. Ride-Sharing Database System (SQL Server)
   Built a complete relational database for a ride-sharing platform with full lifecycle management from users to payments and ratings. Implemented triggers, stored procedures, constraints, and indexing to ensure automation, data integrity, and performance optimization.

2. Armenian Job Market Analysis
   Conducted an end-to-end data analysis project on Armenian job platforms, including data cleaning, feature engineering, and exploratory analysis. Applied and evaluated clustering models (K-Means, Hierarchical, DBSCAN) to identify job market patterns, compare platforms, and assess model generalization.

3. Air Quality Monitoring System
   Developed an IoT-based air quality monitoring system as part of the TUMO Labs – ClimateNet Project, integrating multiple environmental sensors with an ESP32 to measure particulate matter, CO₂, VOCs, temperature, and humidity. Implemented reliable data collection and a cloud pipeline using AWS (API Gateway, Lambda, S3) to store sensor data in JSON format for analysis and monitoring.

4. Personalized Study Coach Web App
   Built a local web app using Python and Streamlit with GPT-3.5 Turbo for AI-powered study guidance, featuring subject-based chat, file uploads, and Firebase authentication and data storage.

TECHNICAL SKILLS:
- Programming Languages: Python, Java, C, C#, SQL, Bash, Arduino
- Embedded & Hardware: Raspberry Pi, ESP32, Arduino, IoT Prototyping
- Computer Science Fundamentals: Data Structures and Algorithms, Time & Space Complexity Analysis, Operating Systems, Computer Networks, Computer Architecture
- Data & Analytics: Applied Statistical Analysis, Descriptive & Inferential Statistics, Probability Modeling (R, Python)
- Mathematical Foundations: Calculus, Logic, Numerical Methods
- Developer Tools: Git, GitHub, Vim, Linux/Unix Shell
- Productivity Tools: Microsoft Office (Word, Excel, PowerPoint, Outlook)
- Creative Tools: Adobe After Effects (Video Editing)

SOFT SKILLS:
Analytical Problem-Solving & Structured Thinking, Learning Agility & Adaptability, Cross-Functional Communication, Ownership & Proactive Execution, Systems Thinking, Attention to Detail & Quality Focus, Collaboration in Fast-Paced Team Environments, Prioritization & Time Management

LANGUAGES:
- Armenian: Native
- English: C1 (Cambridge FCE Certified)
- French: B2 (DELF B2 Certified)
- Russian: B1

ACHIEVEMENTS:
- Armenian Educational Foundation Scholarship (2024–Present): Merit-based award covering the majority of tuition, granted to promising students with strong academic performance.

CERTIFICATIONS:
- DELF B2 (Diplôme d'Études en Langue Française) — February 2026, France Éducation international
- Cambridge First Certificate in English (FCE) — April 2025, Cambridge English Assessment (C1 level)
- Participation Certificate, Leaders for Peace Summer School — June 2024, French University in Armenia (global governance, climate change, AI, mediation, peacebuilding)
"""

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'milena-portfolio-secret-key')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'milena-admin-2024')

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")
messages_store = []

def send_telegram(text):
    token   = os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()
    chat_id = os.environ.get('TELEGRAM_CHAT_ID', '').strip()
    if not token or not chat_id: return
    try:
        http_requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}, timeout=6)
    except Exception as e:
        app.logger.error(f'Telegram error: {e}')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin():
    return render_template('admin.html', admin_password=ADMIN_PASSWORD)

@app.route('/api/admin/reply', methods=['POST'])
def admin_reply():
    data       = request.get_json()
    password   = data.get('password', '')
    session_id = data.get('session_id', '')
    message    = data.get('message', '').strip()
    if password != ADMIN_PASSWORD:
        return jsonify({'success': False, 'error': 'Unauthorized'}), 403
    if not session_id or not message:
        return jsonify({'success': False, 'error': 'Missing fields'}), 400
    socketio.emit('owner_reply', {'message': message, 'timestamp': datetime.now().isoformat()},
                  namespace='/chat', room=session_id)
    return jsonify({'success': True})

@app.route('/api/contact', methods=['POST'])
def contact():
    data       = request.get_json()
    name       = data.get('name', '').strip()
    email      = data.get('email', '').strip()
    message    = data.get('message', '').strip()
    session_id = data.get('session_id', str(uuid.uuid4()))
    if not name or not message:
        return jsonify({'success': False, 'error': 'Name and message required'}), 400
    entry = {'name': name, 'email': email, 'message': message,
             'timestamp': datetime.now().isoformat(), 'session_id': session_id}
    messages_store.append(entry)
    socketio.emit('new_message', entry, namespace='/admin')
    send_telegram(f"📩 <b>New portfolio message</b>\n<b>From:</b> {name}\n"
                  f"<b>Email:</b> {email or '—'}\n<b>Message:</b>\n{message[:800]}")
    return jsonify({'success': True, 'session_id': session_id})

@app.route('/api/ai-chat', methods=['POST'])
def ai_chat():
    """
    AI Assistant endpoint — proxies conversation to OpenAI using Milena's
    professional profile as the system prompt. The API key never leaves the server.
    """
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '').strip()
    if not OPENAI_API_KEY:
        return jsonify({'success': False, 'error': 'AI service not configured.'}), 503

    data = request.get_json()
    messages = data.get('messages', [])   # [{role, content}, …] — full history from client
    if not messages:
        return jsonify({'success': False, 'error': 'No messages provided.'}), 400

    # Prepend the system prompt; client should NOT send a system role message
    payload_messages = [{'role': 'system', 'content': MILENA_SYSTEM_PROMPT}] + messages

    try:
        resp = http_requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json',
            },
            json={
                'model': 'gpt-4o-mini',
                'messages': payload_messages,
                'max_tokens': 600,
                'temperature': 0.6,
            },
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        reply = result['choices'][0]['message']['content']
        return jsonify({'success': True, 'reply': reply})
    except http_requests.exceptions.Timeout:
        return jsonify({'success': False, 'error': 'AI service timed out. Please try again.'}), 504
    except Exception as e:
        app.logger.error(f'AI chat error: {e}')
        return jsonify({'success': False, 'error': 'AI service error. Please try again.'}), 500


@socketio.on('connect', namespace='/admin')
def admin_connect():
    emit('history', messages_store)

@socketio.on('join', namespace='/chat')
def on_join(data):
    session_id = data.get('session_id')
    if session_id:
        join_room(session_id)
        app.logger.info(f'Client joined room: {session_id}')

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
