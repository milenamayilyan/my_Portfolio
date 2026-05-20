import eventlet
eventlet.monkey_patch()

bind = "127.0.0.1:5000"
workers = 1
worker_class = "eventlet"
worker_connections = 1000
timeout = 120
keepalive = 5
errorlog = "/var/log/milena-portfolio/gunicorn-error.log"
accesslog = "/var/log/milena-portfolio/gunicorn-access.log"
loglevel = "info"
