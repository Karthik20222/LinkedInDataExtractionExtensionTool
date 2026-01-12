/**
 * Google Sheets Database Module
 * Handles all interactions with Google Sheets API
 */

class GoogleSheetsDB {
    constructor() {
        this.credentials = null;
        this.accessToken = null;
        this.tokenExpiry = null;
        this.apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.appendUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        this.loadCredentials();
    }

    /**
     * Load credentials from Chrome storage
     */
    loadCredentials() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['googleSheetsConfig'], (result) => {
                if (result.googleSheetsConfig) {
                    this.credentials = result.googleSheetsConfig;
                    console.log('[GoogleSheetsDB] Credentials loaded');
                    resolve(true);
                } else {
                    console.warn('[GoogleSheetsDB] No credentials found');
                    resolve(false);
                }
            });
        });
    }

    /**
     * Save credentials to Chrome storage
     */
    saveCredentials(config) {
        return new Promise((resolve) => {
            this.credentials = config;
            chrome.storage.sync.set({ googleSheetsConfig: config }, () => {
                console.log('[GoogleSheetsDB] Credentials saved');
                resolve(true);
            });
        });
    }

    /**
     * Authenticate with Google API
     */
    async authenticate() {
        if (!this.credentials) {
            throw new Error('Credentials not configured. Please set up in Settings.');
        }

        // Check if token is still valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const jwtToken = this.generateJWT();
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    assertion: jwtToken
                })
            });

            if (!tokenResponse.ok) {
                throw new Error(`Authentication failed: ${tokenResponse.statusText}`);
            }

            const data = await tokenResponse.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min before expiry

            console.log('[GoogleSheetsDB] Authentication successful');
            return this.accessToken;
        } catch (error) {
            console.error('[GoogleSheetsDB] Authentication error:', error);
            throw error;
        }
    }

    /**
     * Generate JWT token for service account
     */
    generateJWT() {
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.credentials.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        const signature = this.signJWT(encodedHeader + '.' + encodedPayload);

        return encodedHeader + '.' + encodedPayload + '.' + signature;
    }

    /**
     * Sign JWT with private key using RSA-SHA256
     */
    signJWT(message) {
        try {
            // Check if jsrsasign is loaded
            if (typeof KJUR === 'undefined') {
                throw new Error('jsrsasign library not loaded. Please reload the extension.');
            }
            
            // Use jsrsasign library for RSA-SHA256 signing
            // Convert literal \n to actual newlines
            const privateKey = this.credentials.private_key.replace(/\\n/g, '\n');
            
            // Create RSA key object from PEM string
            const sig = new KJUR.crypto.Signature({ "alg": "SHA256withRSA" });
            sig.init(privateKey);
            sig.updateString(message);
            const signatureHex = sig.sign();
            
            // Convert hex signature to base64url
            return this.hexToBase64Url(signatureHex);
        } catch (error) {
            console.error('[GoogleSheetsDB] JWT signing error:', error);
            throw new Error('Failed to sign JWT: ' + error.message);
        }
    }

    /**
     * Convert hex to base64 URL encoded string
     */
    hexToBase64Url(hex) {
        const base64 = btoa(hex.match(/\w{2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join(''));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Base64 URL encode
     */
    base64UrlEncode(str) {
        const base64 = btoa(unescape(encodeURIComponent(str)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Check if candidate already exists in sheet
     * Returns { exists: boolean, processedBy: string }
     */
    async candidateExists(linkedInId) {
        try {
            const token = await this.authenticate();
            const range = 'Sheet1!B:M'; // LinkedIn ID (B) and Processed By (M)

            const response = await fetch(
                `${this.apiUrl}/${this.credentials.sheet_id}/values/${range}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[GoogleSheetsDB] Failed to check candidate:', response.status, errorText);
                return { exists: false, processedBy: '' };
            }

            const data = await response.json();
            const values = data.values || [];

            // Find the row with matching LinkedIn ID (skip header row)
            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === linkedInId) {
                    // Column B is index 0, Column M is index 11 (M - B = 11)
                    const processedBy = values[i][11] || '';
                    return { exists: true, processedBy };
                }
            }
            return { exists: false, processedBy: '' };
        } catch (error) {
            console.error('[GoogleSheetsDB] Error checking candidate:', error);
            return { exists: false, processedBy: '' };
        }
    }

    /**
     * Add candidate to sheet
     */
    async addCandidate(candidateData) {
        try {
            const token = await this.authenticate();

            const values = [[
                candidateData.full_name || '',
                candidateData.member_id || '',
                candidateData.headline || '',
                candidateData.designation || '',
                candidateData.location || '',
                candidateData.current_company || '',
                candidateData.profile_url || '',
                candidateData.notes || '',
                'NEW',
                new Date().toISOString().split('T')[0],
                candidateData.qualification || '',      // K: Qualification
                candidateData.passout || '',            // L: Passout
                '',                                      // M: Recruiter Name/Email
                candidateData.years_at_current || '',   // N: Years at Current Company
                candidateData.total_years_experience || '' // O: Total Years of Experience
            ]];

            const response = await fetch(
                `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!A:O:append?valueInputOption=USER_ENTERED`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to add candidate: ${response.status} - ${errorText}`);
            }

            console.log('[GoogleSheetsDB] Candidate added successfully:', candidateData.full_name);
            return { success: true, data: candidateData };
        } catch (error) {
            // Log additional context to make network issues easier to debug
            console.error('[GoogleSheetsDB] Error adding candidate:', {
                error,
                sheetId: this.credentials?.sheet_id,
                hasToken: Boolean(this.accessToken),
                url: `${this.apiUrl}/${this.credentials?.sheet_id}/values/Sheet1!A:O:append`
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all candidates
     */
    async getAllCandidates() {
        try {
            const token = await this.authenticate();
            const range = 'Sheet1!A:O';

            const response = await fetch(
                `${this.apiUrl}/${this.credentials.sheet_id}/values/${range}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }

            const data = await response.json();
            const values = data.values || [];

            // Skip header row and convert to objects
            const candidates = values.slice(1).map((row, index) => ({
                id: index + 1,
                fullName: row[0] || '',
                linkedInId: row[1] || '',
                headline: row[2] || '',
                designation: row[3] || '',
                location: row[4] || '',
                company: row[5] || '',
                profileUrl: row[6] || '',
                notes: row[7] || '',
                status: row[8] || '',
                addedDate: row[9] || '',
                qualification: row[10] || '',   // K: Qualification
                passout: row[11] || '',         // L: Passout
                processedBy: row[12] || '',     // M: Recruiter Name/Email
                yearsAtCurrent: row[13] || '',  // N: Years at Current Company
                totalYears: row[14] || ''       // O: Total Years of Experience
            }));

            console.log('[GoogleSheetsDB] Retrieved', candidates.length, 'candidates');
            return candidates;
        } catch (error) {
            console.error('[GoogleSheetsDB] Error fetching candidates:', error);
            throw error;
        }
    }

    /**
     * Get candidate count
     */
    async getCandidateCount() {
        try {
            const candidates = await this.getAllCandidates();
            return candidates.length;
        } catch (error) {
            console.error('[GoogleSheetsDB] Error getting count:', error);
            return 0;
        }
    }

    /**
     * Update candidate notes
     */
    async updateCandidateNotes(linkedInId, notes) {
        try {
            const token = await this.authenticate();
            const candidates = await this.getAllCandidates();

            // Find row index
            const rowIndex = candidates.findIndex(c => c.linkedInId === linkedInId) + 2; // +2 for header and 1-based

            if (rowIndex < 2) {
                throw new Error('Candidate not found');
            }

            const response = await fetch(
                `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!G${rowIndex}?valueInputOption=USER_ENTERED`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ values: [[notes]] })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to update candidate: ${response.statusText}`);
            }

            console.log('[GoogleSheetsDB] Candidate notes updated');
            return true;
        } catch (error) {
            console.error('[GoogleSheetsDB] Error updating candidate:', error);
            throw error;
        }
    }

    /**
     * Update candidate fields (company, notes, processedBy)
     */
    async updateCandidateFields(linkedInId, { company, notes, processedBy, yearsAtCurrent, totalYears }) {
        try {
            const token = await this.authenticate();
            const candidates = await this.getAllCandidates();

            const rowIndex = candidates.findIndex(c => c.linkedInId === linkedInId) + 2; // header + 1-based
            if (rowIndex < 2) throw new Error('Candidate not found');

            // Build sequential updates for provided fields
            // Column F = Company (index 5), Column H = Notes (index 7), Column M = Processed By
            // Column N = Years at Current, Column O = Total Years
            const updates = [];
            if (typeof company === 'string') {
                updates.push(fetch(
                    `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!F${rowIndex}?valueInputOption=USER_ENTERED`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: [[company]] })
                    }
                ));
            }
            if (typeof notes === 'string') {
                updates.push(fetch(
                    `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!H${rowIndex}?valueInputOption=USER_ENTERED`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: [[notes]] })
                    }
                ));
            }
            if (typeof processedBy === 'string') {
                updates.push(fetch(
                    `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!M${rowIndex}?valueInputOption=USER_ENTERED`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: [[processedBy]] })
                    }
                ));
            }
            if (typeof yearsAtCurrent === 'string') {
                updates.push(fetch(
                    `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!N${rowIndex}?valueInputOption=USER_ENTERED`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: [[yearsAtCurrent]] })
                    }
                ));
            }
            if (typeof totalYears === 'string') {
                updates.push(fetch(
                    `${this.apiUrl}/${this.credentials.sheet_id}/values/Sheet1!O${rowIndex}?valueInputOption=USER_ENTERED`,
                    {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: [[totalYears]] })
                    }
                ));
            }

            const results = await Promise.all(updates);
            const failed = results.find(r => !r.ok);
            if (failed) {
                const text = await failed.text();
                throw new Error(`Failed to update: ${failed.status} - ${text}`);
            }
            return { success: true };
        } catch (error) {
            console.error('[GoogleSheetsDB] Error updating fields:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete candidate
     */
    async deleteCandidate(linkedInId) {
        try {
            const token = await this.authenticate();
            const candidates = await this.getAllCandidates();

            // Find row index
            const rowIndex = candidates.findIndex(c => c.linkedInId === linkedInId) + 1; // +1 for 0-based

            if (rowIndex < 1) {
                throw new Error('Candidate not found');
            }

            const response = await fetch(
                `${this.apiUrl}/${this.credentials.sheet_id}:batchUpdate`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 0,
                                    dimension: 'ROWS',
                                    startIndex: rowIndex,
                                    endIndex: rowIndex + 1
                                }
                            }
                        }]
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to delete candidate: ${response.statusText}`);
            }

            console.log('[GoogleSheetsDB] Candidate deleted');
            return true;
        } catch (error) {
            console.error('[GoogleSheetsDB] Error deleting candidate:', error);
            throw error;
        }
    }

    /**
     * Test connection
     */
    async testConnection() {
        try {
            await this.authenticate();
            const count = await this.getCandidateCount();
            console.log('[GoogleSheetsDB] Connection test successful. Candidates:', count);
            return { success: true, count };
        } catch (error) {
            console.error('[GoogleSheetsDB] Connection test failed:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
const googleSheetsDB = new GoogleSheetsDB();

