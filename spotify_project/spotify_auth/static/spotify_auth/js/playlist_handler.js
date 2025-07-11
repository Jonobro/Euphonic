document.addEventListener('DOMContentLoaded', () => {
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    function processMessageForPlaylist(messageElement) {
        if (!messageElement.classList.contains('ai-message')) {
            return;
        }

        const content = messageElement;
        if (!content) return;

        const playlistNameRegex = /\+\+\+\+\+(.*?)\+\+\+\+\+/;
        const match = content.innerHTML.match(playlistNameRegex);

        if (match && match[1]) {
            const playlistNameHTML = match[1].trim();
            
            const decoder = document.createElement('textarea');
            decoder.innerHTML = playlistNameHTML;
            const playlistName = decoder.value;

            const removalRegex = /\+\+\+\+\+.*?\+\+\+\+\+(?:<br>)?/;
            content.innerHTML = content.innerHTML.replace(removalRegex, '').trim();

            const trackLinks = Array.from(content.querySelectorAll('a[href^="https://open.spotify.com/track/"]'));
            
            if (trackLinks.length > 0) {
                messageElement.classList.add('has-playlist-button');
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'save-playlist-container';
                
                const saveButton = document.createElement('button');
                saveButton.className = 'button save-playlist-button';
                saveButton.textContent = `Save Playlist "${playlistName}" to Spotify`;
                
                const additionalButtonsContainer = document.createElement('div');
                additionalButtonsContainer.className = 'additional-buttons-container';
                
                const button1 = document.createElement('button');
                button1.className = 'button secondary-button';
                button1.textContent = 'Revise Playlist';
                
                const button2 = document.createElement('button');
                button2.className = 'button secondary-button';
                button2.textContent = 'Create Another Playlist';
                
                additionalButtonsContainer.appendChild(button1);
                additionalButtonsContainer.appendChild(button2);

                button2.addEventListener('click', async () => {
                    const chatMode = document.body.dataset.chatMode;
                    try {
                        const response = await fetch('/reset_chat_history_api/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrfToken,
                            },
                            body: JSON.stringify({ chat_mode: chatMode })
                        });

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.initial_response) {
                                const allButtonContainers = document.querySelectorAll('.playlist-buttons-container');
                                allButtonContainers.forEach(container => container.remove());

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
                    }
                });
                
                buttonContainer.appendChild(saveButton);
                buttonContainer.appendChild(additionalButtonsContainer);
                content.appendChild(buttonContainer);

                saveButton.addEventListener('click', async () => {
                    saveButton.disabled = true;
                    saveButton.textContent = 'Saving...';

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
                                description: `A playlist named "${playlistName}" created by Euphonic Intelligence.`
                            })
                        });

                        if (response.ok) {
                            const result = await response.json();
                            const successMessage = document.createElement('p');
                            successMessage.className = 'save-playlist-success';
                            successMessage.innerHTML = `Playlist "<a href="${result.playlist_url}" target="_blank" rel="noopener noreferrer">${playlistName}</a>" saved to your Spotify!`;
                            buttonContainer.innerHTML = '';
                            buttonContainer.appendChild(successMessage);
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
                        buttonContainer.innerHTML = '';
                        const errorMessage = document.createElement('p');
                        errorMessage.className = 'save-playlist-error';
                        errorMessage.textContent = `Error: ${error.message}`;
                        buttonContainer.appendChild(errorMessage);
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