/**
 * LinkedIn Candidate Tracker - Popup Script (Google Sheets Version)
 */

// Block malformed fetch/XHR requests at source
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    // Silently reject invalid requests without logging
    if (!url || typeof url !== 'string' || url === '/' || url === '' || url.includes('/invalid') || 
        url.includes('gf1jbqula7hip12fm2vbpbanv') || !url.startsWith('http')) {
        return Promise.reject(new Error('Invalid URL blocked'));
    }
    return originalFetch.apply(this, args);
};

// DOM elements
const totalCandidatesEl = document.getElementById('totalCandidates');
const serverStatusEl = document.getElementById('serverStatus');
const recheckBtn = document.getElementById('recheckBtn');
const viewAllBtn = document.getElementById('viewAllBtn');
const settingsBtn = document.getElementById('settingsBtn');
const deleteBtn = document.getElementById('deleteBtn');
const statusMessage = document.getElementById('statusMessage');

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

/**
 * Check Google Sheets configuration status
 */
async function checkConfigurationStatus() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['googleSheetsConfig'], (result) => {
            if (result.googleSheetsConfig && result.googleSheetsConfig.private_key) {
                serverStatusEl.textContent = '🟢 Configured';
                serverStatusEl.style.color = '#4caf50';
                resolve(true);
            } else {
                serverStatusEl.textContent = '🔴 Not Configured';
                serverStatusEl.style.color = '#f44336';
                resolve(false);
            }
        });
    });
}

/**
 * Get total candidates count
 */
async function getTotalCandidates() {
    try {
        // In a full implementation, would fetch from Google Sheets
        // For now, show placeholder
        totalCandidatesEl.textContent = '—';
    } catch (error) {
        totalCandidatesEl.textContent = 'Error';
        console.error('Failed to fetch candidate count:', error);
    }
}

/**
 * Recheck current profile
 */
recheckBtn.addEventListener('click', async () => {
    try {
        recheckBtn.innerHTML = '<span class="loading"></span> Checking...';
        recheckBtn.disabled = true;
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('linkedin.com')) {
            showStatus('Please open a LinkedIn profile page', 'error');
            return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'recheck' }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus('Please refresh the LinkedIn page', 'error');
            } else if (response && response.success) {
                showStatus('Profile rechecked successfully!', 'success');
                getTotalCandidates();
            }
        });
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    } finally {
        recheckBtn.innerHTML = '♻️ Recheck Current Profile';
        recheckBtn.disabled = false;
    }
});

/**
 * Open Settings page
 */
settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

/**
 * Open Google Sheet (placeholder - user must configure first)
 */
viewAllBtn.addEventListener('click', async () => {
    const config = await new Promise((resolve) => {
        chrome.storage.sync.get(['googleSheetsConfig'], (result) => {
            resolve(result.googleSheetsConfig || null);
        });
    });

    if (config && config.sheet_id) {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${config.sheet_id}/edit`;
        chrome.tabs.create({ url: sheetUrl });
    } else {
        showStatus('Please configure Google Sheets first', 'error');
    }
});

/**
 * Delete current candidate from sheet
 */
deleteBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('linkedin.com')) {
            showStatus('Please open a LinkedIn profile page', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete this candidate from the sheet?')) {
            return;
        }

        deleteBtn.innerHTML = '<span class="loading"></span> Deleting...';
        deleteBtn.disabled = true;

        chrome.tabs.sendMessage(tab.id, { action: 'deleteCurrentCandidate' }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus('Please refresh the LinkedIn page first', 'error');
            } else if (response && response.success) {
                showStatus('Candidate deleted successfully!', 'success');
                getTotalCandidates();
            } else {
                showStatus(response?.error || 'Failed to delete candidate', 'error');
            }
            deleteBtn.innerHTML = '🗑️ Delete Current Candidate';
            deleteBtn.disabled = false;
        });
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        deleteBtn.innerHTML = '🗑️ Delete Current Candidate';
        deleteBtn.disabled = false;
    }
});

/**
 * Initialize popup
 */
async function init() {
    const isConfigured = await checkConfigurationStatus();
    if (isConfigured) {
        await getTotalCandidates();
    }
}

init();

setInterval(() => {
    checkConfigurationStatus();
    getTotalCandidates();
}, 30000);

