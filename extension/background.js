/**
 * Background Service Worker for LinkedIn Candidate Tracker
 * Manifest V3
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('LinkedIn Candidate Tracker installed!');
        
        // Open welcome page
        chrome.tabs.create({
            url: 'https://github.com/yourusername/linkedin-tracker'
        });
        
        // Set default settings
        chrome.storage.local.set({
            apiUrl: 'http://localhost:3000/api',
            autoCheck: true,
            showNotifications: true
        });
    } else if (details.reason === 'update') {
        console.log('LinkedIn Candidate Tracker updated!');
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'candidateProcessed') {
        console.log('Candidate added:', request.candidateName);
    }
    if (request.action === 'candidateExists') {
        console.log('Candidate already processed:', request.candidateName);
    }
});

// Keep service worker alive (optional, for debugging)
chrome.runtime.onStartup.addListener(() => {
    console.log('LinkedIn Candidate Tracker service worker started');
});
