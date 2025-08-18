import multiprocessing

bind = "0.0.0.0:8000"

workers = min(multiprocessing.cpu_count(), 4)

worker_class = "gthread"
threads = 15
timeout = 500
max_requests = 1000
max_requests_jitter = 50

loglevel = "info"
errorlog = "logs/gunicorn.log"
accesslog = "logs/access.log"
pidfile = "logs/gunicorn.pid"
capture_output = True
proc_name = "spotify_project"