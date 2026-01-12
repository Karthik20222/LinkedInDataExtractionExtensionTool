/**
 * Database Connection Test Script
 * Run this to verify your PostgreSQL connection before starting the server
 * Usage: node test-connection.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

console.log(`${colors.cyan}================================================${colors.reset}`);
console.log(`${colors.cyan}  LinkedIn Recruiter - Database Connection Test${colors.reset}`);
console.log(`${colors.cyan}================================================${colors.reset}\n`);

// Test 1: Check environment variables
console.log(`${colors.blue}[1/5] Checking environment variables...${colors.reset}`);
const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log(`${colors.red}❌ Missing environment variables: ${missingVars.join(', ')}${colors.reset}`);
    console.log(`${colors.yellow}💡 Make sure you have a .env file in the backend folder${colors.reset}\n`);
    process.exit(1);
}

console.log(`${colors.green}✅ All environment variables found${colors.reset}`);
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   Port: ${process.env.DB_PORT}`);
console.log(`   Database: ${process.env.DB_NAME}`);
console.log(`   User: ${process.env.DB_USER}\n`);

// Test 2: Create connection pool
console.log(`${colors.blue}[2/5] Creating PostgreSQL connection pool...${colors.reset}`);
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

console.log(`${colors.green}✅ Connection pool created${colors.reset}\n`);

// Test 3: Test basic connection
console.log(`${colors.blue}[3/5] Testing database connection...${colors.reset}`);

async function runTests() {
    try {
        // Basic connection test
        const timeResult = await pool.query('SELECT NOW() as current_time');
        console.log(`${colors.green}✅ Connection successful!${colors.reset}`);
        console.log(`   Server time: ${timeResult.rows[0].current_time}\n`);

        // Test 4: Check if candidates table exists
        console.log(`${colors.blue}[4/5] Checking if 'candidates' table exists...${colors.reset}`);
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'candidates'
            );
        `);

        if (tableCheck.rows[0].exists) {
            console.log(`${colors.green}✅ Table 'candidates' found${colors.reset}\n`);

            // Test 5: Get table statistics
            console.log(`${colors.blue}[5/5] Fetching table statistics...${colors.reset}`);
            const stats = await pool.query(`
                SELECT 
                    COUNT(*) as total_candidates,
                    COUNT(DISTINCT processed_by) as unique_recruiters,
                    MAX(created_at) as last_added,
                    MIN(created_at) as first_added
                FROM candidates;
            `);

            const data = stats.rows[0];
            console.log(`${colors.green}✅ Statistics retrieved${colors.reset}`);
            console.log(`   Total Candidates: ${data.total_candidates}`);
            console.log(`   Unique Recruiters: ${data.unique_recruiters}`);
            console.log(`   First Added: ${data.first_added || 'N/A'}`);
            console.log(`   Last Added: ${data.last_added || 'N/A'}\n`);

            // Show sample data if exists
            if (parseInt(data.total_candidates) > 0) {
                const samples = await pool.query(`
                    SELECT member_id, full_name, headline 
                    FROM candidates 
                    ORDER BY created_at DESC 
                    LIMIT 3
                `);

                console.log(`${colors.cyan}📋 Sample Candidates:${colors.reset}`);
                samples.rows.forEach((candidate, index) => {
                    console.log(`   ${index + 1}. ${candidate.full_name} - ${candidate.headline}`);
                });
                console.log('');
            }
        } else {
            console.log(`${colors.yellow}⚠️  Table 'candidates' not found${colors.reset}`);
            console.log(`${colors.yellow}💡 Run the database setup script:${colors.reset}`);
            console.log(`   ${colors.cyan}psql -U postgres -f ../database/setup.sql${colors.reset}\n`);
        }

        // Final success message
        console.log(`${colors.cyan}================================================${colors.reset}`);
        console.log(`${colors.green}✅ All tests passed! Database is ready to use.${colors.reset}`);
        console.log(`${colors.cyan}================================================${colors.reset}\n`);
        console.log(`${colors.yellow}Next steps:${colors.reset}`);
        console.log(`   1. Start the backend server: ${colors.cyan}npm start${colors.reset}`);
        console.log(`   2. Load the Chrome extension`);
        console.log(`   3. Visit a LinkedIn profile\n`);

    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}\n`);

        // Provide helpful error messages
        if (error.code === 'ECONNREFUSED') {
            console.log(`${colors.yellow}💡 PostgreSQL server is not running or not accessible${colors.reset}`);
            console.log(`${colors.yellow}   Try these steps:${colors.reset}`);
            console.log(`   1. Check if PostgreSQL service is running:`);
            console.log(`      ${colors.cyan}Get-Service -Name postgresql*${colors.reset}`);
            console.log(`   2. Start the service if stopped:`);
            console.log(`      ${colors.cyan}Start-Service postgresql-x64-14${colors.reset}\n`);
        } else if (error.code === '3D000') {
            console.log(`${colors.yellow}💡 Database '${process.env.DB_NAME}' does not exist${colors.reset}`);
            console.log(`${colors.yellow}   Create it by running:${colors.reset}`);
            console.log(`   ${colors.cyan}psql -U postgres -f ../database/setup.sql${colors.reset}\n`);
        } else if (error.code === '28P01') {
            console.log(`${colors.yellow}💡 Authentication failed - check your password${colors.reset}`);
            console.log(`${colors.yellow}   Update DB_PASSWORD in your .env file${colors.reset}\n`);
        } else if (error.code === '28000') {
            console.log(`${colors.yellow}💡 Invalid username or insufficient privileges${colors.reset}`);
            console.log(`${colors.yellow}   Check DB_USER in your .env file${colors.reset}\n`);
        }
    } finally {
        await pool.end();
        console.log(`${colors.blue}🔌 Connection closed${colors.reset}\n`);
    }
}

// Run the tests
runTests();
