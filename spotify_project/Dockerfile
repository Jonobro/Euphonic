FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser and dependencies
RUN playwright install --with-deps chromium

# Copy project
COPY . .

# Set permissions while still root
RUN chmod +x /app/docker-entrypoint.sh

# Create non-root user first
RUN groupadd --gid 1000 appuser && useradd --uid 1000 --gid appuser -m appuser

# Create necessary directories before changing ownership
RUN mkdir -p /app/staticfiles /app/logs /app/logs/custom_logs

# Change ownership of the entire app directory to the non-root user
RUN chown -R appuser:appuser /app

# Finally switch to the non-root user
USER appuser

# Expose port for Gunicorn
EXPOSE 8000

# Set entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command: run Gunicorn using config file
CMD ["gunicorn", "spotify_project.wsgi:application", "--config=gunicorn_config.py"]