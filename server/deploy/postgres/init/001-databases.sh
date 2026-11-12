#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
SELECT 'CREATE DATABASE auth' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auth') \gexec
SELECT 'CREATE DATABASE arkasodhara' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'arkasodhara') \gexec
SELECT 'CREATE DATABASE drawer' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'drawer') \gexec
SELECT 'CREATE DATABASE "env-manager"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'env-manager') \gexec
SELECT 'CREATE DATABASE portfolio' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'portfolio') \gexec
SELECT 'CREATE DATABASE "project-tracker"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'project-tracker') \gexec
SQL
