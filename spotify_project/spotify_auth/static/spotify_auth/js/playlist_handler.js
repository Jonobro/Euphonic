document.addEventListener('DOMContentLoaded', () => {
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    function toggleChatInput(disabled) {
        const chatInput = document.querySelector('input[type="text"], textarea');
        const sendButton = document.getElementById('send-button');

        if (chatInput) {
            chatInput.disabled = disabled;
            if (disabled) {
                chatInput.placeholder = 'Please select an option above to continue...';
            } else {
                chatInput.placeholder = 'Reply to Aria...';
            }
        }
        
        if (sendButton) {
            sendButton.disabled = disabled;
            if (disabled) {
                sendButton.classList.add('disabled-no-hover');
            } else {
                sendButton.classList.remove('disabled-no-hover');
            }
        }
    }

async function handlePlaylistAction(userAction) {
    const chatMode = document.body.dataset.chatMode;
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
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
            if (data.success && data.initial_response) {
                const allMessages = messageList.querySelectorAll('.message');
                allMessages.forEach(message => {
                    message.classList.add('previous-conversation');
                    const existingSecondary = message.querySelector('.additional-buttons-container');
                    if (existingSecondary) {
                        existingSecondary.remove();
                    }
                });
                const dividerElement = document.createElement('div');
                dividerElement.className = 'conversation-divider';
                messageList.appendChild(dividerElement);
                toggleChatInput(false);

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
        alert(`Error: ${error.message}`);
        toggleChatInput(false);
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
                instructionMessage.innerHTML = `Press <img src="/static/spotify_auth/images/SaveIcon.svg" alt="Save to library icon" class="spotify-save-icon"> in Spotify to add it to your library`;

                messageContainer.appendChild(successMessage);
                messageContainer.appendChild(instructionMessage);

                playlistActionsContainer.appendChild(messageContainer);
                playlistActionsContainer.appendChild(secondaryActionsContainer);
                content.appendChild(playlistActionsContainer);
                toggleChatInput(true);
                return;
            }

            const messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';

            const successMessage = document.createElement('p');
            successMessage.className = 'create-playlist-success';
            successMessage.innerHTML = `Playlist <a href="${savedPlaylists[playlistIdentifier]}" target="_blank" rel="noopener noreferrer">${playlistName}</a> created in Spotify!`;
            
            const instructionMessage = document.createElement('p');
            instructionMessage.className = 'create-playlist-instructions';
            instructionMessage.innerHTML = `Press <img src="/static/spotify_auth/images/SaveIcon.svg" alt="Save to library icon" class="spotify-save-icon"> in Spotify to add it to your library`;

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
                toggleChatInput(true);
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
                    <div class="spinner-small"></div>
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
                        await new Promise(resolve => setTimeout(resolve, 3000)); /* Simulated delay for improved UX and to allow for Spotify propagation */
                        window.open(result.playlist_url, '_blank', 'noopener, noreferrer');
                        openButton.remove();
                        
                        const messageContainer = document.createElement('div');
                        messageContainer.className = 'message-container';

                        const successMessage = document.createElement('p');
                        successMessage.className = 'create-playlist-success';
                        successMessage.innerHTML = `Playlist <a href="${result.playlist_url}" target="_blank" rel="noopener noreferrer">${playlistName}</a> created in Spotify!`;

                        const instructionMessage = document.createElement('p');
                        instructionMessage.className = 'create-playlist-instructions';
                        instructionMessage.innerHTML = `Press <img src="/static/spotify_auth/images/SaveIcon.svg" alt="Save to library icon" class="spotify-save-icon"> in Spotify to add it to your library`;

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