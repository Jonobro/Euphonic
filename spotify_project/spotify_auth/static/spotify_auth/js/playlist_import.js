document.addEventListener('DOMContentLoaded', () => {
    const musicEmojiImg = new Image();
    musicEmojiImg.src = '/static/spotify_auth/images/MusicEmoji.webp';
    
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

    (function() {
        const helpBtn = document.getElementById('importHelpBtn');
        const panel = document.getElementById('importHelpPanel');
        if (!helpBtn || !panel) return;
        helpBtn.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            requestAnimationFrame(() => {
                recalcSuccessPillOffsets();
            });
        });
    })();

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

    async function validatePlaylist(url, inputId) {
        const response = await fetch('/validate_playlist/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                playlist_url: url,
                input_id: inputId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to validate playlist');
        }
        
        return await response.json();
    }

    async function handlePlaylistInput(id, inputValue) {
        if (validating[id]) return;

        if (!inputValue.trim()) {
            showErrorAndClear(id);
            return;
        }

        const parsedUrl = parseSpotifyUrl(inputValue);
        if (!parsedUrl) {
            showErrorAndClear(id);
            return;
        }

        // Prevent re-entry
        validating[id] = true;
        
        // Update input only if changed
        const inputElement = document.querySelector(`input[data-playlist-id="${id}"]`);
        if (inputElement && inputElement.value !== parsedUrl) {
            const cursorPosition = inputElement.selectionStart;
            inputElement.value = parsedUrl;
            inputElement.setSelectionRange(cursorPosition, cursorPosition);
        }
        
        playlistStates.find(p => p.id === id).url = parsedUrl;
        updatePlaylistStatus(id, 'loading', '', parsedUrl, 0, '');

        try {
            const inputId = `playlist-input-${id}`;
            const playlistInfo = await validatePlaylist(parsedUrl, inputId);
            updatePlaylistStatus(id, 'success', playlistInfo.name, parsedUrl, playlistInfo.track_count, playlistInfo.playlist_id);
        } catch (error) {
            showErrorAndClear(id);
        } finally {
            validating[id] = false;
        }
    }

    async function handlePlaylistBlur(id, url) {
        const trimmed = (url || '').trim();
        if (!trimmed) {
            return;
        }
        if (!isValidSpotifyUrl(trimmed)) {
            showErrorAndClear(id);
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
            updateModalInteractivity();
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
            <span class="spinner-small" aria-hidden="true">
                <svg class="spinner-small-svg" viewBox="0 0 23.813 23.813">
                    <g class="spinner-rotator">
                        <path class="spinner-dot" d="M2.97 11.905a1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1 1 1 0 0 0-1 1"/>
                        <path class="spinner-ring" d="M4.97 11.906v.017a7.53 7.53 0 0 0 2.185 5.257 7.53 7.53 0 0 0 5.262 2.172 7.53 7.53 0 0 0 5.256-2.185 7.53 7.53 0 0 0 2.17-5.069 8.55 8.55 0 0 1-2.469 5.775 8.54 8.54 0 0 1-5.967 2.472c-2.21 0-4.405-.91-5.968-2.472a8.54 8.54 0 0 1-2.472-5.967Z"/>
                    </g>
                </svg>
            </span>
            Importing...
        `;

        const modalCloseEl = document.querySelector('#importModal .close-modal');
        const modalCancelEl = document.querySelector('#importModal .import-cancel-button');
        [modalCloseEl, modalCancelEl].forEach(el => { if (el) el.style.pointerEvents = 'none'; });

        try {
            const playlistsPayload = validPlaylists.map(p => ({
                id: p.id,
                url: p.url,
                name: p.name,
                track_count: p.trackCount,
                playlist_id: p.playlistId
            }));
            
            const response = await fetch('/import_playlists/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ playlists: playlistsPayload })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                const playlistsChanged = !!result.playlists_changed;
                
                if (playlistsChanged) {
                    if (window.forceResetAnalysis) {
                        window.forceResetAnalysis(true);
                    }
                }

                if (Array.isArray(result.updated_messages_for_saved_songs) && result.updated_messages_for_saved_songs.length) {
                    const historyEl = document.getElementById('chat-history-data');
                    let hasSavedSongsHistory = false;
                    if (historyEl) {
                        try {
                            const all = JSON.parse(historyEl.textContent || '[]');
                            hasSavedSongsHistory = Array.isArray(all) && all.length === 3 && Array.isArray(all[1]) && all[1].length > 0;
                        } catch (e) {
                            console.error('Failed to parse chat-history-data JSON:', e);
                        }
                    }

                    if (hasSavedSongsHistory) {
                        try {
                            result.updated_messages_for_saved_songs.forEach(msg => {
                                if (window.updateChatHistoryData) {
                                    window.updateChatHistoryData('saved_songs', msg);
                                }
                            });

                            const activeBtn = document.querySelector('.segment-button.active');
                            if (activeBtn?.dataset.mode === 'saved_songs') {
                                const messageList = document.getElementById('message-list');
                                if (messageList) {
                                    const existingMessages = messageList.querySelectorAll('.message');
                                    existingMessages.forEach(msg => msg.classList.add('previous-conversation'));
                                    const oldPlaylistActionButtons = messageList.querySelectorAll('div.additional-buttons-container');
                                    oldPlaylistActionButtons.forEach(el => el.remove());
                                    result.updated_messages_for_saved_songs.forEach((m, idx) => {
                                        if (m.role === 'divider') {
                                            const dividerElement = document.createElement('div');
                                            dividerElement.className = 'conversation-divider';
                                            messageList.appendChild(dividerElement);
                                            return;
                                        }
                                        if (m.role === 'model' && m.parts?.[0]?.text && window.addMessageAndScroll) {
                                            const createdEl = window.addMessageAndScroll(m.parts[0].text, 'ai', { suppressPersist: true });
                                            if (createdEl instanceof HTMLElement && idx === 0) {
                                                createdEl.classList.add('music-collection-updated-message');
                                                createdEl.classList.add('previous-conversation');
                                            }
                                        }
                                    });

                                    if (window.toggleChatInput) {
                                        window.toggleChatInput(false);
                                    }
                                    const userInput = document.getElementById('user-input');
                                    if (userInput) {
                                        userInput.focus();
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Failed to append saved_songs updates to chat-history');
                        }
                    }
                }

                window.closeImportModal();
                const labelEl = document.querySelector('#import-music-link .dropdown-link-text');
                if (labelEl) labelEl.textContent = 'Edit Imported Playlists';
                const tooltipEl = document.querySelector('#import-music-link .dropdown-tooltip');
                if (tooltipEl) tooltipEl.textContent = 'Manage your previously imported playlists';

                window.hasImportedPlaylists = true;

                if (window.pendingModeSwitch) {
                    const target = window.pendingModeSwitch;
                    window.pendingModeSwitch = null;
                    setTimeout(() => {
                        const btn = document.querySelector(`.segment-button[data-mode="${target}"]`);
                        if (btn && !btn.classList.contains('active')) {
                            btn.click();
                        }
                    }, 200);
                }
            } else {
                throw new Error(result.error || 'Failed to import playlists');
            }
        } catch (error) {
            console.error('Playlist import failed:', error);
            alert(`Error: ${error.message}`);
        } finally {
            isImporting = false;
            const importModal = document.getElementById('importModal');
            const isModalOpen = importModal && importModal.classList.contains('open');
            if (isModalOpen) {
                importBtn.disabled = false;
                importBtn.textContent = originalText;
                [modalCloseEl, modalCancelEl].forEach(el => { if (el) el.style.pointerEvents = ''; });
            }
        }
    }

    function handleCancel() {
        resetPlaylistData();
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
            btn.disabled = false;
            btn.classList.add('import-playlist-button--active');
            if (window.hasImportedPlaylists) {
                btn.textContent = 'Update Playlists';
            } else {
                btn.textContent = `Import ${validCount} Playlist${validCount !== 1 ? 's' : ''}`;
            }
        } else {
            btn.disabled = true;
            btn.classList.remove('import-playlist-button--active');
            btn.textContent = '';
        }
    }
    
    function resetPlaylistData() {
        playlistStates = playlistStates.map(p => ({
            id: p.id,
            url: '',
            name: '',
            status: 'idle',
            trackCount: 0,
            playlistId: '',
            justSucceeded: false
        }));
        isImporting = false;
        visibleCount = 3;
        renderPlaylistInputs();
        updateImportButton();
        updateModalInteractivity();
    }

    function updateModalInteractivity() {
        const anyLoading = playlistStates.some(p => p.status === 'loading');
        const closeEl = document.querySelector('#importModal .close-modal');
        const cancelEl = document.querySelector('#importModal .import-cancel-button');
        const importBtn = document.getElementById('importPlaylistsBtn');

        [closeEl, cancelEl, importBtn].forEach(el => {
            if (!el) return;
            if (anyLoading) {
                if (el.dataset.prevPointerEvents === undefined) {
                    el.dataset.prevPointerEvents = el.style.pointerEvents;
                }
                el.style.pointerEvents = 'none';
            } else if (el.dataset.prevPointerEvents !== undefined) {
                el.style.pointerEvents = el.dataset.prevPointerEvents;
                delete el.dataset.prevPointerEvents;
            } else {
                el.style.pointerEvents = '';
            }
        });
    }

    function showErrorAndClear(id) {
        const inputElement = document.querySelector(`input[data-playlist-id="${id}"]`);
        if (inputElement) {
            inputElement.value = '';
        }
        updatePlaylistStatus(id, 'error', '', '', 0, '');
        setTimeout(() => {
            updatePlaylistStatus(id, 'idle', '', '', 0, '');
        }, 8000);
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

    function recalcSuccessPillOffsets() {
        const containers = document.querySelectorAll('#playlistInputsContainer .playlist-input-container');
        containers.forEach(inputContainer => {
            const successElement = inputContainer.querySelector('.playlist-success-state');
            if (!successElement) return;
            const containerRect = inputContainer.getBoundingClientRect();
            const elementRect = successElement.getBoundingClientRect();
            const distanceToLeft = elementRect.left - containerRect.left - 5.5;
            successElement.style.transition = 'none';
            successElement.style.transform = `translateX(-${distanceToLeft}px)`;
        });
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
                            <span class="spinner-small" aria-hidden="true">
                                <svg class="spinner-small-svg" viewBox="0 0 23.813 23.813">
                                    <g class="spinner-rotator">
                                        <path class="spinner-dot" d="M2.97 11.905a1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1 1 1 0 0 0-1 1"/>
                                        <path class="spinner-ring" d="M4.97 11.906v.017a7.53 7.53 0 0 0 2.185 5.257 7.53 7.53 0 0 0 5.262 2.172 7.53 7.53 0 0 0 5.256-2.185 7.53 7.53 0 0 0 2.17-5.069 8.55 8.55 0 0 1-2.469 5.775 8.54 8.54 0 0 1-5.967 2.472c-2.21 0-4.405-.91-5.968-2.472a8.54 8.54 0 0 1-2.472-5.967Z"/>
                                    </g>
                                </svg>
                            </span>
                            <span style="font-weight: 500;">Fetching playlist...</span>
                        </div>
                    `;
                    break;
                case 'success': {
                    const hasTracks = Number(playlist.trackCount) > 0;
                    const trackMarkup = hasTracks
                        ? `
                                    <div class="playlist-name">·</div>
                                    <div class="playlist-track-count">${playlist.trackCount} tracks</div>
                              `
                        : '';
                    content = `
                        <div class="playlist-success-state">
                            <div class="playlist-success-content">
                                <img class="icon" src="/static/spotify_auth/images/MusicEmoji.webp" alt=""/>
                                <div class="playlist-success-info">
                                    <div class="playlist-name">${playlist.name}</div>
                                    ${trackMarkup}
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
                }
                case 'error':
                    content = `
                        <div class="playlist-error-state">
                            <span>Invalid share link. Press <svg xmlns="http://www.w3.org/2000/svg" class="import-help-icon-error" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="9.5" fill="none" stroke-width="1.5" />
                            <text x="10" y="14" font-family="Roboto, 'Segoe UI', Arial, sans-serif" font-size="12" font-weight="500" text-anchor="middle">?</text>
                        </svg> above for help.</span>
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
            
            if (totalTracks > 500) {
                addButtonDiv.className = 'playlist-add-button-container';
                addButtonDiv.innerHTML = `
                    <div class="playlist-limit-message">
                        You've reached the 500-track limit. We will use the first 500 tracks from the playlists you have included so far.
                    </div>
                `;
            } else {
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
        
        playlistStates = playlistStates.map(p => ({ ...p, justSucceeded: false }));
    }
    
    function computeDefaultVisibleCount() {
        const modalBody = document.querySelector('#importModal .modal-body');
        const inputsContainer = document.getElementById('playlistInputsContainer');
        if (!modalBody || !inputsContainer) return;
        const groups = inputsContainer.querySelectorAll('.playlist-input-group');
        if (groups.length === 0) return;
        const bodyHeight = modalBody.clientHeight;
        if (bodyHeight <= 0) return;
        const addSection = inputsContainer.querySelector('.playlist-add-button-container');
        const addSectionHeight = addSection.clientHeight;

        const styles = window.getComputedStyle(modalBody);
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;

        const p1 = modalBody.querySelector('p.import-instructions-one');
        const p2 = modalBody.querySelector('p.import-instructions-two');
        const p1Height = p1.clientHeight;
        const p2Height = p2.clientHeight;
        const p1Style = window.getComputedStyle(p1);
        const p2Style = window.getComputedStyle(p2);
        const p1MarginBottom = parseFloat(p1Style.marginBottom) || 0;
        const p2MarginBottom = parseFloat(p2Style.marginBottom) || 0;

        const groupStyle = window.getComputedStyle(groups[0]);
        const rowStep = groups[0].clientHeight + parseFloat(groupStyle.marginBottom);
        if (rowStep <= 0) return;

        const consumed = p1Height + p1MarginBottom + p2Height + p2MarginBottom + addSectionHeight + paddingTop + paddingBottom;
        const availableSpace = Math.max(0, bodyHeight - consumed - 1);
        let count = Math.floor(availableSpace / rowStep);
        
        const total = playlistStates.length;

        if (!Number.isFinite(count)) count = 1;
        if (count < 1) count = 1;
        if (count > total) count = total;
        if (count !== visibleCount) {
            visibleCount = count;
            renderPlaylistInputs();
        }
    }

    function initialize() {
        visibleCount = 3;
        renderPlaylistInputs();
        requestAnimationFrame(() => {
            computeDefaultVisibleCount();
        });
        updateImportButton();
        updateModalInteractivity();

        const importBtn = document.getElementById('importPlaylistsBtn');
        if (importBtn) {
            importBtn.addEventListener('click', handleImportAll);
        }
    }

    async function populatePlaylistStates() {
        try {
            const res = await fetch('/get_submitted_playlists/', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                cache: 'no-store'
            });
            if (!res.ok) return;
            const data = await res.json();
            const playlists = Array.isArray(data.playlists) ? data.playlists : [];
            if (!playlists.length) return;

            let filled = 0;
            playlists.forEach(pl => {
                if (filled >= playlistStates.length) return;
                playlistStates[filled] = {
                    ...playlistStates[filled],
                    url: pl.url || '',
                    name: pl.name || '',
                    status: 'success',
                    trackCount: Number(pl.track_count) || 0,
                    playlistId: pl.playlist_id || '',
                    justSucceeded: false
                };
                filled++;
            });

            if (filled > 0) {
                visibleCount = Math.max(visibleCount, filled);
                renderPlaylistInputs();
                updateImportButton();
                updateModalInteractivity();
            }
        } catch (e) {
            console.error('populatePlaylistStates error:', e);
        }
    }

    window.playlistImport = {
        handlePlaylistBlur,
        handlePlaylistChange,
        handleRemovePlaylist,
        handleAddPlaylist,
        handleCancel,
        initialize,
        resetPlaylistData,
        populatePlaylistStates
    };

    window.addEventListener('beforeunload', () => {
        resetPlaylistData();
    });
});