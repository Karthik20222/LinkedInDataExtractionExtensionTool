/**
 * LinkedIn Candidate Dashboard JavaScript
 */

const API_BASE_URL = 'http://localhost:3000/api';

let allCandidates = [];

/**
 * Load all candidates from API
 */
async function loadCandidates() {
    try {
        const response = await fetch(`${API_BASE_URL}/candidates?limit=1000`);
        if (!response.ok) {
            throw new Error('Failed to fetch candidates');
        }

        const data = await response.json();
        allCandidates = data.data || [];

        renderTable(allCandidates);
        updateStats(data);
    } catch (error) {
        console.error('Error loading candidates:', error);
        document.getElementById('tableContent').innerHTML = `
            <div class="empty">
                <div class="empty-icon">⚠️</div>
                <h3>Error Loading Candidates</h3>
                <p>${error.message}</p>
                <button class="btn-refresh" onclick="loadCandidates()" style="margin-top: 20px;">Try Again</button>
            </div>
        `;
    }
}

/**
 * Render candidates table
 */
function renderTable(candidates) {
    const tableContent = document.getElementById('tableContent');

    if (candidates.length === 0) {
        tableContent.innerHTML = `
            <div class="empty">
                <div class="empty-icon">📋</div>
                <h3>No Candidates Found</h3>
                <p>Start tracking candidates by visiting LinkedIn profiles with the extension!</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Member ID</th>
                    <th>Full Name</th>
                    <th>Headline</th>
                    <th>Location</th>
                    <th>Company</th>
                    <th>Processed By</th>
                    <th>Date Added</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${candidates.map(candidate => `
                    <tr>
                        <td><code>${candidate.member_id}</code></td>
                        <td><strong>${candidate.full_name}</strong></td>
                        <td>${candidate.headline || '-'}</td>
                        <td>${candidate.location || '-'}</td>
                        <td>${candidate.current_company || '-'}</td>
                        <td>${candidate.processed_by || '-'}</td>
                        <td>${new Date(candidate.created_at).toLocaleDateString()}</td>
                        <td>
                            <div class="actions">
                                <button class="btn btn-view" onclick="window.open('${candidate.profile_url}', '_blank')" title="View LinkedIn Profile">
                                    👁️ View
                                </button>
                                <button class="btn btn-edit" onclick="openEditModal('${candidate.member_id}')" title="Edit Candidate">
                                    ✏️ Edit
                                </button>
                                <button class="btn btn-delete" onclick="deleteCandidate('${candidate.member_id}')" title="Delete Candidate">
                                    🗑️ Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    tableContent.innerHTML = tableHTML;
}

/**
 * Update statistics
 */
function updateStats(data) {
    const totalCount = data.pagination?.totalCount || allCandidates.length;
    document.getElementById('totalCandidates').textContent = totalCount;

    // Count today's candidates
    const today = new Date().toDateString();
    const todayCount = allCandidates.filter(c => 
        new Date(c.created_at).toDateString() === today
    ).length;
    document.getElementById('todayCandidates').textContent = todayCount;

    // Count unique recruiters
    const uniqueRecruiters = new Set(
        allCandidates
            .map(c => c.processed_by)
            .filter(p => p && p !== 'null')
    ).size;
    document.getElementById('uniqueRecruiters').textContent = uniqueRecruiters || 0;
}

/**
 * Open edit modal for a candidate
 */
function openEditModal(memberId) {
    const candidate = allCandidates.find(c => c.member_id === memberId);
    if (!candidate) return;

    document.getElementById('edit_member_id').value = candidate.member_id;
    document.getElementById('edit_full_name').value = candidate.full_name || '';
    document.getElementById('edit_headline').value = candidate.headline || '';
    document.getElementById('edit_location').value = candidate.location || '';
    document.getElementById('edit_current_company').value = candidate.current_company || '';
    document.getElementById('edit_processed_by').value = candidate.processed_by || '';
    document.getElementById('edit_notes').value = candidate.notes || '';

    document.getElementById('editModal').classList.add('active');
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    document.getElementById('editForm').reset();
}

/**
 * Handle edit form submission
 */
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const memberId = document.getElementById('edit_member_id').value;
    const candidate = allCandidates.find(c => c.member_id === memberId);
    
    const payload = {
        member_id: memberId,
        full_name: document.getElementById('edit_full_name').value,
        headline: document.getElementById('edit_headline').value,
        location: document.getElementById('edit_location').value,
        current_company: document.getElementById('edit_current_company').value,
        profile_url: candidate.profile_url,
        processed_by: document.getElementById('edit_processed_by').value || null,
        notes: document.getElementById('edit_notes').value || null
    };

    try {
        const response = await fetch(`${API_BASE_URL}/candidates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Failed to update candidate');
        }

        alert('Candidate updated successfully!');
        closeEditModal();
        loadCandidates();
    } catch (error) {
        console.error('Error updating candidate:', error);
        alert('Failed to update candidate: ' + error.message);
    }
});

/**
 * Delete a candidate
 */
async function deleteCandidate(memberId) {
    const candidate = allCandidates.find(c => c.member_id === memberId);
    if (!candidate) return;

    const confirmDelete = confirm(
        `Are you sure you want to delete "${candidate.full_name}"?\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
        const response = await fetch(`${API_BASE_URL}/candidates/${memberId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete candidate');
        }

        alert('Candidate deleted successfully!');
        loadCandidates();
    } catch (error) {
        console.error('Error deleting candidate:', error);
        alert('Failed to delete candidate: ' + error.message);
    }
}

/**
 * Close modal when clicking outside
 */
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Load candidates on page load
loadCandidates();
