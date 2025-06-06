import multiprocessing

bind = "0.0.0.0:8000"

# Calculate workers based on CPU cores
calculated_workers = multiprocessing.cpu_count() * 2 + 1
MAX_WORKERS = 8
workers = min(calculated_workers, MAX_WORKERS)

# Worker class - use sync for Django
worker_class = "sync"

# Timeout (seconds)
timeout = 1000

# Maximum number of requests a worker will process before restarting
max_requests = 1000
max_requests_jitter = 50

errorlog = "logs/error.log"
accesslog = "logs/access.log"
loglevel = "info"

proc_name = "spotify_project"
