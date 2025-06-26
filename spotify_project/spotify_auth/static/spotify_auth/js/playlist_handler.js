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

            const removalRegex = /\+\+\+\+\+.*?\+\+\+\+\+(?:<br>)?/; // Revise as needed based on typical outputs from Gemini
            content.innerHTML = content.innerHTML.replace(removalRegex, '').trim();

            const trackLinks = Array.from(content.querySelectorAll('a[href^="https://open.spotify.com/track/"]'));
            
            if (trackLinks.length > 0) {
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'save-playlist-container';
                buttonContainer.style.marginTop = '1em';
                
                const saveButton = document.createElement('button');
                saveButton.className = 'button save-playlist-button';
                saveButton.textContent = `Save Playlist "${playlistName}" to Spotify`;
                
                buttonContainer.appendChild(saveButton);
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
                        errorMessage.style.color = '#ff4d4d';
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