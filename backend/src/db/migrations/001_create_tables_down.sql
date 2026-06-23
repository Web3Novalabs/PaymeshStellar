-- Migration 001 DOWN: drop all tables created in 001_create_tables_up.sql
-- Drop in reverse dependency order so FK constraints are satisfied.

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS users;
