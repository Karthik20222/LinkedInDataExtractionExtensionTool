/**
 * LinkedIn Recruiter - Candidate Tracker Content Script (clean)
 */

const API_BASE_URL = 'http://localhost:3000/api';
let currentMemberId = null;
let processingInProgress = false;

const debug = (message, data = null) => {
  console.log(`[LinkedIn Tracker] ${message}`, data || '');
};

function extractMemberId() {
  const url = window.location.href;
  debug('Current URL:', url);
  const profileIdMatch = url.match(/[?&]profileId=([^&]+)/);
  if (profileIdMatch) return profileIdMatch[1];
  const talentMatch = url.match(/linkedin\.com\/talent\/profile\/([^/?]+)/);
  if (talentMatch) return talentMatch[1];
  const hireMatch = url.match(/linkedin\.com\/recruiter\/profile\/([^/?]+)/);
  if (hireMatch) return hireMatch[1];
  const profileElement = document.querySelector('[data-member-id]');
  if (profileElement) return profileElement.getAttribute('data-member-id');
  const metaId = document.querySelector('meta[property="profile:id"]');
  if (metaId) return metaId.getAttribute('content');
  const urnMatch = document.body.innerHTML.match(/urn:li:member:(\d+)/);
  if (urnMatch) return urnMatch[1];
  debug('⚠️ Could not extract member ID from URL');
  return null;
}

function extractProfileData(memberId) {
  try {
    const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || '';
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'div.pv-text-details__left-panel h1',
      'h1.profile-topcard__name',
      'h1.t-24',
      '.artdeco-entity-lockup__title',
      '[data-test-profile-name]',
      '.ph5 h1',
      '.pv-top-card--list li:first-child'
    ];
    let fullName = '';
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) { fullName = el.textContent.trim(); if (fullName) break; }
    }
    if (!fullName) {
      const personJson = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => s.textContent || '')
        .find(t => t.includes('"@type"') && t.includes('Person'));
      if (personJson) { try { const parsed = JSON.parse(personJson); fullName = parsed.name || fullName; } catch {} }
    }
    if (!fullName) {
      const titleMatch = (getMeta('og:title') || document.title).match(/^([^|]+)/);
      fullName = titleMatch ? titleMatch[1].trim() : 'Unknown Candidate';
    }

    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel .text-body-medium',
      '.profile-topcard__headline',
      '.pv-top-card--list-bullet li',
      '[data-test-profile-headline]',
      '.ph5 .t-18'
    ];
    let headline = '';
    for (const selector of headlineSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) { headline = el.textContent.trim(); if (headline) break; }
    }
    if (!headline) { const ogDesc = getMeta('og:description'); if (ogDesc) headline = ogDesc.split('\n')[0].trim(); }

    const locationSelectors = [
      'span.text-body-small.inline.t-black--light.break-words',
      '.pv-text-details__left-panel .text-body-small:not(.break-words)',
      'div.mt2.relative span.text-body-small',
      '.profile-topcard__location',
      '[data-test-profile-location]',
      '.pv-top-card--list-bullet li:last-child'
    ];
    let location = '';
    for (const selector of locationSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        const text = el.textContent.trim();
        if (text && text.length > 2 && !text.includes('·') && !text.toLowerCase().includes('follower') && !text.toLowerCase().includes('connection')) { location = text; break; }
      }
    }

    const currentCompany = extractCurrentCompany();
    const profileData = {
      member_id: memberId,
      full_name: fullName || 'Unknown',
      headline: headline || '',
      location: location || '',
      current_company: currentCompany || '',
      profile_url: window.location.href.split('?')[0],
      processed_by: null
    };
    debug('Extracted profile data:', profileData);
    return profileData;
  } catch (error) {
    console.error('Error extracting profile data:', error);
    return null;
  }
}

function extractCurrentCompany() {
  console.log('🔍 Starting company extraction...');
  const companySelectors = [
    '.profile-topcard__company-link',
    '[data-test-profile-company]',
    '.pv-top-card--experience-list-item .t-14'
  ];
  for (const selector of companySelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent) { const text = el.textContent.trim(); if (text && text.length > 2) { console.log('✅ Top-card company:', text); return text; } }
  }
  const experienceSection =
    document.querySelector('section[data-section="experience"]') ||
    document.querySelector('section#experience') ||
    document.querySelector('div#experience') ||
    document.querySelector('section.artdeco-card.pv-profile-card');
  if (!experienceSection) { console.log('❌ No Experience section found'); return ''; }
  console.log('✅ Found Experience section');
  const firstItem =
    experienceSection.querySelector('.pvs-list__paged-list-item') ||
    experienceSection.querySelector('.pvs-list__item--line-separated') ||
    experienceSection.querySelector('li.artdeco-list__item');
  console.log('First experience item found:', !!firstItem);
  if (!firstItem) return '';
  const link = firstItem.querySelector('a[href*="/company/"]');
  if (link && link.textContent) { const text = link.textContent.trim(); if (text.length > 2) { console.log('✅ Found company via link:', text); return text; } }
  const secondary = firstItem.querySelector('.pvs-entity__secondary-title span[aria-hidden="true"]');
  if (secondary && secondary.textContent) { const text = secondary.textContent.trim(); if (text.length > 2) { console.log('✅ Found company via secondary-title:', text); return text; } }
  const allSpans = Array.from(firstItem.querySelectorAll('span[aria-hidden="true"]'));
  console.log('Total spans found:', allSpans.length);
  console.log('All span texts:', allSpans.map(s => s.textContent.trim()));
  const exclude = ['connection','message','follow','more','full-time','part-time','contract','freelance','internship','skill','skills','competency','mos','yrs','present','on-site','remote','hybrid'];
  const candidates = allSpans.map(s => s.textContent.trim()).filter(t => t && t.length > 2 && !t.includes('·') && !exclude.some(w => t.toLowerCase().includes(w)));
  console.log('Valid candidates:', candidates);
  if (candidates.length >= 2) { console.log('✅ Found company from candidates[1]:', candidates[1]); return candidates[1]; }
  if (candidates.length === 1) { console.log('⚠️ Only one candidate text; returning:', candidates[0]); return candidates[0]; }
  console.log('❌ No company extracted');
  return '';
}

function getCurrentUserEmail() { return chrome.storage?.local.get(['userEmail']) || 'unknown@recruiter.com'; }

async function checkCandidate(memberId) {
  try {
    const response = await fetch(`${API_BASE_URL}/candidates/${memberId}`);
    const data = await response.json();
    if (response.status === 200 && data.exists) { debug('✅ Candidate found in database:', data.candidate); return { exists: true, data: data.candidate }; }
    debug('❌ Candidate not found in database');
    return { exists: false };
  } catch (error) { console.error('Error checking candidate:', error); return { exists: false, error: error.message }; }
}

async function addCandidate(profileData) {
  try {
    const response = await fetch(`${API_BASE_URL}/candidates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) });
    const data = await response.json();
    if (response.status === 201) { debug('✅ Candidate added to database:', data.candidate); return { success: true, data: data.candidate }; }
    console.error('Failed to add candidate:', data); return { success: false, error: data.error };
  } catch (error) { console.error('Error adding candidate:', error); return { success: false, error: error.message }; }
}

function injectBanner(candidateData) {
  const existingBanner = document.getElementById('linkedin-tracker-banner'); if (existingBanner) existingBanner.remove();
  const banner = document.createElement('div'); banner.id = 'linkedin-tracker-banner'; banner.className = 'linkedin-tracker-banner-warning';
  const processedDate = new Date(candidateData.created_at).toLocaleDateString();
  banner.innerHTML = `
    <div class="banner-content">
      <div class="banner-icon">⚠️</div>
      <div class="banner-text">
        <strong>Candidate Already Processed</strong>
        <p>This candidate was processed on ${processedDate}</p>
        ${candidateData.processed_by ? `<p>By: ${candidateData.processed_by}</p>` : ''}
      </div>
      <button class="banner-close" id="close-banner">✕</button>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
  document.getElementById('close-banner')?.addEventListener('click', () => banner.remove());
  debug('⚠️ Warning banner injected');
}

function injectSuccessBanner() {
  const banner = document.createElement('div'); banner.id = 'linkedin-tracker-banner'; banner.className = 'linkedin-tracker-banner-success';
  banner.innerHTML = `
    <div class="banner-content">
      <div class="banner-icon">✅</div>
      <div class="banner-text">
        <strong>Candidate Added</strong>
        <p>This candidate has been saved to the database</p>
      </div>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
  setTimeout(() => banner.remove(), 3000);
}

async function processCandidate() {
  if (processingInProgress) { debug('Processing already in progress, skipping...'); return; }
  processingInProgress = true;
  try {
    const memberId = extractMemberId();
    if (!memberId) { debug('⚠️ No member ID found, skipping processing'); processingInProgress = false; return; }
    if (memberId === currentMemberId) { debug('Same candidate, skipping...'); processingInProgress = false; return; }
    currentMemberId = memberId; debug('Processing candidate:', memberId);
    const checkResult = await checkCandidate(memberId);
    if (checkResult.exists) {
      const profileData = extractProfileData(memberId);
      injectProcessForm({ type: 'exists', candidate: checkResult.data, profileData });
    } else {
      const profileData = extractProfileData(memberId);
      if (profileData && profileData.full_name !== 'Unknown') {
        const addResult = await addCandidate(profileData);
        if (addResult.success) { injectProcessForm({ type: 'new', candidate: addResult.data, profileData }); }
        else { console.error('Failed to add candidate:', addResult.error); }
      } else { debug('⚠️ Could not extract profile data, skipping...'); }
    }
  } catch (error) { console.error('Error processing candidate:', error); }
  finally { processingInProgress = false; }
}

function setupUrlObserver() {
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) { debug('URL changed:', currentUrl); lastUrl = currentUrl; currentMemberId = null; setTimeout(() => { processCandidate(); }, 1500); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  debug('✅ URL observer setup complete');
}

function init() {
  debug('🚀 LinkedIn Candidate Tracker initialized');
  const isProfilePage = /linkedin\.com\/(talent|recruiter|in)\//.test(window.location.href);
  if (isProfilePage) { setTimeout(() => { processCandidate(); }, 1500); setupUrlObserver(); }
  else { debug('Not on a profile page, waiting for navigation...'); setupUrlObserver(); }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'recheck') { currentMemberId = null; processCandidate(); sendResponse({ success: true }); return true; }
  if (request.action === 'deleteCurrent') {
    const memberId = extractMemberId();
    if (!memberId) { sendResponse({ success: false, error: 'No member ID found' }); return true; }
    deleteCandidate(memberId).then(result => { sendResponse({ success: result.success, error: result.error }); });
    return true;
  }
});

function injectProcessForm({ type, candidate, profileData }) {
  const existingBanner = document.getElementById('linkedin-tracker-banner'); if (existingBanner) existingBanner.remove();
  const banner = document.createElement('div'); banner.id = 'linkedin-tracker-banner'; banner.className = type === 'exists' ? 'linkedin-tracker-banner-warning' : 'linkedin-tracker-banner-success';
  const processedDate = candidate?.created_at ? new Date(candidate.created_at).toLocaleDateString() : '';
  banner.innerHTML = `
    <div class="banner-content">
      <div class="banner-icon">${type === 'exists' ? '⚠️' : '✅'}</div>
      <div class="banner-text">
        <strong>${type === 'exists' ? 'Candidate Already Processed' : 'Candidate Added'}</strong>
        ${type === 'exists' && processedDate ? `<p>First processed on ${processedDate}</p>` : '<p>This candidate has been saved to the database</p>'}
        <div class="tracker-form">
          <label class="tracker-label">Processed By</label>
          <input type="text" id="tracker-processed-by" class="tracker-input" placeholder="hr@kushi.com" />
          <label class="tracker-label">Notes</label>
          <textarea id="tracker-notes" class="tracker-textarea" rows="3" placeholder="Add context (status, next steps, etc.)"></textarea>
          <div class="tracker-actions">
            <button id="tracker-save" class="tracker-button">Save to Database</button>
            ${type === 'exists' ? '<button id="tracker-delete" class="tracker-button tracker-button-danger" title="Remove this candidate">Delete Candidate</button>' : ''}
            <button id="close-banner" class="banner-close" title="Close">✕</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertBefore(banner, document.body.firstChild);
  const saveBtn = banner.querySelector('#tracker-save'); const closeBtn = banner.querySelector('#close-banner'); const deleteBtn = banner.querySelector('#tracker-delete');
  closeBtn?.addEventListener('click', () => banner.remove());
  saveBtn?.addEventListener('click', async () => {
    const processed_by = banner.querySelector('#tracker-processed-by')?.value.trim() || '';
    const notes = banner.querySelector('#tracker-notes')?.value.trim() || '';
    const payload = {
      member_id: profileData?.member_id || candidate?.member_id,
      full_name: profileData?.full_name || candidate?.full_name || 'Unknown',
      headline: profileData?.headline || candidate?.headline || '',
      location: profileData?.location || candidate?.location || '',
      current_company: profileData?.current_company || candidate?.current_company || '',
      profile_url: profileData?.profile_url || candidate?.profile_url || window.location.href.split('?')[0],
      processed_by: processed_by || null,
      notes: notes || null
    };
    saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
    const result = await addCandidate(payload);
    if (result.success) { saveBtn.textContent = 'Saved ✓'; setTimeout(() => banner.remove(), 1200); }
    else { saveBtn.disabled = false; saveBtn.textContent = 'Save to Database'; alert('Failed to save: ' + (result.error || 'Unknown error')); }
  });
  deleteBtn?.addEventListener('click', async () => {
    if (!candidate?.member_id) return alert('Missing candidate ID');
    const confirmDelete = confirm('Are you sure you want to delete this candidate from the database?');
    if (!confirmDelete) return;
    deleteBtn.disabled = true; deleteBtn.textContent = 'Deleting...';
    const result = await deleteCandidate(candidate.member_id);
    if (result.success) { deleteBtn.textContent = 'Deleted ✓'; setTimeout(() => { banner.remove(); currentMemberId = null; }, 1000); }
    else { deleteBtn.disabled = false; deleteBtn.textContent = 'Delete Candidate'; alert('Failed to delete: ' + (result.error || 'Unknown error')); }
  });
}

async function deleteCandidate(memberId) {
  try {
    const response = await fetch(`${API_BASE_URL}/candidates/${memberId}`, { method: 'DELETE' });
    if (response.status === 200) { debug('✅ Candidate deleted:', memberId); return { success: true }; }
    const data = await response.json().catch(() => ({})); debug('❌ Failed to delete candidate:', data); return { success: false, error: data.error || `HTTP ${response.status}` };
  } catch (error) { console.error('Error deleting candidate:', error); return { success: false, error: error.message }; }
}
