// Page loading state management
window.addEventListener('load', function() {
    const container = document.querySelector('.container');
    const betaNotice = document.querySelector('.beta-notice');
    const spotifyFooter = document.querySelector('.spotify-footer');
    
    setTimeout(() => {
        if (container) container.classList.add('loaded');
        if (betaNotice) betaNotice.classList.add('loaded');
        if (spotifyFooter) spotifyFooter.classList.add('loaded');
    }, 1000);
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
    let chatMode = document.body.dataset.chatMode;

    const path = location.pathname;
    if (path.includes('/chat/saved')) chatMode = 'saved_songs';
    else if (path.includes('/chat/new')) chatMode = 'new_songs';
    else if (path.includes('/chat/analyze')) chatMode = 'analysis';

    document.body.dataset.chatMode = chatMode;

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
        
        const aiMessageCount = messageList.querySelectorAll('.ai-message').length;
        const isFirstAiMessage = sender === 'ai' && aiMessageCount === 0;
        const sessionKey = `blur_fade_shown_${chatMode}`;
        const hasShownBlurFade = sessionStorage.getItem(sessionKey);
        const shouldShowBlurFade = isFirstAiMessage && !hasShownBlurFade && (chatMode === 'saved_songs' || chatMode === 'new_songs');
        
        if (shouldShowBlurFade) {
            msg.classList.add('blur-fade-container');
            const backgroundOverlay = document.createElement('div');
            backgroundOverlay.className = 'background-overlay';
            msg.appendChild(backgroundOverlay);
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'blur-fade-combo';
            msg.appendChild(contentDiv);
            
            if (window.marked && window.DOMPurify) {
                try {
                    const dirtyHtml = marked.parse(text || '');
                    contentDiv.innerHTML = DOMPurify.sanitize(dirtyHtml, { 
                        ADD_ATTR: ['target'],
                        FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
                        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
                        ALLOW_DATA_ATTR: false
                    });
                }
                catch { contentDiv.textContent = text; }
            } else { 
                contentDiv.textContent = text; 
            }
        } else {
            if (window.marked && window.DOMPurify) {
                try {
                    const dirtyHtml = marked.parse(text || '');
                    msg.innerHTML = DOMPurify.sanitize(dirtyHtml, { 
                        ADD_ATTR: ['target'],
                        FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
                        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
                        ALLOW_DATA_ATTR: false
                    });
                }
                catch { msg.textContent = text; }
            } else { 
                msg.textContent = text; 
            }
        }

        messageList.append(msg);
        
        // Trigger blur-fade animation for first AI message only after container is loaded
        if (shouldShowBlurFade) {
            const triggerAnimation = () => {
                sessionStorage.setItem(sessionKey, 'true');
                
                const overlay = msg.querySelector('.background-overlay');
                const content = msg.querySelector('.blur-fade-combo');
                if (overlay) overlay.classList.add('fade-out');
                if (content) content.classList.add('focused');
            };

            const container = document.querySelector('.container');
            if (container && container.classList.contains('loaded')) {
                // Container is already loaded, start animation after short delay
                setTimeout(triggerAnimation, 2000);
            } else {
                // Listen for the container load event
                const handleContainerLoad = () => {
                    setTimeout(triggerAnimation, 2000);
                    container.removeEventListener('transitionend', handleContainerLoad);
                };
                
                if (container) {
                    container.addEventListener('transitionend', handleContainerLoad);
                }
            }
        }
        
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
            addMessage('Sorry, an unexpected error occurred. Please try again.', 'ai');
            console.error('Stream error:', data.message);
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
        
        const thinkingMsgElement = addMessage('', 'ai');
        thinkingMsgElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="/static/spotify_auth/images/FinalThinkingIndicator.svg" alt="Loading" style="width: 40px; height: 40px;">
                <span>Aria's Thinking...</span>
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

            const {task_id} = await res.json();
            listenForResponse(task_id, thinkingMsgElement, userMessageElement);

        } catch (e) {
            if (thinkingMsgElement) thinkingMsgElement.remove();
            addMessage('Sorry, something went wrong. Please try again.', 'ai');
            console.error('Chat send error:', e);
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
* I'm on a road trip with my grandma – make a playlist of my songs that she might like
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
* A certain activity (e.g., music for studying history, road trip anthems, techno for bullet chess)
* A specific song (e.g., create a playlist of songs that sound similar to Stairway to Heaven)

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

    const setActiveSegment = (mode) => {
        const buttons = document.querySelectorAll('.segment-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    };

    async function initializeCurrentMode() {
        document.body.dataset.chatMode = chatMode;
        setActiveSegment(chatMode);

        while (messageList.firstChild) messageList.removeChild(messageList.firstChild);
        userInput.disabled = true;
        sendButton.disabled = true;

        let initialAnalysisTaskId = null;
        if (chatMode === 'analysis' && window.crypto?.randomUUID) {
            initialAnalysisTaskId = window.crypto.randomUUID();
            messageList.dataset.initialAnalysisTaskId = initialAnalysisTaskId;
            messageList.dataset.isLoadingInitial = 'true';
        } else {
            delete messageList.dataset.initialAnalysisTaskId;
            delete messageList.dataset.isLoadingInitial;
        }

        let loadingIndicator = null;
        let loadingInterval = null;
        if (chatMode === 'analysis') {
            const loadingIndicatorBaseText = "Welcome! I'm fetching your Spotify library and preparing your musical analysis. This might take a moment";
            loadingIndicator = addMessage(loadingIndicatorBaseText + "...", 'ai');
            let dotCount = 3;
            loadingInterval = setInterval(() => {
                dotCount = (dotCount % 3) + 1;
                if (loadingIndicator) loadingIndicator.textContent = loadingIndicatorBaseText + '.'.repeat(dotCount);
            }, 400);
        }

        try {
            const res = await fetch('/initialize_chat_data/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_mode: chatMode,
                    initial_analysis_task_id: initialAnalysisTaskId
                })
            });

            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))).error || `Initialization error: ${res.status}`;
                throw new Error(err);
            }
            const data = await res.json();

            // Handle per-mode bootstrap results (mirror existing on-load logic)
            if (chatMode === 'analysis') {
                if (data.already_initialized) {
                    if (loadingInterval) clearInterval(loadingInterval);
                    if (loadingIndicator) loadingIndicator.remove();
                    const firstMsgs = data.first_ai_message || [];
                    for (const msg of firstMsgs) addMessage(msg, 'ai', false);
                } else if (data.analysis_started && initialAnalysisTaskId) {
                    const es = new EventSource(`/stream_initial_analysis/${initialAnalysisTaskId}/`);
                    es.onmessage = (e) => {
                        if (loadingInterval) clearInterval(loadingInterval);
                        if (loadingIndicator) loadingIndicator.remove();
                        const payload = JSON.parse(e.data);
                        const history = payload.response;
                        if (Array.isArray(history)) {
                            history.forEach(m => {
                                if (m.role === 'model' && m.parts?.[0]?.text) {
                                    addMessage(m.parts[0].text, 'ai', false);
                                }
                            });
                        }
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    };
                    es.addEventListener('stream_error', e => {
                        if (loadingInterval) clearInterval(loadingInterval);
                        if (loadingIndicator) loadingIndicator.remove();
                        const errData = JSON.parse(e.data);
                        console.error("Stream error:", errData.message);
                        addMessage('Sorry, an unexpected error occurred. Please try again.', 'ai');
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    });
                    es.onerror = () => {
                        if (loadingInterval) clearInterval(loadingInterval);
                        if (loadingIndicator) loadingIndicator.remove();
                        addMessage('Sorry, a connection error occurred while fetching your analysis.', 'ai');
                        es.close();
                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    };
                    return;
                }
            } else {
                const existingAiMessage = messageList.querySelector('.ai-message');
                if (existingAiMessage) existingAiMessage.remove();
                if (Array.isArray(data.first_ai_message)) {
                    for (const msg of data.first_ai_message) addMessage(msg, 'ai', false);
                }
            }
        } catch (err) {
            if (loadingInterval) clearInterval(loadingInterval);
            if (loadingIndicator) loadingIndicator.remove();
            console.error("Initialization error:", err);
            addMessage('Sorry, something went wrong while initializing. Please try again.', 'ai');
        } finally {
            if (chatMode !== 'analysis') {
                userInput.disabled = sendButton.disabled = false;
                userInput.focus();
            }
        }
    }

    const segmentButtons = document.querySelectorAll('.segment-button');
    segmentButtons.forEach(button => {
        button.addEventListener('click', function() {
            const newMode = this.dataset.mode;
            switchChatMode(newMode);
        });
    });

    async function switchChatMode(newMode) {
        if (chatMode === newMode) return;
        chatMode = newMode;
        await initializeCurrentMode();
    }
});