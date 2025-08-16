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
    const MAX_TOKENS_ERROR = "Aria thought so hard she lost her train of thought. Please resend your message.";

    let suppressHistoryUpdate = false;
    let initialAnalysisEventSource = null;
    let modeSwitchCooldown = false;

    function shouldShowActionPlaceholder() {
        const aiMessages = document.querySelectorAll('.ai-message.has-playlist-button');
        for (const msg of aiMessages) {
            if (msg.querySelector('.secondary-button')) return true;
        }
        return false;
    }

    function updateChatInputPlaceholder() {
        if (!userInput) return;
        if (userInput.disabled) {
            if (shouldShowActionPlaceholder()) {
                userInput.placeholder = 'Please select an option above to continue...';
            } else {
                userInput.placeholder = '';
            }
        } else {
            userInput.placeholder = 'Reply to Aria...';
        }
    }

    function toggleChatInput(disable) {
        if (userInput) {
            userInput.disabled = disable;
            updateChatInputPlaceholder();
        }
        if (sendButton) {
            sendButton.disabled = disable;
            if (disable) {
                sendButton.classList.add('disabled-no-hover');
            } else {
                sendButton.classList.remove('disabled-no-hover');
            }
        }
    }
    window.toggleChatInput = toggleChatInput;
    window.updateChatInputPlaceholder = updateChatInputPlaceholder;
    window.shouldShowActionPlaceholder = shouldShowActionPlaceholder;

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

    function scrollToTopImmediate() {
        messageList.scrollTop = 0;
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

            const delay = initialMessageDelayNeeded ? 1100 : 450;
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

    function addEphemeralMessage(text, sender='ai', allowBlurFade=false) {
        const prev = suppressHistoryUpdate;
        suppressHistoryUpdate = true;
        addMessage(text, sender, true, allowBlurFade);
        suppressHistoryUpdate = prev;
    }

    window.addMessageAndScroll = (text, sender) => {
        const newMessage = addMessage(text, sender, false);
        newMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    
    const listenForResponse = (taskId, thinkingMsgElement, userMessageElement) => {
        const eventSource = new EventSource(`/stream_chat_response/${taskId}/`);

        function removeLastUserMessageFromHistory() {
            const el = document.getElementById('chat-history-data');
            if (!el) return;
            const indexMap = { new_songs: 0, saved_songs: 1, analysis: 2 };
            const mode = getChatMode();
            const idx = indexMap[mode];
            if (idx == null) return;

            let all;
            try { all = JSON.parse(el.textContent || '[]'); } catch { return; }
            
            const arr = all?.[idx];
            if (!Array.isArray(arr) || arr.length === 0) return;

            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i]?.role === 'user') {
                    arr.splice(i, 1);
                    el.textContent = JSON.stringify(all);
                    break;
                }
            }
        }

        const cleanup = () => {
            eventSource.close();
            if (thinkingMsgElement) thinkingMsgElement.remove();
            toggleChatInput(false);
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
                        removeLastUserMessageFromHistory();
                        addEphemeralMessage(`Sorry, I had a problem with your request. Please resend your message.`, 'ai');
                    }
                } else {
                    if (data.response && data.response.trim() !== '') {
                        addMessage(data.response, 'ai', false);
                    } else {
                        removeLastUserMessageFromHistory();
                        addEphemeralMessage(`Sorry, I had a problem with your request. Please resend your message.`, 'ai');
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
                removeLastUserMessageFromHistory();
                addEphemeralMessage(`Sorry, I had a problem with your request. Please resend your message.`, 'ai');
            }
            cleanup();
        };

        eventSource.addEventListener('stream_error', (event) => {
            let serverMsg = null;
            try {
                const data = JSON.parse(event.data);
                serverMsg = data.message;
                if (serverMsg === "Invalid model response") {
                    console.error('Server error:', serverMsg);
                }
            } catch (e) {
                console.error('Stream error (parse failed):', e);
            }
            const fallback = `Sorry, I had a problem with your request. Please resend your message.`;
            removeLastUserMessageFromHistory();
            addEphemeralMessage(serverMsg === MAX_TOKENS_ERROR ? serverMsg : fallback, 'ai');
            cleanup();
        });

        eventSource.onerror = (err) => {
            removeLastUserMessageFromHistory();
            addEphemeralMessage(`Sorry, I had a problem with your request. Please resend your message.`, 'ai');
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
        toggleChatInput(true);
        
        const thinkingMsgElement = addMessage('', 'ai');
        thinkingMsgElement.classList.add('thinking-message');
        thinkingMsgElement.innerHTML = `
            <div class="thinking-message-contents">
                <svg class="thinking-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23.812 23.813" role="img" aria-label="Loading">
                    <g id="layer1" fill="none">
                        <g class="spin-ccw delay-33">
                            <path d="M17.686 11.906a.647.647 0 0 1-.647.646.647.647 0 0 1-.647-.646.647.647 0 0 1 .647-.647.647.647 0 0 1 .647.647z" style="fill:#1ec85a;stroke:#000;stroke-width:0"/>
                            <path d="M16.392 11.906v.011a4.87 4.87 0 0 1-1.412 3.4 4.87 4.87 0 0 1-3.404 1.405 4.87 4.87 0 0 1-3.4-1.413 4.87 4.87 0 0 1-1.403-3.279 5.53 5.53 0 0 0 1.597 3.735 5.52 5.52 0 0 0 3.86 1.6 5.52 5.52 0 0 0 3.859-1.6 5.52 5.52 0 0 0 1.599-3.859z" style="fill:#1ec85a;fill-opacity:1;stroke:#000;stroke-width:0"/>
                        </g>
                        <g class="spin-cw delay-67">
                            <path d="M8.571 11.906a.373.373 0 0 0 .373.373.373.373 0 0 0 .374-.373.373.373 0 0 0-.374-.373.373.373 0 0 0-.373.373z" style="fill:#1ec85a;stroke:#000;stroke-width:0"/>
                            <path d="M9.317 11.906v.007c.001.726.301 1.448.816 1.962a2.8 2.8 0 0 0 1.964.81 2.8 2.8 0 0 0 1.962-.815c.496-.498.791-1.19.81-1.892a3.2 3.2 0 0 1-.922 2.155 3.2 3.2 0 0 1-2.227.923c-.825 0-1.644-.34-2.227-.923a3.2 3.2 0 0 1-.923-2.227z" style="fill:#1ec85a;fill-opacity:1;stroke:#000;stroke-width:0"/>
                        </g>
                        <g class="spin-cw">
                            <path d="M2.97 11.905a1 1 0 0 0 1 1 1 1 0 0 0 1-1 1 1 0 0 0-1-1 1 1 0 0 0-1 1z" style="fill:#1ec85a;stroke:#000;stroke-width:0"/>
                            <path d="M4.97 11.906v.017a7.53 7.53 0 0 0 2.185 5.257 7.53 7.53 0 0 0 5.262 2.172 7.53 7.53 0 0 0 5.256-2.185 7.53 7.53 0 0 0 2.17-5.069 8.55 8.55 0 0 1-2.469 5.775 8.54 8.54 0 0 1-5.967 2.472c-2.21 0-4.405-.91-5.968-2.472a8.54 8.54 0 0 1-2.472-5.967Z" style="fill:#1ec85a;fill-opacity:1;stroke:#000;stroke-width:0"/>
                        </g>
                        <path d="M13.084 11.906a1.18 1.18 0 0 1-1.178 1.178 1.18 1.18 0 0 1-1.178-1.178 1.18 1.18 0 0 1 1.178-1.178 1.18 1.18 0 0 1 1.178 1.178" style="fill:#1ec85a;stroke:#000;stroke-width:0"/>
                        <path d="M22.411 11.906a10.505 10.505 0 0 1-10.505 10.505A10.505 10.505 0 0 1 1.401 11.906 10.505 10.505 0 0 1 11.906 1.401a10.505 10.505 0 0 1 10.505 10.505Z" style="stroke:#1ec85a;stroke-width:1.47958;fill:none"/>
                    </g>
                </svg>
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
            addEphemeralMessage(`Sorry, something went wrong. Please try again.`, 'ai');
            console.error('Chat send error:', e);
            toggleChatInput(false);
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
                        } else {
                            setTimeout(() => {
                                scrollToTopImmediate();
                            }, 0);
                        }
                    } else if (mode === 'new_songs' || mode === 'saved_songs') {
                        setTimeout(() => {
                            scrollToBottomImmediate();
                        }, 0);
                    }

                    toggleChatInput(false);
                    userInput.focus();
                }
            } catch (e) {
                console.error("Could not parse chat history:", e);
                addEphemeralMessage(`Sorry, there was an error loading your chat history. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
            }
        }
    }

    function initializeChatMode(mode) {
        while (messageList.firstChild) messageList.removeChild(messageList.firstChild);
        toggleChatInput(true);

        let initialAnalysisTaskId = null;
        let loadingIndicator = null;
        let loadingInterval = null;

        if (mode === 'analysis') {
            if (window.crypto?.randomUUID) {
                initialAnalysisTaskId = window.crypto.randomUUID();
            } else {
                initialAnalysisTaskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            }
            const baseText = "Welcome! I'm preparing your musical analysis. This might take a moment";
            setTimeout(() => {
                if (messageList.querySelectorAll('.message').length === 0) {
                    const prev = suppressHistoryUpdate;
                    suppressHistoryUpdate = true;
                    loadingIndicator = addMessage(baseText + "...", 'ai', true, false);
                    loadingIndicator.classList.add('fade-in-analysis-message');
                    let dotCount = 3;
                    loadingInterval = setInterval(() => {
                        dotCount = (dotCount % 3) + 1;
                        if (loadingIndicator) loadingIndicator.textContent = baseText + '.'.repeat(dotCount);
                    }, 400);
                    suppressHistoryUpdate = prev;
                }
            }, 300);
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
            }, 0);
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
            }, 0);
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
                    const FAILURE_MARKER = "Failed to generate analysis.";
                    if (firstMsgs.some(m => typeof m === 'string' && m.includes(FAILURE_MARKER))) {
                        addEphemeralMessage(`Whoops - your musical analysis failed. Please click the three dots (...) and select "Reset" to try again. You will need to reattach your Spotify playlists.`, 'ai');
                        toggleChatInput(true);
                        return;
                    }
                    for (const msg of firstMsgs) addMessage(msg, 'ai', false, false);
                    toggleChatInput(false);
                    userInput.focus();
                } else if (data.analysis_started && initialAnalysisTaskId) {
                    if (initialAnalysisEventSource) {
                        console.log('Initial analysis EventSource already open');
                        return;
                    }

                    const es = new EventSource(`/stream_initial_analysis/${initialAnalysisTaskId}/`);
                    initialAnalysisEventSource = es;

                    es.onmessage = (e) => {
                        if (getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);

                        const payload = JSON.parse(e.data);
                        const history = payload.response;
                        const FAILURE_MARKER = "Failed to generate analysis.";
                        if (Array.isArray(history) && history.some(message => message?.parts?.[0]?.text?.includes(FAILURE_MARKER))) {
                            addEphemeralMessage(`Whoops - your musical analysis failed. Please click the three dots (...) and select "Reset" to try again. You will need to reattach your Spotify playlists.`, 'ai');
                            toggleChatInput(true);
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        if (Array.isArray(history)) {
                            history.forEach(message => {
                                if (message.role === 'model' && message.parts?.[0]?.text) {
                                    addMessage(message.parts[0].text, 'ai', false, false);
                                }
                            });
                        }
                        es.close();
                        initialAnalysisEventSource = null;

                        toggleChatInput(false);
                        userInput.focus();
                    };

                    es.addEventListener('stream_error', (e) => {
                        if (getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);
                        const errorData = JSON.parse(e.data);
                        addEphemeralMessage(`Sorry, an error occurred while processing your request. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                        console.error('Stream error:', errorData.message);
                        es.close();
                        initialAnalysisEventSource = null;
                    });

                    es.onerror = () => {
                        if (getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        if (loadingIndicator) loadingIndicator.remove();
                        if (loadingInterval) clearInterval(loadingInterval);
                        addEphemeralMessage(`Sorry, a connection error occurred while fetching your analysis. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                        es.close();
                        initialAnalysisEventSource = null;
                    };
                } else {
                    if (loadingIndicator) loadingIndicator.remove();
                    if (loadingInterval) clearInterval(loadingInterval);
                    addEphemeralMessage(`Sorry, something went wrong starting your analysis. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                }
            } else if (mode === 'saved_songs' || mode === 'new_songs') {
                if (data.error) {
                    console.error(`Initialization failed: ${data.error}`);
                    addEphemeralMessage(`Sorry, there was a problem initializing the chat. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                } else if (Array.isArray(data.first_ai_message)) {
                    // Only add intro message if it wasn't already rendered by the front end
                    const aiMessages = messageList.querySelectorAll('.ai-message');
                    if (aiMessages.length === 0 && data.first_ai_message.length > 0) {
                        addMessage(data.first_ai_message[0], 'ai', false, false);
                    }
                }
                toggleChatInput(false);
                userInput.focus();
            }
        })
        .catch((error) => {
            if (loadingIndicator) loadingIndicator.remove();
            if (loadingInterval) clearInterval(loadingInterval);
            console.error("Initialization error:", error);
            addEphemeralMessage(`Sorry, there was a problem initializing the chat. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
        });
    }

    (function initSegmentedControlAnimation() {
        const control = document.querySelector('.segmented-control');
        const canvas = document.getElementById('segment-animation-canvas');
        if (!control || !canvas) return;
        const ctx = canvas.getContext('2d');
        const buttons = Array.from(control.querySelectorAll('.segment-button'));

        let isAnimating = false;

        function resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const rect = control.getBoundingClientRect();
            canvas.width = (rect.width + CANVAS_PAD*2) * dpr;
            canvas.height = (rect.height + CANVAS_PAD*2) * dpr;
            ctx.setTransform(1,0,0,1,0,0);
            ctx.scale(dpr, dpr);
            canvas.style.width = (rect.width + CANVAS_PAD*2) + 'px';
            canvas.style.height = (rect.height + CANVAS_PAD*2) + 'px';
            canvas.style.position = 'absolute';
            canvas.style.top = -CANVAS_PAD + 'px';
            canvas.style.left = -CANVAS_PAD + 'px';
            control.style.overflow = 'visible';
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const cfg = { dotSpeed: 0.1 /* Revised from dotSpeed: 0.8 for testing */, glowColor: 'rgb(30,200,90)', /* glowBlur: 8 */ dotRadius: 4, lineWidth: 2 };
        const CANVAS_PAD = cfg.dotRadius + cfg.lineWidth + 4;
        const easing = { easeInCubic: t => t*t*t, easeOutCubic: t => 1 - Math.pow(1-t,3) };
        ctx.lineJoin = 'round';

        function animateTransition(fromBtn, toBtn, done) {
            if (isAnimating || !fromBtn || !toBtn || fromBtn === toBtn) { done && done(); return; }
            isAnimating = true;
            control.classList.add('is-animating');

            const fromRect = relRect(fromBtn);
            const toRect = relRect(toBtn);
            const fromIdx = buttons.indexOf(fromBtn);
            const toIdx = buttons.indexOf(toBtn);
            const direction = toIdx > fromIdx ? 'forward' : 'reverse';

            const fromPath = roundedRectPath(fromRect);
            const toPath = roundedRectPath(toRect);
            const eraseDuration = fromPath.totalLength / cfg.dotSpeed;
            const paintDuration = toPath.totalLength / cfg.dotSpeed;

            fromBtn.classList.remove('active');
            fromBtn.classList.add('was-active');

            runPathAnimation(fromPath, 'erase', direction, eraseDuration)
                .then(() => runTravel(fromBtn, toBtn))
                .then(() => runPathAnimation(toPath, 'paint', direction, paintDuration))
                .then(() => {
                    toBtn.classList.add('active');
                    requestAnimationFrame(() => {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        fromBtn.classList.remove('was-active');
                        control.classList.remove('is-animating');
                        isAnimating = false;
                        done && done();
                    });
                });
        }

        function runTravel(fromBtn, toBtn) {
            return new Promise(res => {
                const cRect = relRect(control, true);
                const cPath = roundedRectPath(cRect);
                const fRect = relRect(fromBtn);
                const tRect = relRect(toBtn);
                const startPt = { x: fRect.x + fRect.width/2, y: fRect.y + fRect.height + cfg.lineWidth };
                const endPt   = { x: tRect.x + tRect.width/2, y: tRect.y + tRect.height + cfg.lineWidth };
                const startProg = progressOnPath(cPath, startPt);
                const endProg = progressOnPath(cPath, endPt);
                const distF = (endProg - startProg + 1) % 1;
                const distB = (startProg - endProg + 1) % 1;
                const travelFrac = Math.min(distF, distB);
                const dir = distF < distB ? 1 : -1;
                const travelPx = travelFrac * cPath.totalLength;
                const duration = travelPx / 0.3; /* Revised from 2.4 for testing */
                let start = null;
                function frame(ts) {
                    if (!start) start = ts;
                    const elapsed = ts - start;
                    const raw = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
                    ctx.clearRect(0,0,canvas.width,canvas.height);
                    const pathProg = (startProg + travelFrac * raw * dir + 1) % 1;
                    const pos = pointOnPath(cPath, pathProg);
                    drawDot(pos.x, pos.y);
                    if (raw < 1) requestAnimationFrame(frame); else res();
                }
                requestAnimationFrame(frame);
            });
        }

        function runPathAnimation(orig, type, direction, duration) {
            return new Promise(res => {
                let path = orig;
                if (direction === 'reverse') {
                    path = { ...orig, points: [...orig.points].reverse(), lengths: [...orig.lengths].reverse() };
                }
                let start = null;
                function frame(ts) {
                    if (!start) start = ts;
                    const elapsed = ts - start;
                    const raw = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
                    const eased = type === 'erase' ? easing.easeInCubic(raw) : easing.easeOutCubic(raw);
                    ctx.clearRect(0,0,canvas.width,canvas.height);
                    ctx.lineWidth = cfg.lineWidth;
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = cfg.glowColor;
                    // ctx.shadowColor = cfg.glowColor; // glow disabled
                    // ctx.shadowBlur = cfg.glowBlur; // glow disabled
                    if (type === 'erase') {
                        drawFullPath(path.points);
                        erasePortion(path, eased);
                    } else {
                        paintPortion(path, eased);
                    }
                    const pos = pointOnPath(path, eased);
                    drawDot(pos.x, pos.y);
                    if (raw < 1) requestAnimationFrame(frame); else res();
                }
                requestAnimationFrame(frame);
            });
        }

        function drawDot(x,y){
            ctx.beginPath();
            ctx.arc(x,y,cfg.dotRadius,0,Math.PI*2);
            ctx.fillStyle=cfg.glowColor;
            ctx.fill();
            // ctx.shadowBlur=0; // not needed while glow disabled
        }
        function drawFullPath(pts){ ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); }
        function paintPortion(path, prog){
            const target = path.totalLength * prog;
            ctx.beginPath(); ctx.moveTo(path.points[0].x, path.points[0].y);
            let acc=0;
            for(let i=1;i<path.points.length;i++){
                const seg = path.lengths[i-1];
                if (acc + seg > target){
                    const rem = target - acc;
                    const r = rem / seg;
                    ctx.lineTo(path.points[i-1].x + (path.points[i].x - path.points[i-1].x)*r,
                               path.points[i-1].y + (path.points[i].y - path.points[i-1].y)*r);
                    break;
                }
                ctx.lineTo(path.points[i].x, path.points[i].y);
                acc += seg;
            }
            ctx.stroke();
        }
        function erasePortion(path, prog){
            ctx.save();
            ctx.globalCompositeOperation='destination-out';
            ctx.lineWidth = cfg.lineWidth + 2;
            const target = path.totalLength * prog;
            ctx.beginPath(); ctx.moveTo(path.points[0].x, path.points[0].y);
            let acc=0;
            for(let i=1;i<path.points.length;i++){
                const seg = path.lengths[i-1];
                if (acc + seg > target){
                    const rem = target - acc;
                    const r = rem / seg;
                    ctx.lineTo(path.points[i-1].x + (path.points[i].x - path.points[i-1].x)*r,
                               path.points[i-1].y + (path.points[i].y - path.points[i-1].y)*r);
                    break;
                }
                ctx.lineTo(path.points[i].x, path.points[i].y);
                acc += seg;
            }
            ctx.stroke();
            ctx.restore();
        }
        function pointOnPath(path, prog){
            const target = path.totalLength * prog;
            let acc=0;
            for(let i=1;i<path.points.length;i++){
                const seg = path.lengths[i-1];
                if (acc + seg >= target){
                    const rem = target - acc;
                    const r = seg ? rem / seg : 0;
                    return {
                        x: path.points[i-1].x + (path.points[i].x - path.points[i-1].x)*r,
                        y: path.points[i-1].y + (path.points[i].y - path.points[i-1].y)*r
                    };
                }
                acc += seg;
            }
            return path.points[path.points.length-1];
        }
        function roundedRectPath(r){
            let {x,y,width,height,radius} = r;
            const maxR = Math.min(width, height) / 2;
            radius = Math.min(Math.max(0, radius), maxR);

            const pts = [];
            const lengths = [];
            const stepsPerQuarter = 18;
            function addArc(cx, cy, startAng, endAng){
                for (let i=1;i<=stepsPerQuarter;i++){
                    const t=i/stepsPerQuarter;
                    const ang=startAng + (endAng-startAng)*t;
                    pts.push({ x: cx + radius*Math.cos(ang), y: cy + radius*Math.sin(ang) });
                }
            }

            pts.push({ x: x + width/2, y: y + height });
            pts.push({ x: x + width - radius, y: y + height });
            addArc(x + width - radius, y + height - radius, Math.PI/2, 0);
            pts.push({ x: x + width, y: y + radius });
            addArc(x + width - radius, y + radius, 0, -Math.PI/2);
            pts.push({ x: x + radius, y: y });
            addArc(x + radius, y + radius, -Math.PI/2, -Math.PI);
            pts.push({ x: x, y: y + height - radius });
            addArc(x + radius, y + height - radius, -Math.PI, -Math.PI*1.5);
            pts.push({ x: x + width/2, y: y + height });
            let total=0;
            for (let i=0;i<pts.length-1;i++){
                const dx=pts[i+1].x-pts[i].x, dy=pts[i+1].y-pts[i].y;
                const len=Math.hypot(dx,dy);
                lengths.push(len);
                total += len;
            }
            return { points: pts, lengths, totalLength: total };
        }
        function progressOnPath(path, point){
            let best=0,bestDist=Infinity,acc=0;
            for(let i=0;i<path.points.length-1;i++){
                const p1=path.points[i],p2=path.points[i+1];const seg=path.lengths[i];
                if (!seg){acc+=seg;continue;}
                const dx=p2.x-p1.x, dy=p2.y-p1.y;
                let t=((point.x-p1.x)*dx+(point.y-p1.y)*dy)/(seg*seg);
                t=Math.max(0,Math.min(1,t));
                const cx=p1.x+t*dx, cy=p1.y+t*dy;
                const dist=(point.x-cx)**2+(point.y-cy)**2;
                if (dist<bestDist){bestDist=dist;best=(acc + t*seg)/path.totalLength;}
                acc+=seg;
            }
            return best;
        }
        function relRect(el,isContainer=false){
            const parent = control.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            const radius = parseFloat(getComputedStyle(buttons[0]).borderRadius)||20;
            const inset = cfg.lineWidth/2;
            const offset = CANVAS_PAD;
            if (isContainer) {
                return {
                    x: inset + offset,
                    y: inset + offset,
                    width: rect.width - inset*2,
                    height: rect.height - inset*2,
                    radius: radius - inset
                };
            }
            return {
                x: rect.left - parent.left + inset + offset,
                y: rect.top - parent.top + inset + offset,
                width: rect.width - inset*2,
                height: rect.height - inset*2,
                radius: radius - inset
            };
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                if (isAnimating || modeSwitchCooldown || this.classList.contains('active')) return;
                if (document.querySelector('.thinking-message')) {
                    alert("Aria's still thinking! Let her finish.");
                    return;
                }
                const fromBtn = document.querySelector('.segment-button.active');
                const toBtn = this;
                modeSwitchCooldown = true;
                buttons.forEach(b => b.style.pointerEvents='none');

                animateTransition(fromBtn, toBtn, () => {
                    switchChatMode(toBtn.dataset.mode);
                    setTimeout(() => {
                        modeSwitchCooldown = false;
                        buttons.forEach(b => b.style.pointerEvents='');
                    }, 200);
                });
            }, { capture: true });
        });
    })();
});