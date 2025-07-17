#!/bin/bash
set -e

echo "Clearing old static files..."
rm -rf /app/staticfiles/*

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Applying migrations..."
python manage.py migrate --noinput

# Executes the CMD specified in the Dockerfile
exec "$@"