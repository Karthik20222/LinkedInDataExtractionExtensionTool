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
 */
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
            '.ph5 h1'
        ];

        let fullName = '';
        for (const selector of nameSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                fullName = el.textContent.trim();
                if (fullName) break;
            }
        }

        if (!fullName) {
            const titleMatch = (getMeta('og:title') || document.title).match(/^([^|]+)/);
            fullName = titleMatch ? titleMatch[1].trim() : 'Unknown Candidate';
        }

        const headlineSelectors = [
            '.text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium',
            '[data-test-profile-headline]'
        ];
        let headline = '';
        for (const selector of headlineSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                headline = el.textContent.trim();
                if (headline) break;
            }
        }

        const locationSelectors = [
            'span.text-body-small.inline.t-black--light.break-words',
            '.pv-text-details__left-panel .text-body-small:not(.break-words)',
            '[data-test-profile-location]'
        ];
        let location = '';
        for (const selector of locationSelectors) {
            const el = document.querySelector(selector);
            if (el && el.textContent) {
                const text = el.textContent.trim();
                if (text && text.length > 2 && !text.includes('·') && !text.includes('follower')) {
                    location = text;
                    break;
                }
            }
        }

        const currentCompany = extractCurrentCompany();

        // Try to extract latest experience (designation + company) from Experience section
        const exp = extractLatestExperience();

        // Try to extract latest education and passout year from Education section
        const edu = extractLatestEducation();

        const profileData = {
            member_id: memberId,
            full_name: fullName || 'Unknown',
            // Profile card headline (skills/summary text)
            headline: headline || '',
            // Designation from Experience section (company name)
            designation: exp.company || currentCompany || '',
            location: location || '',
            // Current job title from Experience section
            current_company: exp.title || '',
            passout: edu.passout || '',
            qualification: edu.qualification || '',
            profile_url: window.location.href.split('?')[0],
            // Years of experience
            years_at_current: exp.yearsAtCurrent || '',
            total_years_experience: exp.totalYears || ''
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
        const anchor = document.querySelector('#experience');
        let section = anchor ? anchor.closest('section') : null;
        if (!section) {
            // Fallback: find a section that contains the word "Experience"
            section = Array.from(document.querySelectorAll('section')).find(sec => /experience/i.test(sec.textContent || '')) || null;
        }
        if (!section) return { title: '', company: '', yearsAtCurrent: '', totalYears: '' };

        // Find first experience entity
        const entity = section.querySelector('[data-view-name="profile-component-entity"], li.artdeco-list__item, .pvs-entity');
        if (!entity) return { title: '', company: '', yearsAtCurrent: '', totalYears: '' };

        // Use dedicated helpers for robust extraction
        const title = extractTitleFromEntity(entity);
        const company = extractCompanyFromEntity(entity);

        // Extract years at current company (from first/current experience)
        const yearsAtCurrent = extractDurationFromEntity(entity);
        
        // Calculate total years of experience from all positions
        const totalYears = calculateTotalExperience(section);

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
 * Calculate total years of experience from all experience entries
 */
function calculateTotalExperience(section) {
    try {
        let totalMonths = 0;
        
        // Find all top-level experience entities in the section
        const entities = section.querySelectorAll('[data-view-name="profile-component-entity"], li.artdeco-list__item, .pvs-entity');
        
        for (const entity of entities) {
            // Skip nested role entries within a company (they're already counted in the company total)
            // Check if this entity is nested inside another pvs-entity
            const parent = entity.parentElement?.closest('.pvs-entity');
            if (parent && parent !== entity) {
                continue; // Skip nested roles
            }
            
            // Look for duration text in caption wrapper
            const captionWrappers = entity.querySelectorAll('.pvs-entity__caption-wrapper, span.t-14.t-normal.t-black--light span[aria-hidden="true"]');
            
            let found = false;
            for (const wrapper of captionWrappers) {
                const text = wrapper.innerText?.trim() || '';
                
                // Match patterns like "5 mos", "2 yrs", "1 yr 3 mos"
                // More flexible regex to catch variations
                const yearsMatch = text.match(/(\d+)\s*y(?:ears?|rs?)/i);
                const monthsMatch = text.match(/(\d+)\s*m(?:onths?|os?)/i);
                
                if (yearsMatch || monthsMatch) {
                    const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
                    const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
                    totalMonths += (years * 12) + months;
                    found = true;
                    break;
                }
            }
            
            // Fallback: check innerText lines (only first occurrence to avoid nested roles)
            if (!found) {
                const lines = (entity.innerText || '').split('\n').map(t => t.trim());
                for (const line of lines) {
                    const yearsMatch = line.match(/(\d+)\s*y(?:ears?|rs?)/i);
                    const monthsMatch = line.match(/(\d+)\s*m(?:onths?|os?)/i);
                    
                    if (yearsMatch || monthsMatch) {
                        const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
                        const months = monthsMatch ? parseInt(monthsMatch[1], 10) : 0;
                        totalMonths += (years * 12) + months;
                        break;
                    }
                }
            }
        }
        
        if (totalMonths === 0) return '';
        
        const totalYears = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        return formatDuration(totalYears, remainingMonths);
    } catch (_) {
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
