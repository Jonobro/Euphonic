document.addEventListener('DOMContentLoaded', () => {
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

async function handlePlaylistAction(userAction) {
    const chatMode = getChatMode();
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    const allMessages = messageList.querySelectorAll('.message');
    allMessages.forEach(message => {
        const existingSecondary = message.querySelector('.additional-buttons-container');
        if (existingSecondary) { existingSecondary.remove(); }
    });

    try {
        const response = await fetch('/reset_chat_history_api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify({ chat_mode: chatMode, user_action: userAction })
        });

        if (response.ok) {
            const data = await response.json();

            if (data.chat_mode && data.chat_mode !== getChatMode()) {
                console.log(`Ignoring playlist action response for '${data.chat_mode}' mode as current mode is '${getChatMode()}'.`);
                return;
            }

            if (data.success && data.initial_response) {
                const allMessages = messageList.querySelectorAll('.message');
                allMessages.forEach(message => { message.classList.add('previous-conversation'); });
                const dividerElement = document.createElement('div');
                dividerElement.className = 'conversation-divider';
                messageList.appendChild(dividerElement);

                try {
                    if (window.appendDividerToHistory) {
                        window.appendDividerToHistory();
                    }
                } catch (e) {
                    console.error('Error persisting divider to chat history:', e);
                }

                window.toggleChatInput?.(false);
                window.updateChatInputPlaceholder?.();

                if (window.addMessageAndScroll) {
                    window.addMessageAndScroll(data.initial_response, 'ai');
                }
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reset chat.');
        }
    } catch (error) {
        console.error('Error resetting chat:', error);
        alert("Sorry, something went wrong. Please try again.");
        window.toggleChatInput?.(false);
        window.updateChatInputPlaceholder?.();
    }
}

function createSecondaryActionsContainer() {
    const secondaryActionsContainer = document.createElement('div');
    secondaryActionsContainer.className = 'additional-buttons-container';

    const reviseButton = document.createElement('button');
    reviseButton.className = 'button secondary-button';
    reviseButton.textContent = 'Revise Playlist';
    reviseButton.addEventListener('click', () => handlePlaylistAction('revise_playlist'));

    const createAnotherButton = document.createElement('button');
    createAnotherButton.className = 'button secondary-button';
    createAnotherButton.textContent = 'New Playlist';
    createAnotherButton.addEventListener('click', () => handlePlaylistAction('create_another_playlist'));

    secondaryActionsContainer.appendChild(reviseButton);
    secondaryActionsContainer.appendChild(createAnotherButton);

    return secondaryActionsContainer;
}

function processMessageForPlaylist(messageElement) {
    if (!messageElement.classList.contains('ai-message')) {
        return;
    }

    const messageList = messageElement.closest('#message-list');
    const allMessages = Array.from(messageList.children);
    const messageIndex = allMessages.indexOf(messageElement);
    
    let lastDividerIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].classList.contains('conversation-divider')) {
            lastDividerIndex = i;
            break;
        }
    }
    
    const isBeforeLastDivider = lastDividerIndex !== -1 && messageIndex < lastDividerIndex;

    const content = messageElement;
    if (!content) return;

    const playlistNameRegex = /\+\+\+\+\+(.*?)\+\+\+\+\+/;
    const match = content.innerHTML.match(playlistNameRegex);

    if (match && match[1]) {
        const playlistNameHTML = match[1].trim();
        
        const decoder = document.createElement('textarea');
        decoder.innerHTML = playlistNameHTML;
        const playlistName = decoder.value;

        const savedPlaylists = JSON.parse(sessionStorage.getItem('savedPlaylists') || '{}');
        const playlistIdentifier = playlistName;

        const titleElement = document.createElement('div');
        titleElement.className = 'playlist-title';
        titleElement.textContent = playlistName;
        
        const removalRegex = /\+\+\+\+\+.*?\+\+\+\+\+(?:<br>)?/;
        const cleanContent = content.innerHTML.replace(removalRegex, '').trim();
        content.innerHTML = cleanContent;
        content.prepend(titleElement);

        if (savedPlaylists[playlistIdentifier]) {
            messageElement.classList.add('has-playlist-button');
            if (isBeforeLastDivider) {
                messageElement.classList.add('previous-conversation');
            } else {
                const playlistActionsContainer = document.createElement('div');
                playlistActionsContainer.className = 'save-playlist-container';
                
                const secondaryActionsContainer = createSecondaryActionsContainer();

                const messageContainer = document.createElement('div');
                messageContainer.className = 'message-container';
                
                const successMessage = document.createElement('p');
                successMessage.className = 'create-playlist-success';
                successMessage.innerHTML = `Playlist <a href="${savedPlaylists[playlistIdentifier]}" target="_blank" rel="noopener noreferrer">${playlistName}</a> created in Spotify!`;
                
                const instructionMessage = document.createElement('p');
                instructionMessage.className = 'create-playlist-instructions';
                instructionMessage.innerHTML = `Press <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="spotify-save-icon"><path d="M21 11.998a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" style="stroke:#969696;stroke-width:1.75;stroke-dasharray:none;stroke-opacity:1"/><path d="M12 7.05v9.9" style="fill:#969696;fill-opacity:1;stroke:#969696;stroke-width:1.9265;stroke-dasharray:none;stroke-opacity:1"/><path d="M12.505 7.05a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916"/><path d="M12.505 16.95a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/><path d="M16.95 12h-9.9" style="stroke-width:1.92679;stroke:#969696;stroke-opacity:1"/><path d="M17.455 12a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505zm-9.9 0a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/></svg> in Spotify to add it to your library`;

                messageContainer.appendChild(successMessage);
                messageContainer.appendChild(instructionMessage);

                playlistActionsContainer.appendChild(messageContainer);
                playlistActionsContainer.appendChild(secondaryActionsContainer);
                content.appendChild(playlistActionsContainer);
                window.toggleChatInput?.(true);
                window.updateChatInputPlaceholder?.();
                return;
            }

            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';

            const successMessage = document.createElement('p');
            successMessage.className = 'create-playlist-success';
            successMessage.innerHTML = `Playlist <a href="${savedPlaylists[playlistIdentifier]}" target="_blank" rel="noopener noreferrer">${playlistName}</a> created in Spotify!`;
            
            const instructionMessage = document.createElement('p');
            instructionMessage.className = 'create-playlist-instructions';
            instructionMessage.innerHTML = `Press <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="spotify-save-icon"><path d="M21 11.998a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" style="stroke:#969696;stroke-width:1.75;stroke-dasharray:none;stroke-opacity:1"/><path d="M12 7.05v9.9" style="fill:#969696;fill-opacity:1;stroke:#969696;stroke-width:1.9265;stroke-dasharray:none;stroke-opacity:1"/><path d="M12.505 7.05a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916"/><path d="M12.505 16.95a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/><path d="M16.95 12h-9.9" style="stroke-width:1.92679;stroke:#969696;stroke-opacity:1"/><path d="M17.455 12a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505zm-9.9 0a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/></svg> in Spotify to add it to your library`;

            messageContainer.appendChild(successMessage);
            messageContainer.appendChild(instructionMessage);

            const playlistActionsContainer = document.createElement('div');
            playlistActionsContainer.className = 'save-playlist-container';
            playlistActionsContainer.appendChild(messageContainer);
            content.appendChild(playlistActionsContainer);
            return;
        }

        const trackLinks = Array.from(content.querySelectorAll('a[href^="https://open.spotify.com/track/"]'));
        
        if (trackLinks.length > 0) {
            messageElement.classList.add('has-playlist-button');
            const isLastMessage = messageIndex === allMessages.length - 1;
            if (isLastMessage) {
                window.toggleChatInput?.(true);
                window.updateChatInputPlaceholder?.();
            }
            
            const existingErrorContainer = content.querySelector('.save-playlist-error');
            if (existingErrorContainer) {
                return;
            }
            
            const existingSaveButton = content.querySelector('.save-playlist-button');
            if (existingSaveButton) {
                return;
            }
            
            const playlistActionsContainer = document.createElement('div');
            playlistActionsContainer.className = 'save-playlist-container';
            
            const openButton = document.createElement('button');
            openButton.className = 'button save-playlist-button';
            openButton.textContent = `Open Playlist in Spotify`;
            playlistActionsContainer.appendChild(openButton);

            if (!isBeforeLastDivider) {
                const secondaryActionsContainer = createSecondaryActionsContainer();
                playlistActionsContainer.appendChild(secondaryActionsContainer);
            }

            content.appendChild(playlistActionsContainer);

            openButton.addEventListener('click', async () => {
                openButton.disabled = true;
                openButton.innerHTML = `
                    <span class="spinner-small" aria-hidden="true">
                        <svg class="spinner-small-svg" viewBox="0 0 23.813 23.813">
                            <g class="spinner-rotator">
                                <path class="spinner-dot" d="M2.97 11.905a1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1 1 1 0 0 0-1 1"/>
                                <path class="spinner-ring" d="M4.97 11.906v.017a7.53 7.53 0 0 0 2.185 5.257 7.53 7.53 0 0 0 5.262 2.172 7.53 7.53 0 0 0 5.256-2.185 7.53 7.53 0 0 0 2.17-5.069 8.55 8.55 0 0 1-2.469 5.775 8.54 8.54 0 0 1-5.967 2.472c-2.21 0-4.405-.91-5.968-2.472a8.54 8.54 0 0 1-2.472-5.967Z"/>
                            </g>
                        </svg>
                    </span>
                    Working on it...
                `;

                const trackUris = trackLinks.map(link => {
                    const url = new URL(link.href);
                    const trackId = url.pathname.split('/').pop();
                    return `spotify:track:${trackId}`;
                });

                try {
                    const response = await fetch(`/create_playlist_api/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken,
                        },
                        body: JSON.stringify({
                            name: playlistName,
                            track_uris: trackUris,
                            description: `A playlist named "${playlistName}" created by Aria.`
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        await new Promise(resolve => setTimeout(resolve, 1500)); /* Simulated delay for improved UX and to allow for Spotify propagation */
                        window.open(result.playlist_url, '_blank', 'noopener, noreferrer');
                        openButton.remove();
                        
                        const messageContainer = document.createElement('div');
                        messageContainer.className = 'message-container';

                        const successMessage = document.createElement('p');
                        successMessage.className = 'create-playlist-success';
                        successMessage.innerHTML = `Playlist <a href="${result.playlist_url}" target="_blank" rel="noopener noreferrer">${playlistName}</a> created in Spotify!`;

                        const instructionMessage = document.createElement('p');
                        instructionMessage.className = 'create-playlist-instructions';
                        instructionMessage.innerHTML = `Press <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="spotify-save-icon"><path d="M21 11.998a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" style="stroke:#969696;stroke-width:1.75;stroke-dasharray:none;stroke-opacity:1"/><path d="M12 7.05v9.9" style="fill:#969696;fill-opacity:1;stroke:#969696;stroke-width:1.9265;stroke-dasharray:none;stroke-opacity:1"/><path d="M12.505 7.05a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916"/><path d="M12.505 16.95a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/><path d="M16.95 12h-9.9" style="stroke-width:1.92679;stroke:#969696;stroke-opacity:1"/><path d="M17.455 12a.505.505 0 0 1-.505.506.505.505 0 0 1-.505-.506.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505zm-9.9 0a.505.505 0 0 1-.505.505.505.505 0 0 1-.505-.505.505.505 0 0 1 .505-.505.505.505 0 0 1 .505.505z" style="fill:#969696;stroke:#969696;stroke-width:.916233"/></svg> in Spotify to add it to your library`;

                        messageContainer.appendChild(successMessage);
                        messageContainer.appendChild(instructionMessage);

                        playlistActionsContainer.insertBefore(messageContainer, playlistActionsContainer.firstChild);

                        const savedPlaylists = JSON.parse(sessionStorage.getItem('savedPlaylists') || '{}');
                        savedPlaylists[playlistIdentifier] = result.playlist_url;
                        sessionStorage.setItem('savedPlaylists', JSON.stringify(savedPlaylists));
                    } else {
                        let errorText = `Server error: ${response.status}`;
                        try {
                            const errorResult = await response.json();
                            errorText = errorResult.error || errorText;
                        } catch (e) {
                            console.error("Could not parse error response as JSON.");
                        }
                        throw new Error(errorText);
                    }
                } catch (error) {
                    openButton.textContent = `Open Playlist in Spotify`;
                    openButton.disabled = false;
                    console.error("Error opening playlist:", error);
                    if (window.addMessageAndScroll) {
                        window.addMessageAndScroll("Sorry, there was an error opening the playlist. Please try again.", 'ai');
                    } else {
                        alert("Sorry, there was an error opening the playlist. Please try again.");
                    }
                }
            });
        }
    }
}

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    const messages = node.matches('.message') ? [node] : node.querySelectorAll('.message');
                    messages.forEach(processMessageForPlaylist);
                }
            });
        });
    });

    document.querySelectorAll('#message-list .message').forEach(processMessageForPlaylist);
    observer.observe(messageList, { childList: true, subtree: true });
});