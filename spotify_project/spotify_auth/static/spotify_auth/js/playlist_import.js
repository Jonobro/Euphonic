document.addEventListener('DOMContentLoaded', () => {
    let playlistStates = [
        { id: 1, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 2, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 3, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 4, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 5, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 6, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 7, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 8, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 9, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false },
        { id: 10, url: '', name: '', status: 'idle', trackCount: 0, playlistId: '', justSucceeded: false }
    ];
    
    let isImporting = false;
    let visibleCount = 3;
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    
    // Flag to prevent multiple validations
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
            body: JSON.stringify({playlist_url: url})
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to validate playlist');
        }
        
        return await response.json();
    }

    async function handlePlaylistInput(id, inputValue) {
        if (!inputValue.trim() || validating[id]) return;
        
        const parsedUrl = parseSpotifyUrl(inputValue);
        if (!parsedUrl) return;
        
        // Prevent re-entry
        validating[id] = true;
        
        // Update input only if changed (avoids triggering oninput loop)
        const inputElement = document.querySelector(`input[data-playlist-id="${id}"]`);
        if (inputElement && inputElement.value !== parsedUrl) {
            const cursorPosition = inputElement.selectionStart;
            inputElement.value = parsedUrl;
            inputElement.setSelectionRange(cursorPosition, cursorPosition);
        }
        
        playlistStates.find(p => p.id === id).url = parsedUrl;
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

    function handlePlaylistChange(id, newUrl) {
        const playlistIndex = playlistStates.findIndex(p => p.id === id);
        if (playlistIndex !== -1) {
            playlistStates[playlistIndex].url = newUrl;
        }
        handlePlaylistInput(id, newUrl);
    }

    function handleRemovePlaylist(id) {
        updatePlaylistStatus(id, 'idle', '', '', 0, '');
    }

    function handleAddPlaylist() {
        if (visibleCount < playlistStates.length) {
            visibleCount++;
            renderPlaylistInputs();
        }
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
            <div class="spinner-small"></div>
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
        visibleCount = 3;
        renderPlaylistInputs();
        updateImportButton();
    }

    function getValidPlaylistCount() {
        return playlistStates.filter(p => p.status === 'success').length;
    }

    function getTotalTrackCount() {
        return playlistStates
            .filter(p => p.status === 'success')
            .reduce((total, p) => total + p.trackCount, 0);
    }

    function updateImportButton() {
        const btn = document.getElementById('importPlaylistsBtn');
        if (!btn) return;
        
        const validCount = getValidPlaylistCount();
        
        if (isImporting) return;
        
        if (validCount > 0) {
            btn.style.opacity = '0.9';
            btn.style.pointerEvents = 'auto';
            btn.disabled = false;
            btn.textContent = `Import ${validCount} Playlist${validCount !== 1 ? 's' : ''}`;
        } else {
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none';
            btn.disabled = true;
            btn.textContent = '';
        }
    }

    function triggerBurstAnimation(targetContainer) {
        if (!targetContainer) return;

        const burst = document.createElement('div');
        burst.className = 'burst-multilayer';
        
        targetContainer.appendChild(burst);

        const inputWidth = targetContainer.offsetWidth;
        const targetWidth = inputWidth * 1.2;
        const scale = targetWidth / 10; 
        burst.style.setProperty('--burst-scale', scale);

        burst.classList.add('animate');
        
        setTimeout(() => {
            const successElement = targetContainer.querySelector('.playlist-success-state');
            if (successElement) {
                const containerRect = targetContainer.getBoundingClientRect();
                const elementRect = successElement.getBoundingClientRect();
                const distanceToLeft = elementRect.left - containerRect.left - 5.5;
                successElement.style.transform = `translateX(-${distanceToLeft}px)`;
                successElement.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)';
                
                setTimeout(() => {
                    updateImportButton();
                }, 800);
            }
        }, 750);
        
        setTimeout(() => {
            burst.remove();
        }, 1200);
    }

    function renderPlaylistInputs() {
        const container = document.getElementById('playlistInputsContainer');
        if (!container) return;
        
        container.innerHTML = '';

        for (let i = 0; i < visibleCount; i++) {
            const playlist = playlistStates[i];
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
                            <span style="font-weight: 500;">Fetching playlist...</span>
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
                            placeholder="${i === 0 ? 'https://open.spotify.com/playlist/...' : ''}"
                            data-playlist-id="${playlist.id}"
                            onblur="window.playlistImport.handlePlaylistBlur(${playlist.id}, this.value)"
                            oninput="window.playlistImport.handlePlaylistChange(${playlist.id}, this.value)"
                        />
                    `;
                    break;
            }
            
            inputContainer.innerHTML = content;
            
            if (playlist.status === 'success') {
                const successElement = inputContainer.querySelector('.playlist-success-state');
                if (successElement) {
                    requestAnimationFrame(() => {
                        if (playlist.justSucceeded) {
                            triggerBurstAnimation(inputContainer);
                        } else {
                            // For existing success states, apply transform directly without animation
                            const containerRect = inputContainer.getBoundingClientRect();
                            const elementRect = successElement.getBoundingClientRect();
                            const distanceToLeft = elementRect.left - containerRect.left - 5.5;
                            successElement.style.transition = 'none';
                            successElement.style.transform = `translateX(-${distanceToLeft}px)`;
                        }
                    });
                }
            }
            
            playlistDiv.appendChild(inputContainer);
            container.appendChild(playlistDiv);
        }

        if (visibleCount < playlistStates.length) {
            const totalTracks = getTotalTrackCount();
            const addButtonDiv = document.createElement('div');
            
            if (totalTracks > 1000) {
                // Track limit reached - show disabled message
                addButtonDiv.className = 'playlist-add-button-container';
                addButtonDiv.innerHTML = `
                    <div class="playlist-limit-message">
                        You've reached the 1000-track limit. We will use the first 1000 tracks from the playlists you have included so far.
                    </div>
                `;
            } else {
                // Normal add button
                addButtonDiv.className = 'playlist-add-button-container';
                addButtonDiv.innerHTML = `
                    <button class="playlist-add-btn" onclick="window.playlistImport.handleAddPlaylist()">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 7.8V12m0 0v4.2m0-4.2h4.2M12 12H7.8" stroke-width="1.7" />
                            <path d="M21.217 12A9.217 9.217 0 0 1 12 21.217 9.217 9.217 0 0 1 2.783 12 9.217 9.217 0 0 1 12 2.783 9.217 9.217 0 0 1 21.217 12Z" stroke-width="1.565" />
                        </svg>
                        Add Another Playlist
                    </button>
                `;
            }
            
            container.appendChild(addButtonDiv);
        }
        
        // Reset justSucceeded flags
        playlistStates = playlistStates.map(p => ({ ...p, justSucceeded: false }));
    }

    // Initialize
    function initialize() {
        visibleCount = 3; // Reset to initial visible count
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
        handleAddPlaylist,
        handleCancel,
        initialize
    };

    let isModalOpen = false;

    // Initialize when import modal is opened
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const importModal = document.getElementById('importModal');
                if (importModal) {
                    if (importModal.style.display === 'block' && !isModalOpen) {
                        isModalOpen = true;
                        setTimeout(initialize, 100); // Small delay to ensure DOM is ready
                    } else if (importModal.style.display !== 'block' && isModalOpen) {
                        isModalOpen = false;
                        playlistStates = playlistStates.map(playlist => ({ 
                            ...playlist, 
                            status: 'idle', 
                            name: '', 
                            url: '', 
                            trackCount: 0,
                            playlistId: '',
                            justSucceeded: false
                        }));
                        isImporting = false;
                        visibleCount = 3;
                    }
                }
            }
        });
    });

    const importModal = document.getElementById('importModal');
    if (importModal) {
        observer.observe(importModal, { attributes: true });
    }
});