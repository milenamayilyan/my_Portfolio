from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'milena-portfolio-secret-key')

# Email config (set env vars for production)
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_USERNAME', '')
OWNER_EMAIL = os.environ.get('OWNER_EMAIL', 'milenamayilyan5@gmail.com')

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
mail = Mail(app)

messages_store = []  # In-memory store (replace with DB in production)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/contact', methods=['POST'])
def contact():
    data = request.get_json()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    message = data.get('message', '').strip()

    if not all([name, email, message]):
        return jsonify({'success': False, 'error': 'All fields required'}), 400

    entry = {
        'name': name,
        'email': email,
        'message': message,
        'timestamp': datetime.now().isoformat()
    }
    messages_store.append(entry)

    # Notify owner via SocketIO
    socketio.emit('new_message', entry, namespace='/admin')

    # Send email notification to owner
    try:
        if app.config['MAIL_USERNAME']:
            owner_msg = Message(
                subject=f'New Portfolio Message from {name}',
                recipients=[OWNER_EMAIL],
                body=f"From: {name} <{email}>\n\nMessage:\n{message}\n\nReceived: {entry['timestamp']}"
            )
            mail.send(owner_msg)

            # Auto-reply to sender
            reply = Message(
                subject='Thank you for reaching out!',
                recipients=[email],
                body=f"Hi {name},\n\nThank you for reaching out. I'll get back to you as soon as possible.\n\nBest regards,\nMilena Mayilyan"
            )
            mail.send(reply)
    except Exception as e:
        app.logger.warning(f'Email sending failed: {e}')

    return jsonify({'success': True, 'message': "Thank you for reaching out. I'll get back to you as soon as possible."})


@socketio.on('connect', namespace='/admin')
def admin_connect():
    emit('history', messages_store)


if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
