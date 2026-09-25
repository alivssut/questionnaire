#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ]; then
    echo "Waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}..."
    while ! nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; do
        sleep 0.5
    done
    echo "Postgres is up."
fi

python manage.py migrate --noinput

if [ "$DJANGO_SETTINGS_MODULE" = "config.settings.production" ]; then
    python manage.py collectstatic --noinput
fi

exec "$@"