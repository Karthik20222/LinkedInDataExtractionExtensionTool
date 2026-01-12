const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { query, testConnection } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow Chrome extension origins
        if (origin.startsWith('chrome-extension://')) {
            return callback(null, true);
        }
        
        // Allow localhost for development
        if (origin.includes('localhost')) {
            return callback(null, true);
        }
        
        callback(null, true); // For development, allow all origins
    },
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'LinkedIn Recruiter API is running',
        timestamp: new Date().toISOString()
    });
});

// GET endpoint: Check if candidate exists by LinkedIn member ID
app.get('/api/candidates/:memberId', async (req, res) => {
    const { memberId } = req.params;
    
    try {
        const result = await query(
            'SELECT * FROM candidates WHERE member_id = $1',
            [memberId]
        );
        
        if (result.rows.length > 0) {
            // Candidate exists - already processed
            res.status(200).json({
                exists: true,
                candidate: result.rows[0],
                message: 'Candidate already processed'
            });
        } else {
            // Candidate not found - new candidate
            res.status(404).json({
                exists: false,
                message: 'Candidate not found in database'
            });
        }
    } catch (error) {
        console.error('Error checking candidate:', error);
        res.status(500).json({
            error: 'Database error',
            message: error.message
        });
    }
});

// POST endpoint: Add new candidate to database
app.post('/api/candidates', async (req, res) => {
    const { 
        member_id, 
        full_name, 
        headline, 
        location,
        current_company,
        profile_url,
        processed_by,
        notes
    } = req.body;
    
    // Validate required fields
    if (!member_id || !full_name || !profile_url) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['member_id', 'full_name', 'profile_url']
        });
    }
    
    try {
        // Use INSERT ... ON CONFLICT to handle duplicates gracefully
        const result = await query(
            `INSERT INTO candidates 
            (member_id, full_name, headline, location, current_company, profile_url, processed_by, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (member_id) 
            DO UPDATE SET 
                full_name = COALESCE(EXCLUDED.full_name, candidates.full_name),
                headline = COALESCE(EXCLUDED.headline, candidates.headline),
                location = COALESCE(EXCLUDED.location, candidates.location),
                current_company = COALESCE(EXCLUDED.current_company, candidates.current_company),
                processed_by = COALESCE(EXCLUDED.processed_by, candidates.processed_by),
                notes = COALESCE(EXCLUDED.notes, candidates.notes),
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [member_id, full_name, headline, location, current_company, profile_url, processed_by, notes]
        );
        
        res.status(201).json({
            success: true,
            message: 'Candidate added successfully',
            candidate: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding candidate:', error);
        res.status(500).json({
            error: 'Database error',
            message: error.message
        });
    }
});

// GET endpoint: Retrieve all candidates (with pagination)
app.get('/api/candidates', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    try {
        // Get total count
        const countResult = await query('SELECT COUNT(*) FROM candidates');
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Get paginated results
        const result = await query(
            'SELECT * FROM candidates ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        
        res.status(200).json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({
            error: 'Database error',
            message: error.message
        });
    }
});

// DELETE endpoint: Remove a candidate (optional, for testing)
app.delete('/api/candidates/:memberId', async (req, res) => {
    const { memberId } = req.params;
    
    try {
        const result = await query(
            'DELETE FROM candidates WHERE member_id = $1 RETURNING *',
            [memberId]
        );
        
        if (result.rows.length > 0) {
            res.status(200).json({
                success: true,
                message: 'Candidate deleted successfully',
                candidate: result.rows[0]
            });
        } else {
            res.status(404).json({
                error: 'Candidate not found'
            });
        }
    } catch (error) {
        console.error('Error deleting candidate:', error);
        res.status(500).json({
            error: 'Database error',
            message: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📝 API endpoints:`);
            console.log(`   GET    /api/candidates/:memberId - Check if candidate exists`);
            console.log(`   POST   /api/candidates - Add new candidate`);
            console.log(`   GET    /api/candidates - Get all candidates (paginated)`);
            console.log(`   DELETE /api/candidates/:memberId - Delete candidate\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
