FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chmod +x /app/docker-entrypoint.sh
RUN groupadd --gid 1000 appuser && useradd --uid 1000 --gid appuser -m appuser
RUN mkdir -p /app/staticfiles /app/logs /app/logs/custom_logs
RUN chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "spotify_project.wsgi:application", "--config=gunicorn_config.py"]