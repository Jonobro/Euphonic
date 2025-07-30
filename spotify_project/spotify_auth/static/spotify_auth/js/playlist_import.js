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
                                <svg viewBox="0 0 384 512" width="15px"><path d="M381.9 388.2c-6.4 27.4-27.2 42.8-55.1 48-24.5 4.5-44.9 5.6-64.5-10.2-23.9-20.1-24.2-53.4-2.7-74.4 17-16.2 40.9-19.5 76.8-25.8 6-1.1 11.2-2.5 15.6-7.4 6.4-7.2 4.4-4.1 4.4-163.2 0-11.2-5.5-14.3-17-12.3-8.2 1.4-185.7 34.6-185.7 34.6-10.2 2.2-13.4 5.2-13.4 16.7 0 234.7 1.1 223.9-2.5 239.5-4.2 18.2-15.4 31.9-30.2 39.5-16.8 9.3-47.2 13.4-63.4 10.4-43.2-8.1-58.4-58-29.1-86.6 17-16.2 40.9-19.5 76.8-25.8 6-1.1 11.2-2.5 15.6-7.4 10.1-11.5 1.8-256.6 5.2-270.2.8-5.2 3-9.6 7.1-12.9 4.2-3.5 11.8-5.5 13.4-5.5 204-38.2 228.9-43.1 232.4-43.1 11.5-.8 18.1 6 18.1 17.6.2 344.5 1.1 326-1.8 338.5z"></path></svg>
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