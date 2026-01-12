/**
 * LinkedIn Tracker Settings Page
 */

const form = document.getElementById('settingsForm');
const clientEmailInput = document.getElementById('clientEmail');
const privateKeyInput = document.getElementById('privateKey');
const sheetIdInput = document.getElementById('sheetId');
const testBtn = document.getElementById('testBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

/**
 * Show status message
 */
function showStatus(message, type = 'info', duration = 3000) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    if (duration > 0) {
        setTimeout(() => {
            statusMessage.className = 'status-message';
        }, duration);
    }
}

/**
 * Load saved settings
 */
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['googleSheetsConfig'], (result) => {
            if (result.googleSheetsConfig) {
                const config = result.googleSheetsConfig;
                clientEmailInput.value = config.client_email || '';
                privateKeyInput.value = config.private_key || '';
                sheetIdInput.value = config.sheet_id || '';
                console.log('Settings loaded successfully');
            }
            resolve();
        });
    });
}

/**
 * Save settings
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const config = {
        client_email: clientEmailInput.value.trim(),
        private_key: privateKeyInput.value.trim(),
        sheet_id: sheetIdInput.value.trim()
    };

    // Validate inputs
    if (!config.client_email || !config.private_key || !config.sheet_id) {
        showStatus('❌ Please fill in all required fields', 'error');
        return;
    }

    if (!config.client_email.includes('@')) {
        showStatus('❌ Invalid email format', 'error');
        return;
    }

    if (!config.private_key.includes('BEGIN PRIVATE KEY')) {
        showStatus('❌ Invalid private key format', 'error');
        return;
    }

    // Save to Chrome storage
    chrome.storage.sync.set({ googleSheetsConfig: config }, () => {
        showStatus('✅ Settings saved successfully!', 'success');
        console.log('Settings saved to Chrome storage');
    });
});

/**
 * Test connection
 */
testBtn.addEventListener('click', async () => {
    const config = {
        client_email: clientEmailInput.value.trim(),
        private_key: privateKeyInput.value.trim(),
        sheet_id: sheetIdInput.value.trim()
    };

    // Validate inputs
    if (!config.client_email || !config.private_key || !config.sheet_id) {
        showStatus('❌ Please fill in all fields before testing', 'error');
        return;
    }

    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="loading"></span> Testing...';

    try {
        // Save temporarily for testing
        const db = new (await getGoogleSheetsDB())(config);
        const result = await db.testConnection();

        if (result.success) {
            showStatus(`✅ Connection successful! Found ${result.count} candidates in your sheet.`, 'success');
        } else {
            showStatus(`❌ Connection failed: ${result.error}`, 'error', 5000);
        }
    } catch (error) {
        showStatus(`❌ Error: ${error.message}`, 'error', 5000);
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '🧪 Test Connection';
    }
});

/**
 * Reset form
 */
resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all settings?')) {
        clientEmailInput.value = '';
        privateKeyInput.value = '';
        sheetIdInput.value = '';
        chrome.storage.sync.remove(['googleSheetsConfig'], () => {
            showStatus('🔄 Settings cleared', 'info');
        });
    }
});

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    console.log('Settings page initialized');
});

/**
 * Get GoogleSheetsDB instance with custom config
 */
async function getGoogleSheetsDB() {
    // Test version of GoogleSheetsDB class
    return class GoogleSheetsDBTest {
        constructor(config) {
            this.credentials = config;
            this.accessToken = null;
        }

        async testConnection() {
            try {
                await this.authenticate();
                const count = await this.getCandidateCount();
                return { success: true, count };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }

        async authenticate() {
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
                const errorText = await tokenResponse.text();
                throw new Error(`Authentication failed: ${tokenResponse.status} - ${errorText}`);
            }

            const data = await tokenResponse.json();
            this.accessToken = data.access_token;
        }

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
                console.error('JWT signing error:', error);
                console.error('KJUR available:', typeof KJUR !== 'undefined');
                throw new Error('Failed to sign JWT: ' + error.message);
            }
        }

        hexToBase64Url(hex) {
            const base64 = btoa(hex.match(/\w{2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join(''));
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }

        base64UrlEncode(str) {
            const base64 = btoa(unescape(encodeURIComponent(str)));
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }

        async getCandidateCount() {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${this.credentials.sheet_id}/values/Sheet1!A:M`,
                { headers: { Authorization: `Bearer ${this.accessToken}` } }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch data: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const values = data.values || [];
            return Math.max(0, values.length - 1); // Subtract header
        }
    };
}
