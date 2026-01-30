/**
 * LinkedIn Recruiter - Candidate Tracker Content Script (Google Sheets Version)
 * This script runs on LinkedIn Recruiter pages to track candidates using Google Sheets
 */

// Prevent script from running multiple times
if (typeof window.linkedInTrackerInitialized !== 'undefined') {
    console.log('[LinkedIn Tracker] Already initialized, skipping...');
} else {
    window.linkedInTrackerInitialized = true;

let currentMemberId = null;
let processingInProgress = false;
let googleSheetsDB = null;
let lastProcessTime = 0;
const MIN_PROCESS_INTERVAL = 1500; // Minimum 1.5 seconds between processing attempts

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

// Block malformed XHR requests
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (!url || typeof url !== 'string' || url === '/' || url === '' || url.includes('/invalid') || 
        url.includes('gf1jbqula7hip12fm2vbpbanv') || !url.startsWith('http')) {
        this._blockedRequest = true;
        return;
    }
    return originalOpen.apply(this, [method, url, ...args]);
};

const originalXHRSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(...args) {
    if (this._blockedRequest) {
        throw new Error('Request blocked');
    }
    return originalXHRSend.apply(this, args);
};

// Debug logging
const debug = (message, data = null) => {
    console.log(`[LinkedIn Tracker] ${message}`, data || '');
};

/**
 * Initialize Google Sheets DB with credentials
 */
async function initializeGoogleSheetsDB() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['googleSheetsConfig'], (result) => {
            if (result.googleSheetsConfig) {
                // Initialize the actual GoogleSheetsDB class
                googleSheetsDB = new GoogleSheetsDB();
                googleSheetsDB.credentials = result.googleSheetsConfig;
                debug('Google Sheets DB initialized with real class');
                resolve(true);
            } else {
                debug('⚠️ Google Sheets not configured');
                googleSheetsDB = null;
                resolve(false);
            }
        });
    });
}

/**
 * Extract LinkedIn Member ID from various URL patterns
 */
function extractMemberId() {
    try {
        const url = window.location.href;
        debug('Current URL:', url);

        const profileIdParam = new URL(url).searchParams.get('profileId');
        if (profileIdParam) {
            return profileIdParam;
        }

        const talentMatch = url.match(/linkedin\.com\/talent\/profile\/([^/?]+)/i);
        if (talentMatch && talentMatch[1]) {
            return talentMatch[1];
        }

        const hireMatch = url.match(/linkedin\.com\/recruiter\/profile\/([^/?]+)/i);
        if (hireMatch && hireMatch[1]) {
            return hireMatch[1];
        }

        const profileMatch = url.match(/linkedin\.com\/in\/([^/?]+)/i);
        if (profileMatch && profileMatch[1]) {
            return profileMatch[1];
        }

        const profileElement = document.querySelector('[data-member-id]');
        if (profileElement) {
            return profileElement.getAttribute('data-member-id');
        }

        debug('⚠️ Could not extract member ID from URL');
        return null;
    } catch (error) {
        console.error('Error extracting member ID:', error);
        return null;
    }
}

/**
 * Extract candidate profile data from LinkedIn page
 * Enhanced with better selectors and fallback logic
 */
function extractProfileData(memberId) {
    try {
        const getMeta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') || '';
        const getMeta2 = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';

        // ============================================
        // IMPROVED NAME EXTRACTION
        // ============================================
        const nameSelectors = [
            // Priority 1: Direct headline h1 selectors (most reliable)
            'h1.text-heading-xlarge',
            'div.pv-text-details__left-panel h1',
            'h1.profile-topcard__name',
            'h1.t-24',
            '.artdeco-entity-lockup__title',
            '[data-test-profile-name]',
            '.ph5 h1',
            
            // Priority 2: Details page layouts
            '.pv-top-card h1',
            '.scaffold-layout__detail h1',
            '.artdeco-card h1',
            '.scaffold-layout__detail .artdeco-entity-lockup__title span',
            '.pv-profile-card__anchor span.t-bold',
            '.scaffold-layout__detail header h1',
            '[class*="profile-card"] h3',
            
            // Priority 3: Recruiter view layouts
            '.profile-topcard__title',
            'span.pv-entity__subtitle',
            'span.text-heading-medium',
            
            // Priority 4: Title-like headers
            '.profile-title',
            '.profile-name'
        ];

        let fullName = '';
        for (const selector of nameSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                // Skip if it looks like a company name or generic text
                if (text && text.length > 1 && !/(linkedin|experience|education|skills|company|pending|message|follow|endorsement)/i.test(text)) {
                    fullName = text;
                    break;
                }
            }
        }
        
        // Fallback: try to get name from profile links
        if (!fullName) {
            const profileLinks = document.querySelectorAll('a[href*="/in/"] span.t-bold, .scaffold-layout__detail a span.t-bold');
            for (const link of profileLinks) {
                const text = link.textContent.trim();
                if (text && text.length > 1 && !/(linkedin|experience|education)/i.test(text)) {
                    fullName = text;
                    break;
                }
            }
        }

        // Fallback: extract from meta tags
        if (!fullName) {
            const ogTitle = getMeta('og:title') || '';
            const twitterTitle = getMeta('twitter:title') || '';
            const pageTitle = document.title || '';
            const metaDescription = getMeta2('description') || '';
            
            // Try og:title first (usually cleaner)
            let titleMatch = ogTitle.match(/^([^|–\-\(\)]+)/);
            if (titleMatch) {
                const extracted = titleMatch[1].trim();
                // Skip if it's a LinkedIn tab title
                if (extracted && extracted.length > 1 && !/(^\(\d+\)\s*)?linkedin$/i.test(extracted)) {
                    fullName = extracted;
                }
            }
            
            // Try twitter title
            if (!fullName) {
                titleMatch = twitterTitle.match(/^([^|–\-\(\)]+)/);
                if (titleMatch) {
                    const extracted = titleMatch[1].trim();
                    if (extracted && extracted.length > 1 && !/(^\(\d+\)\s*)?linkedin$/i.test(extracted)) {
                        fullName = extracted;
                    }
                }
            }
            
            // Try page title but exclude LinkedIn patterns
            if (!fullName) {
                titleMatch = pageTitle.match(/^([^|–\-\(\)]+)/);
                if (titleMatch) {
                    const extracted = titleMatch[1].trim();
                    if (extracted && extracted.length > 1 && !/(^\(\d+\)\s*)?linkedin$/i.test(extracted) && !extracted.toLowerCase().includes('linkedin')) {
                        fullName = extracted;
                    }
                }
            }
            
            // Last resort: extract first and last name from meta description if available
            if (!fullName && metaDescription) {
                const nameMatch = metaDescription.match(/^([^|–\-]+?)\s+(?:is|at|works|current)/i);
                if (nameMatch) {
                    fullName = nameMatch[1].trim();
                }
            }
            
            if (!fullName) fullName = 'Unknown Candidate';
        }
        
        debug('Extracted name:', fullName);

        // ============================================
        // IMPROVED HEADLINE EXTRACTION
        // ============================================
        const headlineSelectors = [
            // Priority 1: Current role/position selectors
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '[data-test-profile-headline]',
            
            // Priority 2: Details page layouts
            '.artdeco-entity-lockup__subtitle',
            '.pv-top-card .text-body-medium',
            '.pv-text-details__headline',
            
            // Priority 3: Alternative layouts
            'span.text-body-medium',
            '.headline',
            '[class*="headline"]',
            
            // Priority 4: Experience section (current role)
            '.pvs-entity__headline span[aria-hidden="true"]',
            '.profile-card-headline'
        ];
        
        let headline = '';
        for (const selector of headlineSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                // Filter out navigation items and metadata
                if (text && text.length > 3 && !/(message|follow|more|endorsement|connection|save|report|view)/i.test(text)) {
                    headline = text;
                    break;
                }
            }
        }
        
        // Fallback: extract from meta tags
        if (!headline) {
            const ogDescription = getMeta('og:description') || '';
            const twitterDescription = getMeta('twitter:description') || '';
            const metaDescription = getMeta2('description') || '';
            
            // Try og:description (usually contains "Job Title at Company")
            if (ogDescription && !ogDescription.toLowerCase().includes('view') && !ogDescription.toLowerCase().includes('profile')) {
                const firstSentence = ogDescription.split(/[.!?]/)[0].trim();
                if (firstSentence.length > 3) {
                    headline = firstSentence;
                }
            }
            
            // Try twitter description
            if (!headline && twitterDescription && !twitterDescription.toLowerCase().includes('profile')) {
                const firstSentence = twitterDescription.split(/[.!?]/)[0].trim();
                if (firstSentence.length > 3) {
                    headline = firstSentence;
                }
            }
            
            // Try meta description
            if (!headline && metaDescription) {
                const firstSentence = metaDescription.split(/[.!?]/)[0].trim();
                if (firstSentence.length > 3 && !/(view|profile|view more)/i.test(firstSentence)) {
                    headline = firstSentence;
                }
            }
        }
        
        debug('Extracted headline:', headline);

        // ============================================
        // IMPROVED LOCATION EXTRACTION
        // ============================================
        const locationSelectors = [
            // Priority 1: Direct location spans
            'span.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small:not(.break-words)',
            '[data-test-profile-location]',
            
            // Priority 2: Top card locations
            '.pv-top-card .text-body-small',
            '.profile-topcard__location',
            '.artdeco-entity-lockup__caption',
            
            // Priority 3: Alternative layouts
            'span[data-test-profile-location]',
            '.profile-location',
            '[class*="location"]',
            
            // Priority 4: Text nodes in profile header
            '.pv-text-details__left-panel span.text-body-small'
        ];
        
        let location = '';
        for (const selector of locationSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                // Filter out metadata and navigation
                if (text && text.length > 2 && !/(·|•|follower|connection|following|save|message|more)/i.test(text)) {
                    location = text;
                    break;
                }
            }
        }
        
        // Fallback: extract city and country from meta tags
        if (!location) {
            // LinkedIn's og:image URL sometimes contains location info
            const ogImage = getMeta('og:image') || '';
            // Try to extract from HTML structured data if available
            const locationScript = document.querySelector('script[type="application/ld+json"]');
            if (locationScript) {
                try {
                    const jsonLD = JSON.parse(locationScript.textContent);
                    if (jsonLD.jobTitle && jsonLD.areaServed) {
                        location = jsonLD.areaServed;
                    }
                } catch (e) {
                    // Silent fail
                }
            }
        }
        
        debug('Extracted location:', location);

        const currentCompany = extractCurrentCompany();

        // Try to extract latest experience (designation + company) from Experience section
        const exp = extractLatestExperience();

        // Try to extract latest education and passout year from Education section
        const edu = extractLatestEducation();

        // Extract new fields for enhanced candidate assessment
        const skills = extractTopSkills();
        const industry = extractIndustry();
        const connections = extractConnectionCount();

        // Get clean profile URL (remove /details/experience or other sub-pages)
        let profileUrl = window.location.href.split('?')[0];
        // If we're on a details sub-page, extract the main profile URL
        const detailsMatch = profileUrl.match(/(https?:\/\/[^/]+\/in\/[^/]+)/);
        if (detailsMatch) {
            profileUrl = detailsMatch[1] + '/';
        }
        
        const profileData = {
            // ===== CORE INFORMATION =====
            member_id: memberId,
            full_name: fullName || 'Unknown',
            profile_url: profileUrl,
            
            // ===== CURRENT POSITION & COMPANY =====
            headline: headline || '',
            // Designation from Experience section (company name)
            designation: exp.company || currentCompany || '',
            // Current job title from Experience section
            current_company: exp.title || '',
            industry: industry || '',
            
            // ===== LOCATION =====
            location: location || '',
            
            // ===== EDUCATION =====
            passout: edu.passout || '',
            qualification: edu.qualification || '',
            education: edu.education || '',
            
            // ===== EXPERIENCE =====
            years_at_current: exp.yearsAtCurrent || '',
            total_years_experience: exp.totalYears || '',
            
            // ===== NEW FIELDS - SKILLS & NETWORK =====
            top_skills: skills || [],
            top_skills_string: skills.join(', ') || '', // For easy display in sheets
            connections: connections || '',
            
            // ===== METADATA =====
            extracted_at: new Date().toISOString(),
            extracted_date: new Date().toLocaleDateString()
        };

        debug('Extracted profile data:', profileData);
        return profileData;
    } catch (error) {
        console.error('Error extracting profile data:', error);
        return null;
    }
}

/**
 * Extract latest experience item (designation + company) from Experience section
 */
function extractLatestExperience() {
    try {
        let section = null;
        const url = window.location.href;
        
        // Check if we're on the experience details page
        const isDetailsPage = url.includes('/details/experience');
        
        if (isDetailsPage) {
            // On details page, the main content area IS the experience section
            section = document.querySelector('.scaffold-layout__main, main, .pvs-list__container');
            if (!section) {
                section = document.querySelector('[class*="scaffold"]') || document.body;
            }
            debug('On experience details page, using main content as section');
        } else {
            // On main profile page, find the Experience section
            const anchor = document.querySelector('#experience');
            section = anchor ? anchor.closest('section') : null;
            if (!section) {
                // Fallback: find a section that contains the word "Experience"
                section = Array.from(document.querySelectorAll('section')).find(sec => {
                    const header = sec.querySelector('h2, .pvs-header__title');
                    return header && /experience/i.test(header.textContent || '');
                }) || null;
            }
        }
        
        if (!section) {
            debug('Could not find experience section');
            return { title: '', company: '', yearsAtCurrent: '', totalYears: '' };
        }

        // Find first experience entity - try multiple selectors for different page layouts
        let entity = section.querySelector('[data-view-name="profile-component-entity"]');
        if (!entity) {
            entity = section.querySelector('.pvs-list__paged-list-item .pvs-entity');
        }
        if (!entity) {
            entity = section.querySelector('li.artdeco-list__item');
        }
        if (!entity) {
            entity = section.querySelector('.pvs-entity');
        }
        if (!entity) {
            // On details page, the first list item with experience data
            entity = section.querySelector('.pvs-list > li, ul > li.pvs-list__item--line-separated');
        }
        
        if (!entity) {
            debug('Could not find any experience entity');
            return { title: '', company: '', yearsAtCurrent: '', totalYears: '' };
        }
        
        debug('Found experience entity:', entity.innerText?.substring(0, 100));

        // Use dedicated helpers for robust extraction
        const title = extractTitleFromEntity(entity);
        const company = extractCompanyFromEntity(entity);

        // Extract years at current company (from first/current role, not company total)
        const yearsAtCurrent = extractCurrentRoleDuration(entity);
        
        // Calculate total years of experience from all positions
        const totalYears = calculateTotalExperience(section);
        console.log('[extractLatestExperience] totalYears calculated:', totalYears);

        return { title, company, yearsAtCurrent, totalYears };
    } catch (_) {
        return { title: '', company: '', yearsAtCurrent: '', totalYears: '' };
    }
}

/**
 * Extract designation/title robustly from an experience entity
 */
function extractTitleFromEntity(entity) {
    try {
        const EMPLOYMENT_TYPES = /full[- ]?time|part[- ]?time|self[- ]?employed|contract|internship|intern|apprentice|trainee/i;
        const DURATION = /(\d+\s*(?:yr|yrs|year|years|mo|mos|month|months))/i;
        const isLikelyCompany = /private limited|pvt|inc\.?|llc|llp|ltd/i;

        const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();
        const isValidTitle = (text, companyHint = '') => {
            const cleaned = clean(text);
            if (!cleaned) return false;
            if (EMPLOYMENT_TYPES.test(cleaned) || DURATION.test(cleaned)) return false;
            if (isLikelyCompany.test(cleaned)) return false;
            if (companyHint && cleaned.toLowerCase() === clean(companyHint).toLowerCase()) return false;
            return true;
        };

        const companyHint = extractCompanyFromEntity(entity);

        // 1) Look for title in the pvs-entity__title specifically (main job title)
        const titleEl = entity.querySelector('.pvs-entity__title span[aria-hidden="true"]');
        if (isValidTitle(titleEl?.innerText, companyHint)) return clean(titleEl.innerText);

        // 2) New: role title inside position group role item (multi-role experiences)
        const roleTitle = entity.querySelector('.pvs-entity__position-group-role-item__title span[aria-hidden="true"]');
        if (isValidTitle(roleTitle?.innerText, companyHint)) return clean(roleTitle.innerText);

        // 3) Try any bold text at the top of the entity
        const boldText = entity.querySelector('.t-bold')?.innerText;
        if (isValidTitle(boldText, companyHint)) return clean(boldText);

        // 4) Try first h3/h4 heading
        const heading = entity.querySelector('h3, h4')?.innerText;
        if (isValidTitle(heading, companyHint)) return clean(heading);

        // 5) Fallback: parse visible lines and pick the first that looks like a role (not company)
        const textLineTitle = extractTitleFromLines(entity, companyHint, { EMPLOYMENT_TYPES, DURATION });
        if (textLineTitle) return textLineTitle;

        return '';
    } catch (_) {
        return '';
    }
}

// Fallback helper to pick a plausible title from innerText lines
function extractTitleFromLines(entity, companyHint = '', patterns = {}) {
    const { EMPLOYMENT_TYPES = /full[- ]?time|part[- ]?time|self[- ]?employed|contract|internship|intern|apprentice|trainee/i, DURATION = /(\d+\s*(?:yr|yrs|year|years|mo|mos|month|months))/i } = patterns;
    const BAD_WORDS = /present|location|remote|hybrid|on-site|onsite/i;

    const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const normCompany = clean(companyHint).toLowerCase();

    const lines = (entity.innerText || '')
        .split('\n')
        .map(clean)
        .filter(Boolean);

    for (const line of lines) {
        const lower = line.toLowerCase();
        if (normCompany && lower === normCompany) continue;
        if (EMPLOYMENT_TYPES.test(line) || DURATION.test(line) || BAD_WORDS.test(line)) continue;
        // Skip date-like or duration-like strings
        if (/\b\d{4}\b/.test(line) || /present/i.test(line)) continue;
        // Likely a role if it contains verbs or seniority keywords
        if (/(engineer|manager|lead|director|architect|developer|designer|analyst|consultant|specialist|head|officer)/i.test(line)) return line;
        // Otherwise, pick the first acceptable non-company text
        if (!/company|education/i.test(line)) return line;
    }

    return '';
}

/**
 * Extract company name robustly from an experience entity
 * Avoids picking employment type (e.g., "Full-time")
 */
function extractCompanyFromEntity(entity) {
    try {
        const EMPLOYMENT_TYPES = /full[- ]?time|part[- ]?time|self[- ]?employed|contract|internship|freelance|temporary|apprenticeship|trainee/i;
        const SKIP_WORDS = /^(at|location)$/i;

        // 1) Look for company link (href contains company) in subtitle - BEST SOURCE
        const companyLinkInSub = entity.querySelector('.pvs-entity__subtitle a[href*="company"] span[aria-hidden="true"]');
        if (companyLinkInSub) {
            const text = companyLinkInSub.innerText?.trim();
            if (text && !EMPLOYMENT_TYPES.test(text) && !SKIP_WORDS.test(text) && text.length > 1) {
                return text;
            }
        }

        // 2) The subtitle container has the company name (second line)
        // Look for all text in subtitle and find the company (first non-employment-type text)
        const sub = entity.querySelector('.pvs-entity__subtitle');
        if (sub) {
            const allText = sub.innerText?.trim() || '';
            // Split by bullet point or dash to get individual parts
            const parts = allText.split(/[•·\-]/).map(p => p.trim()).filter(Boolean);
            
            for (const part of parts) {
                // Skip employment types and duration patterns
                if (!EMPLOYMENT_TYPES.test(part) && 
                    !/\d+\s*(yr|yrs|mo|mos|month|months|year|years)/i.test(part) &&
                    !/^(at|location)$/i.test(part) &&
                    part.length > 1) {
                    return part; // Return first valid part (usually company name)
                }
            }
        }

        // 3) If no link found, try getting text from spans directly
        const sub2 = entity.querySelector('.pvs-entity__subtitle');
        if (sub2) {
            const spans = Array.from(sub2.querySelectorAll('span[aria-hidden="true"]'))
                .map(s => s.innerText?.trim())
                .filter(t => t && t.length > 1);
            
            // Find first span that isn't employment type
            const company = spans.find(t => 
                !EMPLOYMENT_TYPES.test(t) && 
                !/\d+\s*(yr|yrs|mo|mos|month|months|year|years)/i.test(t) &&
                !/present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}/i.test(t)
            );
            if (company) return company;
        }

        return '';
    } catch (_) {
        return '';
    }
}

/**
 * Extract duration from a single experience entity
 */
function extractDurationFromEntity(entity) {
    try {
        // Look for duration text in caption wrapper (e.g., "Sep 2025 - Present · 5 mos")
        const captionWrappers = entity.querySelectorAll('.pvs-entity__caption-wrapper, span.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        
        for (const wrapper of captionWrappers) {
            const text = wrapper.innerText?.trim() || '';
            
            // Match patterns like "5 mos", "2 yrs", "1 yr 3 mos", "2 yrs 6 mos"
            // More flexible regex to catch variations
            const yearsMatch = text.match(/(\d+)\s*y(?:ears?|rs?)/i);
            const monthsMatch = text.match(/(\d+)\s*m(?:onths?|os?)/i);
            
            if (yearsMatch || monthsMatch) {
                const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
                const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
                return formatDuration(years, months);
            }
        }
        
        // Fallback: check innerText lines for duration pattern
        const lines = (entity.innerText || '').split('\n').map(t => t.trim());
        for (const line of lines) {
            const yearsMatch = line.match(/(\d+)\s*y(?:ears?|rs?)/i);
            const monthsMatch = line.match(/(\d+)\s*m(?:onths?|os?)/i);
            
            if (yearsMatch || monthsMatch) {
                const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
                const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
                return formatDuration(years, months);
            }
        }
        
        return '';
    } catch (_) {
        return '';
    }
}

/**
 * Extract duration from the current role (not company total)
 * For multi-role companies, finds the first role with "Present"
 */
function extractCurrentRoleDuration(entity) {
    try {
        const allText = entity.innerText || '';
        
        // Check if this is a multi-role entry (has nested roles)
        const nestedRoles = entity.querySelectorAll('.pvs-entity__sub-components .pvs-entity, .pvs-list__paged-list-item .pvs-entity');
        
        if (nestedRoles.length > 0) {
            // Multi-role company: find the role with "Present"
            for (const role of nestedRoles) {
                const roleText = role.innerText || '';
                if (/present/i.test(roleText)) {
                    // Extract duration from this current role
                    return extractDurationFromEntity(role);
                }
            }
            // Fallback: return first role's duration
            return extractDurationFromEntity(nestedRoles[0]);
        } else {
            // Single role: extract duration normally
            return extractDurationFromEntity(entity);
        }
    } catch (_) {
        return '';
    }
}

/**
 * Calculate total years of experience from all experience entries
 */
function calculateTotalExperience(section) {
    try {
        let totalMonths = 0;
        const processedDurations = new Set(); // Track what we've already counted
        
        // Find all top-level list items in the experience section
        // Try multiple selectors for different page layouts
        let topLevelItems = section.querySelectorAll(':scope > div > ul > li.artdeco-list__item');
        
        // Fallback selectors for different page structures
        if (topLevelItems.length === 0) {
            topLevelItems = section.querySelectorAll('.pvs-list__paged-list-item');
        }
        if (topLevelItems.length === 0) {
            topLevelItems = section.querySelectorAll('li.artdeco-list__item');
        }
        if (topLevelItems.length === 0) {
            // Experience details page: each experience is a list item
            topLevelItems = section.querySelectorAll('.pvs-list > li, ul > li.pvs-list__item--line-separated');
        }
        
        console.log('[calculateTotalExperience] Found', topLevelItems.length, 'top-level items');
        
        for (const item of topLevelItems) {
            // Look for the FIRST duration text in this top-level item
            // This will be the company-level duration for multi-role entries
            // or the single role duration for single-role entries
            const allText = item.innerText || '';
            
            // Skip internships and part-time jobs
            // Only skip if it's explicitly marked as internship employment type, not just because title contains "trainee"
            const isInternship = /\b(internship)\s*[·•\-]|\bemployment type:\s*internship/i.test(allText) ||
                                 /\bintern\s*[·•\-]/i.test(allText); // "Intern · 2 mos" pattern
            const isPartTime = /\bpart[- ]?time\s*[·•\-]/i.test(allText);
            
            if (isInternship || isPartTime) {
                console.log('[calculateTotalExperience] Skipping internship/part-time:', allText.substring(0, 50));
                continue; // Skip this entry
            }
            
            // Find the first occurrence of duration pattern
            const durationPattern = /(\d+)\s*y(?:ears?|rs?)?\s*(?:(\d+)\s*m(?:onths?|os?)?)?|(\d+)\s*m(?:onths?|os?)/i;
            const match = allText.match(durationPattern);
            
            if (match) {
                let years = 0;
                let months = 0;
                
                if (match[1]) {
                    // Pattern like "2 yrs 8 mos" or "2 yrs"
                    years = parseInt(match[1], 10);
                    months = match[2] ? parseInt(match[2], 10) : 0;
                } else if (match[3]) {
                    // Pattern like "8 mos" only
                    months = parseInt(match[3], 10);
                }
                
                // Create a unique identifier for this duration to avoid duplicates
                const durationKey = `${years}-${months}`;
                const position = allText.indexOf(match[0]);
                const uniqueKey = `${durationKey}-${position}`;
                
                if (!processedDurations.has(uniqueKey)) {
                    totalMonths += (years * 12) + months;
                    processedDurations.add(uniqueKey);
                    console.log('[calculateTotalExperience] Added:', years, 'yrs', months, 'mos. Total:', totalMonths, 'months');
                }
            }
        }
        
        console.log('[calculateTotalExperience] Final totalMonths:', totalMonths);
        
        if (totalMonths === 0) return '';
        
        const totalYears = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        const result = formatDuration(totalYears, remainingMonths);
        console.log('[calculateTotalExperience] Returning:', result);
        return result;
    } catch (e) {
        console.error('Error calculating total experience:', e);
        return '';
    }
}

/**
 * Format duration as "X yrs Y mos" or "X yrs" or "Y mos"
 */
function formatDuration(years, months) {
    if (years > 0 && months > 0) {
        return `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
    } else if (years > 0) {
        return `${years} yr${years > 1 ? 's' : ''}`;
    } else if (months > 0) {
        return `${months} mo${months > 1 ? 's' : ''}`;
    }
    return '';
}

/**
 * Extract latest education and passout year from Education section
 */
function extractLatestEducation() {
    try {
        const anchor = document.querySelector('#education');
        let section = anchor ? anchor.closest('section') : null;
        if (!section) {
            section = Array.from(document.querySelectorAll('section')).find(sec => /education/i.test(sec.textContent || '')) || null;
        }
        if (!section) return { education: '', passout: '', qualification: '' };

        const entity = section.querySelector('[data-view-name="profile-component-entity"], li.artdeco-list__item, .pvs-entity');
        if (!entity) return { education: '', passout: '', qualification: '' };

        let school = '';
        let degree = '';
        let passout = '';
        let qualification = '';

        // Try to get school name from the first link or bold text
        const schoolEl = entity.querySelector('a span[aria-hidden="true"], .t-bold span[aria-hidden="true"], a.optional-action-target-wrapper span');
        school = schoolEl?.innerText?.trim() || '';

        // Try to get degree from span with aria-hidden inside t-14 t-normal
        const degreeSpans = entity.querySelectorAll('span.t-14.t-normal span[aria-hidden="true"]');
        for (const span of degreeSpans) {
            const text = span.innerText?.trim() || '';
            // Check if this looks like a degree (contains Bachelor, Master, B.E, etc.)
            if (/bachelor|master|b\.?e\b|b\.?tech|m\.?tech|m\.?e\b|engineering|diploma|mba|mca|bca|b\.?sc|m\.?sc/i.test(text)) {
                degree = text;
                break;
            }
        }

        // Fallback: try innerText parsing
        if (!degree || !school) {
            const lines = (entity.innerText || '')
                .split('\n')
                .map(t => t.trim())
                .filter(Boolean);
            
            if (!school && lines.length) school = lines[0];
            
            if (!degree) {
                const degreePatterns = /bachelor|master|b\.?tech|b\.?e\b|m\.?tech|m\.?e\b|b\.?sc|m\.?sc|mba|mca|bca|ph\.?d|diploma|b\.?com|m\.?com|b\.?a\b|m\.?a\b|engineering|intermediate/i;
                degree = lines.find(l => degreePatterns.test(l)) || lines[1] || '';
            }
        }

        // Extract passout year from date spans
        const dateSpans = entity.querySelectorAll('span.t-14.t-normal.t-black--light span[aria-hidden="true"], span.pvs-entity__caption-wrapper');
        for (const span of dateSpans) {
            const text = span.innerText?.trim() || '';
            // Look for year range pattern like "2019 - 2023" or single year like "2023"
            const yearRangeMatch = text.match(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/);
            if (yearRangeMatch) {
                const years = text.match(/\b(19|20)\d{2}\b/g) || [];
                passout = years.length ? years[years.length - 1] : '';
                break;
            }
            // Also check for single year (no range)
            const singleYearMatch = text.match(/\b(19|20)\d{2}\b/);
            if (singleYearMatch && !/\d{6}/.test(text)) { // Avoid postal codes
                passout = singleYearMatch[0];
                break;
            }
        }

        // Fallback for passout from innerText
        if (!passout) {
            const lines = (entity.innerText || '').split('\n').map(t => t.trim()).filter(Boolean);
            // First try to find year range
            let dateLine = lines.find(l => {
                const hasYearRange = /\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/.test(l);
                const looksLikeAddress = /\b\d{6}\b/.test(l);
                return hasYearRange && !looksLikeAddress;
            });
            
            if (dateLine) {
                const yearMatches = dateLine.match(/\b(19|20)\d{2}\b/g) || [];
                passout = yearMatches.length ? yearMatches[yearMatches.length - 1] : '';
            } else {
                // Try to find single year (not postal code)
                dateLine = lines.find(l => /\b(19|20)\d{2}\b/.test(l) && !/\d{6}/.test(l));
                if (dateLine) {
                    const yearMatch = dateLine.match(/\b(19|20)\d{2}\b/);
                    passout = yearMatch ? yearMatch[0] : '';
                }
            }
        }

        // Extract qualification from degree text
        // Pattern: "Bachelor of Engineering - BE, Electrical..." → extract "BE"
        const degreeText = degree || '';
        
        // First try to find abbreviation after hyphen: "Bachelor of Engineering - BE"
        const afterHyphen = degreeText.match(/[-–]\s*(B\.?E\.?|B\.?Tech|M\.?Tech|M\.?E\.?|MBA|MCA|BCA|B\.?Sc|M\.?Sc|B\.?Com|M\.?Com|BA|MA|Ph\.?D|BBA|Diploma)\b/i);
        if (afterHyphen) {
            qualification = afterHyphen[1].replace(/\./g, '').toUpperCase();
        } else {
            // Try to find standalone abbreviation
            const qualMatch = degreeText.match(/\b(B\.?E\.?|B\.?Tech|B\.?Sc|M\.?Tech|M\.?E\.?|M\.?Sc|MBA|MCA|BCA|Ph\.?D|B\.?Com|M\.?Com|BA|MA|B\.?Arch|LLB|LLM|MBBS|MD|BBA|Intermediate|Diploma)\b/i);
            if (qualMatch) {
                qualification = qualMatch[1].replace(/\./g, '').toUpperCase();
            } else if (degreeText.toLowerCase().includes('bachelor')) {
                if (/engineering/i.test(degreeText)) qualification = 'BE';
                else if (/technology/i.test(degreeText)) qualification = 'BTECH';
                else if (/science/i.test(degreeText)) qualification = 'BSC';
                else if (/commerce/i.test(degreeText)) qualification = 'BCOM';
                else if (/arts/i.test(degreeText)) qualification = 'BA';
            } else if (degreeText.toLowerCase().includes('master')) {
                if (/engineering/i.test(degreeText)) qualification = 'ME';
                else if (/technology/i.test(degreeText)) qualification = 'MTECH';
                else if (/science/i.test(degreeText)) qualification = 'MSC';
                else if (/business/i.test(degreeText)) qualification = 'MBA';
            }
        }

        const education = degree ? `${degree} @ ${school}` : school;
        return { education, passout, qualification };
    } catch (_) {
        return { education: '', passout: '', qualification: '' };
    }
}

/**
 * Extract top 5 skills from profile
 */
function extractTopSkills() {
    try {
        const skills = [];
        const skillSelectors = [
            // Priority 1: Skill endorsements section
            '[data-test-profile-skill-item] span[aria-hidden="true"]',
            '.pv-skill-category-entity__name',
            '[data-test-skill]',
            
            // Priority 2: Skills section items
            '.artdeco-list__item .artdeco-entity-lockup__title',
            '.pvs-list__item--line-separated .artdeco-entity-lockup__title',
            
            // Priority 3: Any skill badges
            '.skill-badge',
            '[class*="skill"]',
            
            // Priority 4: Text in skills section
            '.pv-skill span[aria-hidden="true"]'
        ];

        // Find the skills section
        let skillsSection = document.querySelector('#skills');
        if (!skillsSection) {
            skillsSection = Array.from(document.querySelectorAll('section')).find(sec => 
                /skills/i.test(sec.querySelector('h2')?.textContent || '')
            );
        }

        if (!skillsSection) {
            skillsSection = document.body;
        }

        // Extract skills from various selectors
        const skillElements = skillsSection.querySelectorAll('[data-test-profile-skill-item] span[aria-hidden="true"], .pv-skill-category-entity__name');
        for (const el of skillElements) {
            if (skills.length >= 5) break;
            const skillText = el.textContent.trim();
            if (skillText && skillText.length > 1 && !/(endorse|pending|remove|skill)/i.test(skillText)) {
                skills.push(skillText);
            }
        }

        // If not enough skills, try alternative selectors
        if (skills.length < 5) {
            const altElements = skillsSection.querySelectorAll('[class*="skill-item"], .skill-badge, span.skill-text');
            for (const el of altElements) {
                if (skills.length >= 5) break;
                const skillText = el.textContent.trim();
                if (skillText && skillText.length > 1 && !skills.includes(skillText)) {
                    skills.push(skillText);
                }
            }
        }

        debug('Extracted skills:', skills);
        return skills.slice(0, 5); // Return only top 5
    } catch (error) {
        debug('Error extracting skills:', error);
        return [];
    }
}

/**
 * Extract industry from profile
 */
function extractIndustry() {
    try {
        // Check if there's an industry field on the profile
        const industrySelectors = [
            '[data-test-profile-industry]',
            '.pv-about-section .text-body-small',
            '.profile-industry',
            'span[aria-label*="industry"]',
            '[class*="industry"]'
        ];

        for (const selector of industrySelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                if (text && text.length > 2 && !/industry|profile|about/i.test(text)) {
                    return text;
                }
            }
        }

        // Fallback: extract from headline or current company
        const headline = document.querySelector('[data-test-profile-headline]')?.textContent || '';
        const industryMatch = headline.match(/(?:in|at|with)\s+([A-Za-z\s&]+)(?:\s+industry|\s+field)?/i);
        if (industryMatch) {
            return industryMatch[1].trim();
        }

        return '';
    } catch (error) {
        debug('Error extracting industry:', error);
        return '';
    }
}

/**
 * Extract connection count from profile
 */
function extractConnectionCount() {
    try {
        const connectionSelectors = [
            '[data-test-profile-connection-count]',
            '.pv-text-details__left-panel .text-body-small:contains("connection")',
            'span[aria-label*="connection"]',
            'span.t-14.t-normal.t-black--light:contains("+")'
        ];

        // Try regex search in visible text
        const allText = document.body.innerText;
        const connectionMatch = allText.match(/(\d+(?:,\d+)?|\d+[KM])\s*(?:connection|follower)/i);
        if (connectionMatch) {
            return connectionMatch[1];
        }

        // Try to find connection count in common locations
        const connectionElements = document.querySelectorAll('span.t-14, .text-body-small, [class*="connection"]');
        for (const el of connectionElements) {
            const text = el.textContent;
            if (/^\d+(?:,\d+)?|\d+[KM]\s*(?:connection)/i.test(text)) {
                const match = text.match(/(\d+(?:,\d+)?|\d+[KM])/);
                if (match) return match[1];
            }
        }

        return '';
    } catch (error) {
        debug('Error extracting connection count:', error);
        return '';
    }
}

/**
 * Extract current company from profile
 */
function extractCurrentCompany() {
    const companySelectors = [
        '.profile-topcard__company-link',
        '[data-test-profile-company]',
        '.pv-top-card--experience-list-item .t-14',
        'a[href*="company"] span[aria-hidden="true"]'
    ];

    for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
            const text = el.textContent.trim();
            // Avoid employment types
            if (text && text.length > 2 && !/full[- ]?time|part[- ]?time|contract|intern/i.test(text)) {
                return text;
            }
        }
    }

    return '';
}

/**
 * Check if candidate exists
 */
async function checkCandidate(memberId) {
    try {
        if (!googleSheetsDB) {
            return { exists: false, requiresSetup: true };
        }
        
        if (!googleSheetsDB.credentials || !googleSheetsDB.credentials.private_key) {
            return { exists: false, requiresSetup: true };
        }

        const result = await googleSheetsDB.candidateExists(memberId);
        return { exists: result.exists, processedBy: result.processedBy };
    } catch (error) {
        console.error('Error checking candidate:', error);
        return { exists: false, error: error.message };
    }
}

/**
 * Add candidate to Google Sheets
 */
async function addCandidate(profileData) {
    try {
        if (!googleSheetsDB || !googleSheetsDB.credentials.private_key) {
            throw new Error('Google Sheets API not configured. Click the extension icon to configure.');
        }

        const result = await googleSheetsDB.addCandidate(profileData);
        
        if (result.success) {
            debug('✅ Candidate added:', profileData.full_name);
            return { success: true, data: profileData };
        } else {
            console.error('Failed to add candidate:', result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('Error adding candidate:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Inject banner and form
 */
function injectProcessForm({ type, profileData, processedBy }) {
    const existingBanner = document.getElementById('linkedin-tracker-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'linkedin-tracker-banner';
    banner.className = type === 'exists' ? 'linkedin-tracker-banner-warning' : 'linkedin-tracker-banner-success';

    const processedByText = processedBy ? `Already processed by <strong>${processedBy}</strong>` : 'This candidate is already in your Google Sheet';

    banner.innerHTML = `
        <div class="banner-content">
            <div class="banner-icon">${type === 'exists' ? '⚠️' : '✅'}</div>
            <div class="banner-text">
                <strong>${type === 'exists' ? 'Candidate Already Tracked' : 'Candidate Added to Sheet'}</strong>
                <p>
                    ${type === 'exists' 
                        ? processedByText 
                        : 'This candidate has been added to your Google Sheet'}
                </p>
                <div class="tracker-form">
                    <label class="tracker-label">Your Name / Email</label>
                    <input type="text" id="tracker-processed-by" class="tracker-input" placeholder="Your name" />
                    ${type === 'new' ? `
                    <label class="tracker-label">Company Name (Optional)</label>
                    <textarea id="tracker-company" class="tracker-textarea" placeholder="Company name">${profileData.current_company || ''}</textarea>
                    <label class="tracker-label">Years at Current Company (Optional)</label>
                    <input type="text" id="tracker-years-current" class="tracker-input" placeholder="e.g., 2 yrs 6 mos" value="${profileData.years_at_current || ''}" />
                    <label class="tracker-label">Total Years of Experience (Optional)</label>
                    <input type="text" id="tracker-total-years" class="tracker-input" placeholder="e.g., 5 yrs 3 mos" value="${profileData.total_years_experience || ''}" />
                    ` : ''}
                    <label class="tracker-label">Notes (Optional)</label>
                    <textarea id="tracker-notes" class="tracker-textarea" placeholder="Add notes..."></textarea>
                    <div class="tracker-actions">
                        <button id="tracker-save" class="tracker-button">✓ Save & Update</button>
                    </div>
                </div>
            </div>
            <button id="close-banner" class="banner-close">✕</button>
        </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    const saveBtn = banner.querySelector('#tracker-save');
    const closeBtn = banner.querySelector('#close-banner');

    closeBtn?.addEventListener('click', () => banner.remove());


    saveBtn?.addEventListener('click', async () => {
        const processed_by = banner.querySelector('#tracker-processed-by')?.value.trim() || '';
        const company = banner.querySelector('#tracker-company') ? banner.querySelector('#tracker-company').value.trim() : '';
        const yearsAtCurrent = banner.querySelector('#tracker-years-current') ? banner.querySelector('#tracker-years-current').value.trim() : '';
        const totalYears = banner.querySelector('#tracker-total-years') ? banner.querySelector('#tracker-total-years').value.trim() : '';
        const notes = banner.querySelector('#tracker-notes')?.value.trim() || '';

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span style="opacity: 0.7;">Saving...</span>';

        try {
            if (googleSheetsDB) {
                const result = await googleSheetsDB.updateCandidateFields(profileData.member_id, { 
                    company, 
                    notes, 
                    processedBy: processed_by,
                    yearsAtCurrent,
                    totalYears
                });
                if (!result.success) throw new Error(result.error || 'Update failed');
            }
            saveBtn.innerHTML = '✓ Saved';
            setTimeout(() => banner.remove(), 1000);
        } catch (e) {
            saveBtn.innerHTML = 'Retry Save';
            saveBtn.disabled = false;
            console.error('Save failed:', e);
        }
    });

    debug(`${type === 'exists' ? '⚠️' : '✅'} Banner injected`);
}

/**
 * Main processing function
 */
async function processCandidate() {
    if (processingInProgress) {
        debug('Processing already in progress, skipping...');
        return;
    }
    
    // Rate limiting to prevent infinite loops
    const now = Date.now();
    if (now - lastProcessTime < MIN_PROCESS_INTERVAL) {
        debug('Processing called too frequently, deferring...');
        return;
    }
    lastProcessTime = now;
    
    processingInProgress = true;

    try {
        const memberId = extractMemberId();
        if (!memberId) {
            debug('⚠️ No member ID found, skipping processing');
            processingInProgress = false;
            return;
        }

        if (memberId === currentMemberId) {
            debug('Same candidate, skipping...');
            processingInProgress = false;
            return;
        }
        currentMemberId = memberId;
        debug('Processing candidate:', memberId);

        const checkResult = await checkCandidate(memberId);
        
        if (checkResult.requiresSetup) {
            showSetupBanner();
            processingInProgress = false;
            return;
        }

        const profileData = extractProfileData(memberId);
        if (!profileData || profileData.full_name === 'Unknown') {
            debug('⚠️ Could not extract profile data');
            processingInProgress = false;
            return;
        }

        if (checkResult.exists) {
            injectProcessForm({ type: 'exists', profileData, processedBy: checkResult.processedBy });
        } else {
            const addResult = await addCandidate(profileData);
            if (addResult.success) {
                injectProcessForm({ type: 'new', profileData });
            } else {
                showErrorBanner(addResult.error || 'Failed to add candidate');
            }
        }
    } catch (error) {
        console.error('Error processing candidate:', error);
        showErrorBanner(error.message);
    } finally {
        processingInProgress = false;
    }
}

/**
 * Show setup banner
 */
function showSetupBanner() {
    const existingBanner = document.getElementById('linkedin-tracker-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'linkedin-tracker-banner';
    banner.className = 'linkedin-tracker-banner-warning';
    banner.innerHTML = `
        <div class="banner-content">
            <div class="banner-icon">⚙️</div>
            <div class="banner-text">
                <strong>Setup Required</strong>
                <p>Please configure your Google Sheets API credentials. Click the extension icon to access Settings.</p>
            </div>
            <button class="banner-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    setTimeout(() => banner.remove(), 5000);
}

/**
 * Show error banner
 */
function showErrorBanner(error) {
    const existingBanner = document.getElementById('linkedin-tracker-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.id = 'linkedin-tracker-banner';
    banner.className = 'linkedin-tracker-banner-warning';
    banner.innerHTML = `
        <div class="banner-content">
            <div class="banner-icon">❌</div>
            <div class="banner-text">
                <strong>Error</strong>
                <p>${error}</p>
            </div>
            <button class="banner-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    setTimeout(() => banner.remove(), 4000);
}

/**
 * Setup URL observer with debounce to prevent infinite loops
 */
function setupUrlObserver() {
    let lastUrl = window.location.href;
    let observerTimeout = null;
    let lastProcessTime = 0;
    const MIN_INTERVAL = 3000; // Minimum 3 seconds between processes
    
    // Use history change detection instead of aggressive MutationObserver
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    const onURLChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            debug('URL changed, processing new profile...');
            lastUrl = currentUrl;
            currentMemberId = null;
            
            // Clear existing timeout to debounce
            if (observerTimeout) clearTimeout(observerTimeout);
            
            // Only process if enough time has passed since last process
            const now = Date.now();
            const timeSinceLastProcess = now - lastProcessTime;
            const delayNeeded = Math.max(0, MIN_INTERVAL - timeSinceLastProcess);
            
            observerTimeout = setTimeout(() => {
                lastProcessTime = Date.now();
                processCandidate();
            }, 1500 + delayNeeded);
        }
    };
    
    // Override pushState and replaceState to detect URL changes
    window.history.pushState = function(...args) {
        const result = originalPushState.apply(this, args);
        onURLChange();
        return result;
    };
    
    window.history.replaceState = function(...args) {
        const result = originalReplaceState.apply(this, args);
        onURLChange();
        return result;
    };
    
    // Also listen for popstate events
    window.addEventListener('popstate', onURLChange);
    
    debug('✅ URL observer setup complete');
}

/**
 * Initialize extension
 */
async function init() {
    debug('🚀 LinkedIn Candidate Tracker initialized');
    await initializeGoogleSheetsDB();
    
    const isProfilePage = /linkedin\.com\/(talent|recruiter|in)\//.test(window.location.href);
    if (isProfilePage) {
        setTimeout(() => { processCandidate(); }, 1500);
    }
    setupUrlObserver();
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'recheck') {
        currentMemberId = null;
        processCandidate();
        sendResponse({ success: true });
        return true;
    }
    if (request.action === 'configUpdated') {
        initializeGoogleSheetsDB();
        sendResponse({ success: true });
        return true;
    }
    if (request.action === 'deleteCurrentCandidate') {
        (async () => {
            try {
                const memberId = extractMemberId();
                if (!memberId) {
                    sendResponse({ success: false, error: 'No profile found on this page' });
                    return;
                }
                if (!googleSheetsDB) {
                    sendResponse({ success: false, error: 'Google Sheets not configured' });
                    return;
                }
                const result = await googleSheetsDB.deleteCandidate(memberId);
                if (result) {
                    currentMemberId = null; // Reset so profile can be re-added
                    // Remove banner if present
                    const banner = document.getElementById('linkedin-tracker-banner');
                    if (banner) banner.remove();
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Failed to delete candidate' });
                }
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep channel open for async response
    }
});

} // End of initialization check
