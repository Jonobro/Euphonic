document.addEventListener('DOMContentLoaded', () => {
    // State management for playlist import
    let playlistStates = [
        { id: 1, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 2, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 3, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 4, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 5, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false }
    ];
    
    let isImporting = false;
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    
    // Debouncing timers for each playlist input
    const inputTimers = {};

    // Add a flag to prevent multiple validations
    const validating = {};

    function parseSpotifyUrl(url) {
        const baseUrlPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]{22})/;
        const ptPattern = /pt=([a-zA-Z0-9]{32})/;
        
        const baseMatch = url.match(baseUrlPattern);
        if (!baseMatch) return null;
        
        const playlistId = baseMatch[1];
        const ptMatch = url.match(ptPattern);
        
        if (ptMatch) {
            return `https://open.spotify.com/playlist/${playlistId}?pt=${ptMatch[1]}`;
        } else {
            return `https://open.spotify.com/playlist/${playlistId}`;
        }
    }

    function isValidSpotifyUrl(url) {
        return parseSpotifyUrl(url) !== null;
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

    // Modify handlePlaylistInput to prevent loops and trigger fetch immediately if valid
    async function handlePlaylistInput(id, inputValue) {
        if (!inputValue.trim() || validating[id]) return;
        
        const parsedUrl = parseSpotifyUrl(inputValue);
        if (!parsedUrl) return; // Invalid, wait for blur
        
        // Prevent re-entry
        validating[id] = true;
        
        // Update input only if changed (avoids triggering oninput loop)
        const inputElement = document.querySelector(`input[data-playlist-id="${id}"]`);
        if (inputElement && inputElement.value !== parsedUrl) {
            const cursorPosition = inputElement.selectionStart; // Preserve cursor
            inputElement.value = parsedUrl;
            inputElement.setSelectionRange(cursorPosition, cursorPosition); // Restore cursor
        }
        
        // Update state
        playlistStates.find(p => p.id === id).url = parsedUrl;
        
        // Start validation immediately
        updatePlaylistStatus(id, 'loading', '', parsedUrl, 0, '');

        try {
            const playlistInfo = await validatePlaylist(parsedUrl);
            updatePlaylistStatus(id, 'success', playlistInfo.name, parsedUrl, playlistInfo.track_count, playlistInfo.playlist_id);
        } catch (error) {
            updatePlaylistStatus(id, 'error', '', parsedUrl, 0, '');
            setTimeout(() => {
                updatePlaylistStatus(id, 'idle', '', '', 0, '');
            }, 3000);
        } finally {
            validating[id] = false;
        }
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
    }

    function updatePlaylistStatus(id, status, name = '', url = '', trackCount = 0, playlistId = '') {
        const playlistIndex = playlistStates.findIndex(p => p.id === id);
        if (playlistIndex !== -1) {
            const current = playlistStates[playlistIndex];
            const justSucceeded = (status === 'success' && current.status !== 'success');
            playlistStates[playlistIndex] = { id, status, name, url, trackCount, playlistId, justSucceeded };
            renderPlaylistInputs();
            updateImportButton();
        }
    }

    // Modify handlePlaylistChange to process immediately without debounce
    function handlePlaylistChange(id, newUrl) {
        const playlistIndex = playlistStates.findIndex(p => p.id === id);
        if (playlistIndex !== -1) {
            playlistStates[playlistIndex].url = newUrl;
        }
        
        // Clear any existing timer (if somehow present)
        if (inputTimers[id]) {
            clearTimeout(inputTimers[id]);
            delete inputTimers[id];
        }
        
        // Process immediately
        handlePlaylistInput(id, newUrl);
    }

    function handleRemovePlaylist(id) {
        // Clear any pending timer
        if (inputTimers[id]) {
            clearTimeout(inputTimers[id]);
            delete inputTimers[id];
        }
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
        // Clear all timers
        Object.keys(inputTimers).forEach(id => {
            clearTimeout(inputTimers[id]);
            delete inputTimers[id];
        });
        
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
                                <span class="icon">🎵</span>
                                <div class="playlist-success-info">
                                    <div class="playlist-name">${playlist.name}</div>
                                    <div class="playlist-name">·</div>
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
                            id="playlist-input-${playlist.id}"
                            name="playlist-url-${playlist.id}"
                            value="${playlist.url}" 
                            placeholder="${index === 0 ? 'https://open.spotify.com/playlist/...' : ''}"
                            data-playlist-id="${playlist.id}"
                            onblur="window.playlistImport.handlePlaylistBlur(${playlist.id}, this.value)"
                            oninput="window.playlistImport.handlePlaylistChange(${playlist.id}, this.value)"
                        />
                    `;
                    break;
            }
            
            inputContainer.innerHTML = content;
            
            if (playlist.status === 'success') {
                const successState = inputContainer.querySelector('.playlist-success-state');
                if (successState) {
                    const burst = document.createElement('div');
                    burst.className = 'burst-multilayer';
                    successState.appendChild(burst);
                    
                    if (playlist.justSucceeded) {
                        requestAnimationFrame(() => {
                            burst.classList.remove('animate');
                            burst.offsetHeight; // Force reflow
                            burst.classList.add('animate');
                        });
                    }
                }
            }
            
            playlistDiv.appendChild(inputContainer);
            container.appendChild(playlistDiv);
        });
        
        // Reset justSucceeded flags
        playlistStates = playlistStates.map(p => ({ ...p, justSucceeded: false }));
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