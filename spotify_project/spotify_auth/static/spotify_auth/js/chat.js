// Page loading state management
window.addEventListener('load', function() {
    const container = document.querySelector('.container');
    const betaNotice = document.querySelector('.beta-notice');
    const spotifyFooter = document.querySelector('.spotify-footer');
    
    setTimeout(() => {
        if (container) container.classList.add('loaded');
        if (betaNotice) betaNotice.classList.add('loaded');
        if (spotifyFooter) spotifyFooter.classList.add('loaded');
    }, 100);
});

// Fallback in case window.load doesn't execute
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const container = document.querySelector('.container');
        const betaNotice = document.querySelector('.beta-notice');
        const spotifyFooter = document.querySelector('.spotify-footer');
        
        if (container && !container.classList.contains('loaded')) {
            container.classList.add('loaded');
        }
        if (betaNotice && !betaNotice.classList.contains('loaded')) {
            betaNotice.classList.add('loaded');
        }
        if (spotifyFooter && !spotifyFooter.classList.contains('loaded')) {
            spotifyFooter.classList.add('loaded');
        }
    }, 3000);
});

document.addEventListener('DOMContentLoaded', () => {
    const chatMode = document.body.dataset.chatMode;
    const sendButton = document.getElementById('send-button');
    const userInput  = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    const renderer = new marked.Renderer();
    const originalLinkRenderer = renderer.link;
    renderer.link = (href, title, text) => {
        const link = originalLinkRenderer.call(renderer, href, title, text);
        return link.replace(/^<a/, '<a target="_blank" rel="noopener noreferrer"');
    };

    if (window.marked) {
        marked.setOptions({ 
            gfm: true, 
            breaks: true, 
            headerIds: false, 
            mangle: false, 
            smartLists: true, 
            smartypants: true,
            renderer: renderer
        });
    }

    const scrollToBottom = () => {
        setTimeout(() => {
            messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
        }, 10);
    };

    const addMessage = (text, sender, shouldScroll = true) => {
        const msg = document.createElement('div');
        msg.className = `message ${sender}-message`;
        
        if (sender === 'ai' && text && text.includes("I'm afraid I can't help with that. Do you have any questions or requests related to your music?")) {
            msg.classList.add('error-message');
        }
        
        if (window.marked && window.DOMPurify) {
            try {
                const dirtyHtml = marked.parse(text || '');
                // Enhanced DOMPurify configuration for better security
                msg.innerHTML = DOMPurify.sanitize(dirtyHtml, { 
                    ADD_ATTR: ['target'],
                    FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
                    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
                    ALLOW_DATA_ATTR: false
                });
            }
            catch { msg.textContent = text; }
        } else { msg.textContent = text; }

        messageList.append(msg);
        
        // Special styling for second AI message on analysis page
        if (chatMode === 'analysis' && sender === 'ai') {
            const aiMessages = messageList.querySelectorAll('.ai-message');
            if (aiMessages.length === 1) {
                msg.classList.add('analysis-first-message');
            } else if (aiMessages.length === 2 && !messageList.querySelector('.analysis-divider-before')) {
                const dividerBefore = document.createElement('div');
                dividerBefore.className = 'conversation-divider analysis-divider-before';
                messageList.insertBefore(dividerBefore, msg);
                msg.classList.add('second-message', 'analysis-second-message');
                const dividerAfter = document.createElement('div');
                dividerAfter.className = 'conversation-divider analysis-divider-after';
                messageList.appendChild(dividerAfter);
            } else if (aiMessages.length === 3) {
                msg.classList.add('analysis-third-message');
            }
        }
        
        if (shouldScroll) {
            scrollToBottom();
        }
        
        return msg;
    };

    window.addMessageAndScroll = (text, sender) => {
        const newMessage = addMessage(text, sender, false);
        newMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    
    const listenForResponse = (taskId, thinkingMsgElement, userMessageElement) => {
        const eventSource = new EventSource(`/stream_chat_response/${taskId}/`);

        const cleanup = () => {
            eventSource.close();
            if (thinkingMsgElement) thinkingMsgElement.remove();
            userInput.disabled = sendButton.disabled = false;
            userInput.focus();
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.response) {
                if (Array.isArray(data.response)) {
                    const hasContent = data.response.some(text => text && text.trim() !== '');
                    if (hasContent) {
                        data.response.forEach(text => {
                            if (text && text.trim() !== '') {
                                addMessage(text, 'ai', false);
                            }
                        });
                    } else {
                        addMessage("Sorry, I had a problem with your request. Please resend your message.", 'ai', false);
                    }
                } else {
                    if (data.response && data.response.trim() !== '') {
                        addMessage(data.response, 'ai', false);
                    } else {
                        addMessage("Sorry, I had a problem with your request. Please resend your message.", 'ai', false);
                    }
                }
                setTimeout(() => {
                    const userTop = userMessageElement.offsetTop;
                    const contentHeight = messageList.scrollHeight;
                    const viewHeight = messageList.clientHeight;
                    if (contentHeight - userTop <= viewHeight) {
                        scrollToBottom();
                    } else {
                        userMessageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 10);
            } else {
                addMessage("Sorry, I had a problem with your request. Please resend your message.", 'ai', false);
            }
            cleanup();
        };

        eventSource.addEventListener('stream_error', (event) => {
            const data = JSON.parse(event.data);
            addMessage(`Sorry, an error occurred: ${data.message}`, 'ai');
            cleanup();
        });

        eventSource.onerror = (err) => {
            addMessage('A connection error occurred. Please try again.', 'ai');
            console.error("EventSource failed:", err);
            cleanup();
        };
    };

    const handleSend = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const maxWords = 1000;
        if (wordCount > maxWords) {
            alert(`Your message is too long (${wordCount} words). Please keep it under ${maxWords} words.`);
            return;
        }

        const userMessageElement = addMessage(text, 'user');
        userInput.value = '';
        userInput.disabled = sendButton.disabled = true;
        
        // Create thinking message with spinner and static text
        const thinkingMsgElement = addMessage('', 'ai');
        thinkingMsgElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="/static/spotify_auth/images/spinner-double-green.svg" alt="Loading" style="width: 40px; height: 40px;">
                <span> Aria's Thinking...</span>
            </div>
        `;

        try {
            const res = await fetch('/chat_message_api/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ message: text })
            });

            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))).error || `Server error: ${res.status}`;
                throw new Error(err);
            }

            const { task_id } = await res.json();
            listenForResponse(task_id, thinkingMsgElement, userMessageElement);

        } catch (e) {
            if (thinkingMsgElement) thinkingMsgElement.remove(); 
            addMessage(`Sorry, ${e.message}`, 'ai');
            userInput.disabled = sendButton.disabled = false;
            userInput.focus();
        }
    };

    sendButton.onclick = handleSend;
    userInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    const isInitiallyLoading = messageList.dataset.isLoadingInitial === 'true';
    const initialAnalysisTaskId = messageList.dataset.initialAnalysisTaskId;

    if (isInitiallyLoading) {
        let loadingIndicator;
        let loadingInterval;
        
        if (chatMode === 'analysis') {
            const loadingIndicatorBaseText = "Welcome! I'm fetching your Spotify library and preparing your musical analysis. This might take a moment";
            loadingIndicator = addMessage(loadingIndicatorBaseText + "...", 'ai');
            let dotCount = 3;
            loadingInterval = setInterval(() => {
                dotCount = (dotCount % 3) + 1;
                if (loadingIndicator) {
                    loadingIndicator.textContent = loadingIndicatorBaseText + '.'.repeat(dotCount);
                }
            }, 400);
        } else if (chatMode === 'saved_songs') {
            const initialMessage = `Hi there! I'm Aria, your personal music curator. Let's craft some custom playlists from your Spotify collection. I can filter through your music using any criteria you can imagine.

Here are some examples of what I can do:
* Give me a playlist of all of my songs from the 90s
* I am on a road trip with my grandma – give me a playlist of my songs that she might like
* Create a playlist of all of the dream pop songs in my Spotify collection
* Make a playlist of all my songs that are sung in Spanish
* I'm feeling discouraged today – give me a playlist of my most uplifting songs
* Make me a playlist of my most niche tracks

I've talked too much – let's get started! What can I do for you?`;
            setTimeout(() => {
                const existingMessages = messageList.querySelectorAll('.message');
                if (existingMessages.length === 0) {
                    addMessage(initialMessage, 'ai', false);
                }
            }, 100);
        } else if (chatMode === 'new_songs') {
            const initialMessage = `Hi there! I'm Aria, your personal music curator – here to help you discover new music and craft the perfect playlist.

Tell me a bit about what you are looking for. You can mention things like:
* Mood (e.g., chill, focused, elated, exhausted)
* Genres (e.g., 90s rock, lo-fi beats, 50s bluegrass, dream pop)
* Favorite artists (e.g., create a playlist of songs by Drake, Kendrick Lamar, and J. Cole)
* A certain activity (e.g., music for studying history, road trip anthems, techno for online chess)
* A specific song (e.g., create a playlist of songs that sound similar to Stairway to Heaven by Led Zeppelin)

What's special about me, though, is that I can generate custom playlists for you based on any criteria you can imagine. For example:
* Create a playlist of Katy Perry's worst songs
* Make a playlist of songs that were produced in another country but blew up in the US
* Give me a playlist of songs about monkeys
* Create a playlist of songs that were released in May of 2021
* Send me a playlist of songs about bowling

I've talked too much – let's get started! What can I do for you?`;
            setTimeout(() => {
                const existingMessages = messageList.querySelectorAll('.message');
                if (existingMessages.length === 0) {
                    addMessage(initialMessage, 'ai', false);
                }
            }, 100);
        }

        userInput.disabled = sendButton.disabled = true;

        fetch('/initialize_chat_data/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                chat_mode: chatMode,
                initial_analysis_task_id: initialAnalysisTaskId
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `Initialization error: ${response.status}`);
                }).catch(() => {
                    throw new Error(`Initialization error: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (chatMode !== 'analysis') {
                if (loadingInterval) clearInterval(loadingInterval);
                if (loadingIndicator) loadingIndicator.remove();
            }

            if (chatMode === 'analysis') {
                if (data.already_initialized) {
                    if (loadingInterval) clearInterval(loadingInterval);
                    if (loadingIndicator) loadingIndicator.remove();
                    for (const messageText of data.first_ai_message) {
                        addMessage(messageText, 'ai', false);
                    }
                    userInput.disabled = sendButton.disabled = false;
                    if (!isInitiallyLoading || (document.activeElement !== userInput && userInput.value === '')) {
                        userInput.focus();
                    }
                } else if (data.analysis_started && initialAnalysisTaskId) {
                    const es = new EventSource(`/stream_initial_analysis/${initialAnalysisTaskId}/`);

                    es.onmessage = e => {
                        if (loadingIndicator) loadingIndicator.remove();
                        clearInterval(loadingInterval);
                        
                        const data = JSON.parse(e.data);
                        const history = data.response;

                        if (Array.isArray(history)) {
                            history.forEach(message => {
                                if (message.role === 'model' && message.parts && message.parts[0] && message.parts[0].text) {
                                    addMessage(message.parts[0].text, 'ai', false);
                                }
                            });
                        }
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        if (!isInitiallyLoading || (document.activeElement !== userInput && userInput.value === '')) {
                            userInput.focus();
                        }
                    };

                    es.addEventListener('stream_error', e => {
                        if (loadingIndicator) loadingIndicator.remove();
                        clearInterval(loadingInterval);
                        const errorData = JSON.parse(e.data);
                        addMessage(`Sorry, an error occurred: ${errorData.message}`, 'ai');
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    });

                    es.onerror = () => {
                        if (loadingIndicator) loadingIndicator.remove();
                        clearInterval(loadingInterval);
                        addMessage('Sorry, a connection error occurred while fetching your analysis.', 'ai');
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    };
                }
            } else if (chatMode === 'saved_songs' || chatMode === 'new_songs') {
                const existingAiMessage = messageList.querySelector('.ai-message');
                if (existingAiMessage) {
                    existingAiMessage.remove();
                }
                if (data.error) {
                    addMessage(`Initialization failed: ${data.error}`, 'ai');
                } else if (Array.isArray(data.first_ai_message)) {
                    for (const messageText of data.first_ai_message) {
                        addMessage(messageText, 'ai', false);
                    }
                }
            }
            messageList.removeAttribute('data-is-loading-initial');
        })
        .catch(error => {
            if (loadingInterval) clearInterval(loadingInterval);
            if (loadingIndicator) loadingIndicator.remove();
            addMessage('Sorry, there was a problem initializing the chat. Please refresh the page to try again.', 'ai');
            console.error("Initialization error:", error);
            if (chatMode !== 'analysis') {
                userInput.disabled = sendButton.disabled = false;
                userInput.focus();
            }
        })
        .finally(() => {
            if (chatMode !== 'analysis') {
                userInput.disabled = sendButton.disabled = false;
                if (!isInitiallyLoading || (document.activeElement !== userInput && userInput.value === '')) {
                     userInput.focus();
                }
            }
        });
    } else {
        const chatHistoryDataElement = document.getElementById('chat-history-data');
        if (chatHistoryDataElement) {
            try {
                const history = JSON.parse(chatHistoryDataElement.textContent);
                if (Array.isArray(history)) {
                    const lastDividerIndex = history.map(m => m.role).lastIndexOf('divider');

                    history.forEach((message, index) => {
                        if (message.role && message.parts && message.parts[0] && message.parts[0].text) {
                            if (message.role === 'divider') {
                                const dividerElement = document.createElement('div');
                                dividerElement.className = 'conversation-divider';
                                messageList.appendChild(dividerElement);
                                return;
                            }
                            const sender = message.role === 'model' ? 'ai' : 'user';
                            const messageElement = addMessage(message.parts[0].text, sender, false);

                            if (lastDividerIndex !== -1 && index < lastDividerIndex) {
                                messageElement.classList.add('previous-conversation');
                            }
                            
                            // Special styling for second AI message on analysis page
                            if (chatMode === 'analysis' && sender === 'ai') {
                                const aiMessages = messageList.querySelectorAll('.ai-message');
                                if (aiMessages.length === 1) {
                                    messageElement.classList.add('analysis-first-message');
                                } else if (aiMessages.length === 2 && !messageList.querySelector('.analysis-divider-before')) {
                                    const dividerBefore = document.createElement('div');
                                    dividerBefore.className = 'conversation-divider analysis-divider-before';
                                    messageList.insertBefore(dividerBefore, messageElement);
                                    messageElement.classList.add('second-message', 'analysis-second-message');
                                    const dividerAfter = document.createElement('div');
                                    dividerAfter.className = 'conversation-divider analysis-divider-after';
                                    messageElement.parentNode.insertBefore(dividerAfter, messageElement.nextSibling);
                                } else if (aiMessages.length === 3) {
                                    messageElement.classList.add('analysis-third-message');
                                }
                            }
                        }
                    });

                    if (chatMode === 'analysis') {
                        let analysisScrollThreshold = 3;
                        if (history.length > 3 && history[3]?.parts?.[0]?.text?.includes("Note: Your Spotify music collection contains")) {
                            analysisScrollThreshold = 4;
                        }
                        if (history.length > analysisScrollThreshold) {
                            scrollToBottom();
                        }
                    } else if (chatMode === 'new_songs' || chatMode === 'saved_songs') {
                        let messagesAfterDivider = 0;
                        if (lastDividerIndex !== -1) {
                            messagesAfterDivider = history.slice(lastDividerIndex + 1).filter(m => m.role !== 'divider').length;
                        } else {
                            messagesAfterDivider = history.filter(m => m.role !== 'divider').length;
                        }
                        if (lastDividerIndex !== -1 && messagesAfterDivider > 0) {
                            scrollToBottom();
                        }
                        let scrollThreshold = 1;
                        if (history.length > 1 && history[1]?.parts?.[0]?.text?.includes("Note: Your Spotify music collection contains")) {
                            scrollThreshold = 2;
                        }
                        if (history.length > scrollThreshold) {
                            scrollToBottom();
                        }
                    }
                }
            } catch (e) {
                console.error("Could not parse chat history:", e);
                addMessage("Sorry, there was an error loading your chat history.", 'ai');
            }
        }
    }

    const tooltipReset = document.querySelector('.custom-tooltip-reset');
    const tooltipContainerReset = document.querySelector('.tooltip-container-reset');

    if (tooltipReset && tooltipContainerReset) {
        tooltipContainerReset.addEventListener('mousemove', (e) => {
            tooltipReset.style.left = (e.clientX + 10) + 'px';
            tooltipReset.style.top = (e.clientY + 10) + 'px';
        });
    }

    const tooltipImport = document.querySelector('.custom-tooltip-import');
    const tooltipContainerImport = document.querySelector('.tooltip-container-import');

    if (tooltipImport && tooltipContainerImport) {
        tooltipContainerImport.addEventListener('mousemove', (e) => {
            tooltipImport.style.left = (e.clientX + 10) + 'px';
            tooltipImport.style.top = (e.clientY + 10) + 'px';
        });
    }

    // Handle form submission
    const importForm = document.getElementById('importPlaylistForm');
    if (importForm) {
        importForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(importForm);
            const playlistUrls = [];
            
            // Collect non-empty URLs
            for (let i = 1; i <= 5; i++) {
                const url = formData.get(`playlist${i}`);
                if (url && url.trim()) {
                    playlistUrls.push(url.trim());
                }
            }
            
            if (playlistUrls.length === 0) {
                alert('Please enter at least one playlist URL.');
                return;
            }
            
            // Show loading indicator
            const importButton = document.querySelector('#importPlaylistForm button[type="submit"]');
            const originalButtonText = importButton.textContent;
            importButton.disabled = true;
            importButton.textContent = 'Importing...';
            
            // Add loading indicator to modal body
            const modalBody = document.querySelector('#importModal .modal-body');
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'import-loading-modal';
            loadingDiv.innerHTML = `
                <div class="import-loading-indicator"></div>
                <p style="text-align: center; margin-top: 10px; color: #e0e0e0;">
                    Importing your playlists... This may take a moment.
                </p>
            `;
            modalBody.appendChild(loadingDiv);

            try {
                const response = await fetch('/import_playlists/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify({ playlist_urls: playlistUrls })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Close modal and show mode toggle
                    closeImportModal();
                    showModeToggle();
                    
                    // Update the import button in header
                    const tooltipContainer = document.querySelector('.tooltip-container-import');
                    if (tooltipContainer) {
                        tooltipContainer.style.display = 'none';
                    }
                } else {
                    throw new Error(result.error || 'Failed to import playlists');
                }
            } catch (error) {
                // Remove loading indicator and restore form
                loadingDiv.remove();
                importButton.disabled = false;
                importButton.textContent = originalButtonText;
                alert(`Error: ${error.message}`);
            }
        });
    }

    // Initialize mode toggle if it exists
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', function() {
            const currentMode = document.body.dataset.chatMode;
            const newMode = currentMode === 'new_songs' ? 'saved_songs' : 'new_songs';
            
            // Update toggle appearance
            if (newMode === 'saved_songs') {
                modeToggle.classList.add('saved-songs');
                modeToggle.querySelector('[data-mode="saved_songs"]').classList.add('active');
                modeToggle.querySelector('[data-mode="new_songs"]').classList.remove('active');
            } else {
                modeToggle.classList.remove('saved-songs');
                modeToggle.querySelector('[data-mode="new_songs"]').classList.add('active');
                modeToggle.querySelector('[data-mode="saved_songs"]').classList.remove('active');
            }
            
            // Navigate to the appropriate view
            const targetUrl = newMode === 'saved_songs' ? '/saved_songs_chat/' : '/new_song_chat/';
            window.location.href = targetUrl;
        });
    }

    function pollForImportCompletion() {
        const checkCompletion = async () => {
            try {
                const response = await fetch('/check_import_status/', {
                    method: 'GET',
                    headers: {
                        'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').content
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.completed) {
                        showModeToggle();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error checking import status:', error);
            }
            
            // Poll again in 2 seconds
            setTimeout(checkCompletion, 2000);
        };
        
        checkCompletion();
    }

    function showModeToggle() {
        const tooltipContainer = document.querySelector('.tooltip-container-import');
        const modeToggleContainer = document.getElementById('modeToggleContainer');
        
        if (tooltipContainer) {
            tooltipContainer.style.display = 'none';
        }
        
        if (modeToggleContainer) {
            modeToggleContainer.style.display = 'flex';
        }
    }
});