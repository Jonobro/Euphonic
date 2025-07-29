document.addEventListener('DOMContentLoaded', () => {
    // State management for playlist import
    let playlistStates = [
        { id: 1, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '' },
        { id: 2, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '' },
        { id: 3, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '' },
        { id: 4, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '' },
        { id: 5, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '' }
    ];
    
    let isImporting = false;
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    function isValidSpotifyUrl(url) {
        return url.includes('open.spotify.com/playlist/') && url.length > 30;
    }

    async function validatePlaylist(url) {
        const response = await fetch('/validate_playlist/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ playlist_url: url })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to validate playlist');
        }
        
        return await response.json();
    }

    async function handlePlaylistBlur(id, url) {
        if (!url.trim()) return;
        
        if (!isValidSpotifyUrl(url)) {
            updatePlaylistStatus(id, 'error', '', url, 0, '');
            setTimeout(() => {
                updatePlaylistStatus(id, 'idle', '', '', 0, '');
            }, 3000);
            return;
        }

        updatePlaylistStatus(id, 'loading', '', url, 0, '');

        try {
            const playlistInfo = await validatePlaylist(url);
            updatePlaylistStatus(id, 'success', playlistInfo.name, url, playlistInfo.track_count, playlistInfo.playlist_id);
        } catch (error) {
            updatePlaylistStatus(id, 'error', '', url, 0, '');
            setTimeout(() => {
                updatePlaylistStatus(id, 'idle', '', '', 0, '');
            }, 3000);
        }
    }

    function updatePlaylistStatus(id, status, name = '', url = '', trackCount = 0, playlistId = '') {
        const playlistIndex = playlistStates.findIndex(p => p.id === id);
        if (playlistIndex !== -1) {
            playlistStates[playlistIndex] = { id, status, name, url, trackCount, playlistId };
            renderPlaylistInputs();
            updateSummary();
            updateImportButton();
        }
    }

    function handlePlaylistChange(id, newUrl) {
        const playlistIndex = playlistStates.findIndex(p => p.id === id);
        if (playlistIndex !== -1) {
            playlistStates[playlistIndex].url = newUrl;
        }
    }

    function handleRemovePlaylist(id) {
        updatePlaylistStatus(id, 'idle', '', '', 0, '');
    }

    async function handleImportAll() {
        if (isImporting) return;
        
        const validPlaylists = playlistStates.filter(p => p.status === 'success');
        if (validPlaylists.length === 0) return;

        isImporting = true;
        const importBtn = document.getElementById('importPlaylistsBtn');
        const originalText = importBtn.textContent;
        
        importBtn.disabled = true;
        importBtn.innerHTML = `
            <div class="spinner-small" style="margin-right: 0.5rem;"></div>
            Importing...
        `;

        try {
            const playlistUrls = validPlaylists.map(p => p.url);
            
            const response = await fetch('/import_playlists/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ playlist_urls: playlistUrls })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Close modal and show success
                window.closeImportModal();
                
                // Show mode toggle or update UI as needed
                if (window.showModeToggle) {
                    window.showModeToggle();
                }
                
                // Update the import button in header
                const tooltipContainer = document.querySelector('.tooltip-container-import');
                if (tooltipContainer) {
                    tooltipContainer.style.display = 'none';
                }
            } else {
                throw new Error(result.error || 'Failed to import playlists');
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            isImporting = false;
            importBtn.disabled = false;
            importBtn.textContent = originalText;
        }
    }

    function handleCancel() {
        playlistStates = playlistStates.map(playlist => ({ 
            ...playlist, 
            status: 'idle', 
            name: '', 
            url: '', 
            trackCount: 0,
            playlistId: ''
        }));
        isImporting = false;
        renderPlaylistInputs();
        updateSummary();
        updateImportButton();
    }

    function getValidPlaylistCount() {
        return playlistStates.filter(p => p.status === 'success').length;
    }

    function renderPlaylistInputs() {
        const container = document.getElementById('playlistInputsContainer');
        if (!container) return;
        
        container.innerHTML = '';

        playlistStates.forEach((playlist, index) => {
            const playlistDiv = document.createElement('div');
            playlistDiv.className = 'playlist-input-group';
            
            const label = document.createElement('label');
            label.className = 'playlist-input-label';
            label.textContent = `Playlist ${index + 1}:`;
            
            const inputContainer = document.createElement('div');
            inputContainer.className = 'playlist-input-container';
            
            let content = '';
            
            switch (playlist.status) {
                case 'loading':
                    content = `
                        <div class="playlist-loading-state">
                            <div class="spinner-small"></div>
                            <span style="margin-left: 0.5rem;">Fetching playlist...</span>
                        </div>
                    `;
                    break;
                case 'success':
                    content = `
                        <div class="playlist-success-state">
                            <div class="playlist-success-content">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                                </svg>
                                <div class="playlist-success-info">
                                    <div class="playlist-name">${playlist.name}</div>
                                    <div class="playlist-track-count">${playlist.trackCount} tracks</div>
                                </div>
                            </div>
                            <button class="playlist-remove-btn" onclick="window.playlistImport.handleRemovePlaylist(${playlist.id})">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                    break;
                case 'error':
                    content = `
                        <div class="playlist-error-state">
                            <span>Invalid Spotify playlist URL</span>
                        </div>
                    `;
                    break;
                default:
                    content = `
                        <input 
                            type="text" 
                            class="playlist-input-field" 
                            value="${playlist.url}" 
                            placeholder="https://open.spotify.com/playlist/..."
                            onblur="window.playlistImport.handlePlaylistBlur(${playlist.id}, this.value)"
                            oninput="window.playlistImport.handlePlaylistChange(${playlist.id}, this.value)"
                        />
                    `;
                    break;
            }
            
            inputContainer.innerHTML = content;
            playlistDiv.appendChild(label);
            playlistDiv.appendChild(inputContainer);
            container.appendChild(playlistDiv);
        });
    }

    function updateSummary() {
        const validCount = getValidPlaylistCount();
        const summary = document.getElementById('playlistSummary');
        const summaryText = document.getElementById('summaryText');
        
        if (!summary || !summaryText) return;
        
        if (validCount > 0) {
            summary.style.display = 'block';
            summaryText.textContent = `✓ ${validCount} playlist${validCount !== 1 ? 's' : ''} ready to import`;
        } else {
            summary.style.display = 'none';
        }
    }

    function updateImportButton() {
        const btn = document.getElementById('importPlaylistsBtn');
        if (!btn) return;
        
        const validCount = getValidPlaylistCount();
        
        if (isImporting) return;
        
        btn.disabled = validCount === 0;
        btn.textContent = validCount > 0 
            ? `Import ${validCount} Playlist${validCount !== 1 ? 's' : ''}` 
            : 'Import Playlists';
    }

    // Initialize
    function initialize() {
        renderPlaylistInputs();
        updateSummary();
        updateImportButton();
        
        // Set up import button event listener
        const importBtn = document.getElementById('importPlaylistsBtn');
        if (importBtn) {
            importBtn.addEventListener('click', handleImportAll);
        }
    }

    // Expose functions globally for use in onclick handlers
    window.playlistImport = {
        handlePlaylistBlur,
        handlePlaylistChange,
        handleRemovePlaylist,
        handleCancel,
        initialize
    };

    // Initialize when import modal is opened
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const importModal = document.getElementById('importModal');
                if (importModal && importModal.style.display === 'block') {
                    setTimeout(initialize, 100); // Small delay to ensure DOM is ready
                }
            }
        });
    });

    const importModal = document.getElementById('importModal');
    if (importModal) {
        observer.observe(importModal, { attributes: true });
    }
});