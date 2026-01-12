-- LinkedIn Candidate Database Schema
-- This script creates the necessary database and table for tracking processed candidates

-- Create the database if it doesn't exist
-- Note: This must be run by a user with database creation privileges (e.g., postgres)
SELECT 'CREATE DATABASE linkedin_recruiter_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'linkedin_recruiter_db')\gexec

-- Connect to the database
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

-- Insert sample data (optional, for testing)
-- INSERT INTO candidates (member_id, full_name, headline, location, profile_url)
-- VALUES ('12345678', 'John Doe', 'Senior Civil Engineer at LTTS', 'Bangalore, India', 'https://www.linkedin.com/in/johndoe')
-- ON CONFLICT (member_id) DO NOTHING;

COMMENT ON TABLE candidates IS 'Stores LinkedIn candidate profiles processed by recruiters';
COMMENT ON COLUMN candidates.member_id IS 'Unique LinkedIn member ID (extracted from URL)';
COMMENT ON COLUMN candidates.full_name IS 'Full name of the candidate';
COMMENT ON COLUMN candidates.headline IS 'Professional headline from LinkedIn profile';
COMMENT ON COLUMN candidates.profile_url IS 'Full LinkedIn profile URL';
COMMENT ON COLUMN candidates.created_at IS 'Timestamp when candidate was first processed';
