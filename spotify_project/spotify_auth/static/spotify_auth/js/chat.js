window.addEventListener('load', function() {
    const container = document.querySelector('.container');
    const betaNotice = document.querySelector('.beta-notice');
    const spotifyFooter = document.querySelector('.spotify-footer');
    
    setTimeout(() => {
        if (container) container.classList.add('loaded');
        if (betaNotice) betaNotice.classList.add('loaded');
        if (spotifyFooter) spotifyFooter.classList.add('loaded');
    }, 300);
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

let initialMessageDelayNeeded = true;

function getChatMode() {
    const activeBtn = document.querySelector('.segment-button.active');
    if (activeBtn) return activeBtn.dataset.mode;
    throw new Error('No active chat mode button found');
}

document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInput  = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    let suppressHistoryUpdate = false;
    let initialAnalysisEventSource = null;
    let modeSwitchCooldown = false;

    (() => {
        const chatMode = sessionStorage.getItem('chatMode') || 'new_songs';
        switchChatMode(chatMode);
    })();

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

    function scrollToBottom() {
        setTimeout(() => {
            messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
        }, 10);
    }

    function scrollToBottomImmediate() {
        messageList.scrollTop = messageList.scrollHeight;
    }

    function escapeNonAscii(str) {
        return str.replace(/[&<>\u007F-\uFFFF]/g, function(c) {
            const hex = c.charCodeAt(0).toString(16);
            const upperHex = hex.slice(0, -1) + hex.slice(-1).toUpperCase();
            return '\\u' + ('0000' + upperHex).slice(-4);
        });
    }

    function updateChatHistoryData(mode, newMessage) {
        const chatHistoryDataElement = document.getElementById('chat-history-data');
        if (!chatHistoryDataElement) return;

        try {
            let allChatHistory = JSON.parse(chatHistoryDataElement.textContent || '[[], [], []]');
            if (!Array.isArray(allChatHistory) || allChatHistory.length !== 3) {
                allChatHistory = [[], [], []];
            }
            const indexMap = { new_songs: 0, saved_songs: 1, analysis: 2 };
            const modeIndex = indexMap[mode];
            if (modeIndex != null) {
                if (!Array.isArray(allChatHistory[modeIndex])) {
                    allChatHistory[modeIndex] = [];
                }
                allChatHistory[modeIndex].push(newMessage);
                const jsonString = JSON.stringify(allChatHistory);
                chatHistoryDataElement.textContent = escapeNonAscii(jsonString);
            }
        } catch (e) {
            console.error('Error updating chat history data:', e);
        }
    }

    window.updateChatHistoryData = updateChatHistoryData;
    window.appendDividerToHistory = function() {
        try {
            const mode = getChatMode();
            updateChatHistoryData(mode, { role: 'divider', parts: [{ text: '---' }] });
        } catch (e) {
            console.error('Error appending divider to history:', e);
        }
    };

    function addMessage(text, sender, shouldScroll = true, allowBlurFade = false) {
        const chatMode = getChatMode();
        const msg = document.createElement('div');
        msg.className = `message ${sender}-message`;
        
        if (sender === 'ai' && text && text.includes("I'm afraid I can't help with that. Do you have any questions or requests related to your music?")) {
            msg.classList.add('error-message');
        }
        
        const aiMessageCount = messageList.querySelectorAll('.ai-message').length;
        const isFirstAiMessage = sender === 'ai' && aiMessageCount === 0;
        const shouldShowBlurFade = allowBlurFade && isFirstAiMessage && (chatMode === 'saved_songs' || chatMode === 'new_songs');
        
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
        
        const shouldPersist =
            !suppressHistoryUpdate &&
            typeof text === 'string' &&
            text.trim() !== '';

        if (shouldPersist) {
            const messageData = {
                role: sender === 'ai' ? 'model' : 'user',
                parts: [{ text }]
            };
            updateChatHistoryData(chatMode, messageData);
        }

        if (shouldShowBlurFade) {
            const triggerAnimation = () => {
                const overlay = msg.querySelector('.background-overlay');
                const content = msg.querySelector('.blur-fade-combo');
                if (overlay) overlay.classList.add('fade-out');
                if (content) content.classList.add('focused');
            };

            const delay = initialMessageDelayNeeded ? 1500 : 350;
            initialMessageDelayNeeded = false;
            
            const container = document.querySelector('.container');
            if (container && container.classList.contains('loaded')) {
                setTimeout(triggerAnimation, delay);
            } else {
                const handleContainerLoad = () => {
                    setTimeout(triggerAnimation, delay);
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
    }

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

            if (data.chat_mode && data.chat_mode !== getChatMode()) {
                console.log(`Ignoring response for '${data.chat_mode}' mode as current mode is '${getChatMode()}'.`);
                return; 
            }

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
        thinkingMsgElement.classList.add('thinking-message');
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
                body: JSON.stringify({message: text, chat_mode: getChatMode()})
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

    const segmentButtons = document.querySelectorAll('.segment-button');
    segmentButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (modeSwitchCooldown) return;

            modeSwitchCooldown = true;
            segmentButtons.forEach(btn => {
                btn.style.pointerEvents = 'none';
            });
            setTimeout(() => {
                modeSwitchCooldown = false;
                segmentButtons.forEach(btn => {
                    btn.style.pointerEvents = '';
                });
            }, 250);

            if (document.querySelector('.thinking-message')) {
                alert("Aria's still thinking! Let her finish.");
                return;
            }
            const newMode = this.dataset.mode;
            switchChatMode(newMode);
        });
    });

    function setActiveSegment(mode) {
        const buttons = document.querySelectorAll('.segment-button');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    function switchChatMode(newMode) {
        const chatMode = newMode;
        sessionStorage.setItem('chatMode', chatMode);
        setActiveSegment(chatMode);
        document.body.dataset.chatMode = chatMode;
        if (isChatModeInitialized(chatMode)) {
            renderHistory(chatMode);
        } else {
            initializeChatMode(chatMode);
        }
    }

    function isChatModeInitialized(mode) {
        const el = document.getElementById('chat-history-data');
        if (!el) return false;

        let payload;
        try {
            payload = JSON.parse(el.textContent || '[]');
        } catch {
            return false;
        }

        if (Array.isArray(payload) && payload.length === 3 && payload.every(Array.isArray)) {
            const indexMap = {new_songs: 0, saved_songs: 1, analysis: 2};
            const idx = indexMap[mode];
            if (idx == null) return false;
            const arr = payload[idx];
            return Array.isArray(arr) && arr.length > 0;
        }

        return false;
    }

    function renderHistory(mode) {
        while (messageList.firstChild) {
            messageList.removeChild(messageList.firstChild);
        }

        const chatHistoryDataElement = document.getElementById('chat-history-data');
        if (chatHistoryDataElement) {
            try {
                const allChatHistory = JSON.parse(chatHistoryDataElement.textContent);
                
                if (!Array.isArray(allChatHistory) || allChatHistory.length !== 3 || !allChatHistory.every(Array.isArray)) {
                    console.error("Invalid chat history format");
                    return;
                }
                
                const indexMap = {new_songs: 0, saved_songs: 1, analysis: 2};
                const modeIndex = indexMap[mode];
                if (modeIndex == null) {
                    console.error("Invalid chat mode:", mode);
                    return;
                }
                
                const history = allChatHistory[modeIndex];
                
                if (Array.isArray(history) && history.length > 0) {
                    const lastDividerIndex = history.map(m => m.role).lastIndexOf('divider');

                    suppressHistoryUpdate = true;

                    history.forEach((message, index) => {
                        if (message.role && message.parts && message.parts[0] && message.parts[0].text) {
                            if (message.role === 'divider') {
                                const dividerElement = document.createElement('div');
                                dividerElement.className = 'conversation-divider';
                                messageList.appendChild(dividerElement);
                                return;
                            }
                            const sender = message.role === 'model' ? 'ai' : 'user';
                            const messageElement = addMessage(message.parts[0].text, sender, false, false);

                            if (lastDividerIndex !== -1 && index < lastDividerIndex) {
                                messageElement.classList.add('previous-conversation');
                            }
                            
                            if (mode === 'analysis' && sender === 'ai') {
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

                    suppressHistoryUpdate = false;

                    if (mode === 'analysis') {
                        let analysisScrollThreshold = 3;
                        if (history.length > analysisScrollThreshold) {
                            setTimeout(() => {
                                scrollToBottomImmediate();
                            }, 0);
                        }
                    } else if (mode === 'new_songs' || mode === 'saved_songs') {
                        setTimeout(() => {
                            scrollToBottomImmediate();
                        }, 0);
                    }

                    userInput.disabled = sendButton.disabled = false;
                    userInput.focus();
                }
            } catch (e) {
                console.error("Could not parse chat history:", e);
                addMessage("Sorry, there was an error loading your chat history.", 'ai');
            }
        }
    }

    function initializeChatMode(mode) {
        while (messageList.firstChild) messageList.removeChild(messageList.firstChild);
        userInput.disabled = true;
        sendButton.disabled = true;

        let initialAnalysisTaskId = null;
        let loadingIndicator = null;
        let loadingInterval = null;

        if (mode === 'analysis') {
            if (window.crypto?.randomUUID) {
                initialAnalysisTaskId = window.crypto.randomUUID();
            } else {
                initialAnalysisTaskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            }
            const prev = suppressHistoryUpdate;
            suppressHistoryUpdate = true;
            const baseText = "Welcome! I'm fetching your Spotify library and preparing your musical analysis. This might take a moment";
            loadingIndicator = addMessage(baseText + "...", 'ai', true, false);
            let dotCount = 3;
            loadingInterval = setInterval(() => {
                dotCount = (dotCount % 3) + 1;
                if (loadingIndicator) loadingIndicator.textContent = baseText + '.'.repeat(dotCount);
            }, 400);
            suppressHistoryUpdate = prev;
        } else if (mode === 'saved_songs') {
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
                    addMessage(initialMessage, 'ai', false, true);
                }
            }, 100);
        } else if (mode === 'new_songs') {
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
                    addMessage(initialMessage, 'ai', false, true);
                }
            }, 100);
        }

        fetch('/initialize_chat_data/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({chat_mode: mode})
        })
        .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const err = data.error || `Initialization error: ${response.status}`;
                throw new Error(err);
            }

            if (data.chat_mode !== getChatMode()) {
                console.log(`Ignoring initialization response for '${data.chat_mode}' mode as current mode is '${getChatMode()}'.`);
                return;
            }

            if (mode === 'analysis') {
                if (data.already_initialized) {
                    if (loadingIndicator) loadingIndicator.remove();
                    if (loadingInterval) clearInterval(loadingInterval);
                    const firstMsgs = Array.isArray(data.first_ai_message) ? data.first_ai_message : [];
                    for (const msg of firstMsgs) addMessage(msg, 'ai', false, false);
                    userInput.disabled = sendButton.disabled = false;
                    userInput.focus();
                } else if (data.analysis_started && initialAnalysisTaskId) {
                    if (initialAnalysisEventSource) {
                        console.log('Initial analysis EventSource already open');
                        return;
                    }

                    const es = new EventSource(`/stream_initial_analysis/${initialAnalysisTaskId}/`);
                    initialAnalysisEventSource = es;

                    es.onmessage = (e) => {
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);

                        const payload = JSON.parse(e.data);
                        const history = payload.response;
                        if (Array.isArray(history)) {
                            history.forEach(message => {
                                if (message.role === 'model' && message.parts?.[0]?.text) {
                                    addMessage(message.parts[0].text, 'ai', false, false);
                                }
                            });
                        }
                        es.close();
                        initialAnalysisEventSource = null;

                        userInput.disabled = sendButton.disabled = false;
                        userInput.focus();
                    };

                    es.addEventListener('stream_error', (e) => {
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);
                        const errorData = JSON.parse(e.data);
                        addMessage('Sorry, an error occurred while processing your request. Please refresh the page and try again.', 'ai');
                        console.error('Stream error:', errorData.message);
                        es.close();
                        initialAnalysisEventSource = null;
                    });

                    es.onerror = () => {
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);
                        addMessage('Sorry, a connection error occurred while fetching your analysis. Please refresh the page and try again.', 'ai');
                        es.close();
                        initialAnalysisEventSource = null;
                    };
                } else {
                    if (loadingIndicator) loadingIndicator.remove();
                    if (loadingInterval) clearInterval(loadingInterval);
                    addMessage('Sorry, something went wrong starting your analysis. Please refresh the page and try again.', 'ai');
                }
            } else if (mode === 'saved_songs' || mode === 'new_songs') {
                if (data.error) {
                    console.error(`Initialization failed: ${data.error}`);
                    addMessage('Sorry, there was a problem initializing the chat. Please refresh the page and try again.', 'ai');
                } else if (Array.isArray(data.first_ai_message)) {
                    data.first_ai_message.slice(1).forEach(messageText => {
                        addMessage(messageText, 'ai', false, true);
                    });
                }
                userInput.disabled = sendButton.disabled = false;
                userInput.focus();
            }
        })
        .catch((error) => {
            if (loadingIndicator) loadingIndicator.remove();
            if (loadingInterval) clearInterval(loadingInterval);
            console.error("Initialization error:", error);
            addMessage('Sorry, there was a problem initializing the chat. Please refresh the page and try again.', 'ai');
        });
    }
});