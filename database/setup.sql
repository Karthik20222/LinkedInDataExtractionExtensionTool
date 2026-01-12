-- LinkedIn Candidate Database - Complete Setup Script
-- Run this with: psql -U postgres -f setup.sql

-- Terminate existing connections to the database (if any)
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'linkedin_recruiter_db'
  AND pid <> pg_backend_pid();

-- Drop database if exists (WARNING: This will delete all data!)
DROP DATABASE IF EXISTS linkedin_recruiter_db;

-- Create the database
CREATE DATABASE linkedin_recruiter_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    TEMPLATE = template0
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Display success message
\echo '✅ Database "linkedin_recruiter_db" created successfully!'
\echo 'Now connecting to the database...'

-- Connect to the newly created database
\c linkedin_recruiter_db

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
    member_id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    headline TEXT,
    location VARCHAR(255),
    current_company VARCHAR(255),
    profile_url TEXT NOT NULL,
    processed_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster searches on name
CREATE INDEX IF NOT EXISTS idx_full_name ON candidates(full_name);

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_created_at ON candidates(created_at DESC);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before any update
CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO candidates (member_id, full_name, headline, location, current_company, profile_url, processed_by)
VALUES 
    ('TEST001', 'Test Candidate 1', 'Senior Civil Engineer at LTTS', 'Bangalore, India', 'LTTS', 'https://www.linkedin.com/in/test1', 'hr@kushi.com'),
    ('TEST002', 'Test Candidate 2', 'Structural Engineer at Oil Corp', 'Mumbai, India', 'Oil Corp', 'https://www.linkedin.com/in/test2', 'hr@kushi.com')
ON CONFLICT (member_id) DO NOTHING;

-- Add table comments
COMMENT ON TABLE candidates IS 'Stores LinkedIn candidate profiles processed by recruiters';
COMMENT ON COLUMN candidates.member_id IS 'Unique LinkedIn member ID (extracted from URL)';
COMMENT ON COLUMN candidates.full_name IS 'Full name of the candidate';
COMMENT ON COLUMN candidates.headline IS 'Professional headline from LinkedIn profile';
COMMENT ON COLUMN candidates.profile_url IS 'Full LinkedIn profile URL';
COMMENT ON COLUMN candidates.created_at IS 'Timestamp when candidate was first processed';

-- Display table structure
\echo ''
\echo '📊 Table Structure:'
\d candidates

-- Display sample data
\echo ''
\echo '📋 Sample Data:'
SELECT member_id, full_name, headline, created_at FROM candidates;

-- Display statistics
\echo ''
\echo '📈 Database Statistics:'
SELECT 
    COUNT(*) as total_candidates,
    COUNT(DISTINCT processed_by) as unique_recruiters,
    MAX(created_at) as last_added
FROM candidates;

\echo ''
\echo '✅ Setup complete! Database is ready to use.'
\echo '🚀 Start the backend server with: npm start'
