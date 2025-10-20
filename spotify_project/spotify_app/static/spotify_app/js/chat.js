let initialMessageDelayNeeded = true;

async function handleNewContextAction(userAction) {
    const chatMode = window.getChatMode();
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

            if (data.chat_mode && data.chat_mode !== window.getChatMode()) {
                console.log(`Ignoring playlist action response for '${data.chat_mode}' mode as current mode is '${window.getChatMode()}'.`);
                return;
            }

            if (data.success && data.initial_response) {
                const allMessages = messageList.querySelectorAll('.message');
                allMessages.forEach(message => { message.classList.add('previous-conversation'); });

                (function replaceTerminationMessage() {
                    const terminationMessages = Array.from(messageList.querySelectorAll('.ai-message.long-convo-termination-options'));
                    if (!terminationMessages.length) return;
                    const last = terminationMessages[terminationMessages.length - 1];
                    last.textContent = '~ New Conversation Started ~';
                    last.classList.add('previous-termination-message');
                })();

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
    }
}
window.handleNewContextAction = handleNewContextAction;

function createSecondaryActionsContainer(buttonOne, buttonTwo) {
    const secondaryActionsContainer = document.createElement('div');
    secondaryActionsContainer.className = 'additional-buttons-container';

    if (typeof buttonOne === 'string' && buttonOne.trim() !== '') {
        const firstButton = document.createElement('button');
        firstButton.className = 'button secondary-playlist-button';
        firstButton.textContent = buttonOne;
        firstButton.addEventListener('click', () => handleNewContextAction('revise_playlist'));
        secondaryActionsContainer.appendChild(firstButton);
    }

    if (typeof buttonTwo === 'string' && buttonTwo.trim() !== '') {
        const secondButton = document.createElement('button');
        secondButton.className = 'button secondary-playlist-button';
        secondButton.textContent = buttonTwo;
        secondButton.addEventListener('click', () => handleNewContextAction('create_another_playlist'));
        secondaryActionsContainer.appendChild(secondButton);
    }

    return secondaryActionsContainer;
}
window.createSecondaryActionsContainer = createSecondaryActionsContainer;

document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInput  = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    const MAX_TOKENS_ERROR = "Aria thought so hard she lost her train of thought. Please resend your message.";
    const HIGH_TRAFFIC_ERROR = "We are currently experiencing high traffic and were unable to process your message. Please try again in a bit.";
    const LONG_CONVO_MSG = "Sorry, but this conversation is getting too long. Select one of the following options to give me a clean slate.";
    window.LONG_CONVO_MSG = LONG_CONVO_MSG;
    const LONG_CONVO_DISPLAY_MSG = 'This conversation is dragging on for too long. Save your playlists and then click the three dots (...) and select "Reset" to give me a clean slate.';
    window.LONG_CONVO_DISPLAY_MSG = LONG_CONVO_DISPLAY_MSG;
    const EMPTY_PLAYLIST_ERROR = "Uh oh – I wasn't able to find any tracks that I felt sufficiently matched your criteria. Please revise your prompt and try again.";
    window.EMPTY_PLAYLIST_ERROR = EMPTY_PLAYLIST_ERROR;

    const clearStorageDataElement = document.getElementById('clear-storage-data');
    if (clearStorageDataElement) {
        const shouldClearStorage = JSON.parse(clearStorageDataElement.textContent);
        if (shouldClearStorage) {
            try {
                localStorage.clear();
                sessionStorage.clear();
                console.log("Browser storage cleared during reset.");
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {
                console.error("Failed to clear browser storage:", e);
            }
        }
    }

    let suppressHistoryUpdate = false;
    let initialAnalysisEventSource = null;
    let analysisLoadingIndicator = null;
    let analysisLoadingInterval = null;

    window.resetAnalysisLoadingUI = function(newMode) {
        try {
            if (analysisLoadingInterval) {
                clearInterval(analysisLoadingInterval);
                analysisLoadingInterval = null;
            }
        } catch {}
        try {
            if (analysisLoadingIndicator) {
                analysisLoadingIndicator.remove();
                analysisLoadingIndicator = null;
            }
        } catch {}
        try {
            if (initialAnalysisEventSource && newMode !== 'analysis') {
                initialAnalysisEventSource.close();
                initialAnalysisEventSource = null;
            }
        } catch {}
    };

    const DISABLED_STATE_KEY = 'chatInputDisabledModes';

    function loadDisabledState() {
        try { return JSON.parse(localStorage.getItem(DISABLED_STATE_KEY)) || {}; }
        catch { return {}; }
    }

    function saveDisabledState(map) {
        try { localStorage.setItem(DISABLED_STATE_KEY, JSON.stringify(map)); } catch {}
    }

    let ariaIntroInProgress = false;
    const pendingEphemeralMessages = [];
    
    function setModeDisabledPersist(mode, disabled) {
        const map = loadDisabledState();
        if (disabled) {
            map[mode] = true;
        } else {
            delete map[mode];
        }
        saveDisabledState(map);
    }

    function isModePersistentlyDisabled(mode) {
        const map = loadDisabledState();
        return !!map[mode];
    }

    function showAriaIntroSplash(done) {
        const introText1 = "Hey, I’m Aria.";
        const introText2 = "Here to help you craft your perfect playlist.";
        if (sessionStorage.getItem('ariaIntroShown')) {
            done && done();
            return;
        }
        sessionStorage.setItem('ariaIntroShown', '1');
        document.body.classList.add('aria-intro-active');
        ariaIntroInProgress = true;

        const splashContainer = document.createElement('div');
        splashContainer.className = 'aria-intro-splash';

        const text1 = document.createElement('div');
        text1.className = 'aria-intro-text';
        text1.textContent = introText1;

        const text2 = document.createElement('div');
        text2.className = 'aria-intro-text';
        text2.textContent = introText2;

        splashContainer.appendChild(text1);
        splashContainer.appendChild(text2);

        const container = document.querySelector('.container');
        container.appendChild(splashContainer);

        const h = text1.getBoundingClientRect().height;
        splashContainer.style.height = h + 'px';

        const showText = (el, delay=0) => setTimeout(() => {
            el.classList.add('show');
            el.classList.remove('hide');
        }, delay);

        const hideText = (el, delay=0) => setTimeout(() => {
            el.classList.remove('show');
            el.classList.add('hide');
        }, delay);

        function startIntro() {
            const step1 = 1450;
            const step2 = 2900;
            const step3 = 7500;

            showText(text1, step1);
            setTimeout(() => {
                hideText(text1, 0);
                showText(text2, 1200);
            }, step1 + step2);
            setTimeout(() => {
                hideText(text2, 0);
                setTimeout(() => {
                    splashContainer.remove();
                    document.body.classList.remove('aria-intro-active');
                    ariaIntroInProgress = false;
                    if (pendingEphemeralMessages.length) {
                        const toFlush = pendingEphemeralMessages.splice(0);
                        toFlush.forEach(({ text, sender, allowBlurFade }) => {
                            addEphemeralMessage(text, sender, allowBlurFade);
                        });
                    }
                    done && done();
                }, 850);
            }, step1 + step3);
        }

        if (container.classList.contains('loaded')) {
            startIntro();
        } else {
            const onTransitionEnd = (e) => {
                if (e.target === container && container.classList.contains('loaded')) {
                    container.removeEventListener('transitionend', onTransitionEnd);
                    startIntro();
                }
            };
            container.addEventListener('transitionend', onTransitionEnd);

            setTimeout(() => {
                if (!splashContainer.dataset.started) {
                    splashContainer.dataset.started = '1';
                    startIntro();
                }
            }, 2500);
        }
    }

    function shouldShowActionPlaceholder() {
        const aiMessages = document.querySelectorAll('.ai-message.has-playlist-button');
        for (const msg of aiMessages) {
            if (msg.querySelector('.secondary-playlist-button')) return true;
        }
        return false;
    }

    function updateChatInputPlaceholder() {
        if (!userInput) return;

        const chatInputArea = document.getElementById('chat-input-area');
        let overlay = document.getElementById('chat-input-overlay');

        if (userInput.disabled) {
            if (shouldShowActionPlaceholder()) {
                userInput.placeholder = '';
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'chat-input-overlay';
                    overlay.className = 'chat-input-overlay';
                    overlay.textContent = 'Please select an option above to continue';
                    chatInputArea.appendChild(overlay);
                }
                setTimeout(() => {
                    overlay.classList.add('visible');
                    chatInputArea.classList.add('overlay-active');
                }, 0);
            } else {
                userInput.placeholder = '';
                if (overlay) {
                    overlay.classList.remove('visible');
                }
                chatInputArea.classList.remove('overlay-active');
            }
        } else {
            userInput.placeholder = 'Reply to Aria...';
            if (overlay) {
                overlay.classList.remove('visible');
            }
            chatInputArea.classList.remove('overlay-active');
        }
    }

    function showAnalysisLoadingIndicator({ forceReplace = false } = {}) {
        const baseText = "I have your tracks and I’m analyzing them. This might take a moment";
        if (analysisLoadingInterval) {
            clearInterval(analysisLoadingInterval);
            analysisLoadingInterval = null;
        }
        if (analysisLoadingIndicator) {
            analysisLoadingIndicator.remove();
            analysisLoadingIndicator = null;
        }
        if (forceReplace) {
            while (messageList.firstChild) {
                messageList.removeChild(messageList.firstChild);
            }
        }
        const prev = suppressHistoryUpdate;
        suppressHistoryUpdate = true;
        analysisLoadingIndicator = addMessage(baseText + "...", 'ai', true, false);
        analysisLoadingIndicator.classList.add('fade-in-analysis-message');
        let dotCount = 3;
        analysisLoadingInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            if (analysisLoadingIndicator) {
                analysisLoadingIndicator.textContent = baseText + '.'.repeat(dotCount);
            }
        }, 400);
        suppressHistoryUpdate = prev;
    }

    function updateSendButtonCursor() {
        if (!sendButton || !userInput) return;
        const hasText = userInput.value.trim().length > 0;
        sendButton.classList.toggle('no-text', !hasText && !sendButton.disabled);
    }
    userInput.addEventListener('input', updateSendButtonCursor);
    updateSendButtonCursor();

    function toggleChatInput(disable, opts = {}) {
        const { persist = false } = opts;
        const mode = (() => { try { return window.getChatMode(); } catch { return null; } })();

        if (userInput) {
            if (disable && document.activeElement === userInput) {
                try { userInput.blur(); } catch (_) {}
            }
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
        updateSendButtonCursor();

        if (persist && mode) {
            setModeDisabledPersist(mode, disable);
        }
    }
    window.toggleChatInput = toggleChatInput;
    window.updateChatInputPlaceholder = updateChatInputPlaceholder;
    window.shouldShowActionPlaceholder = shouldShowActionPlaceholder;

    (() => {
        const start = () => window.switchChatMode(sessionStorage.getItem('chatMode') || 'new_songs');
        setTimeout(start, 0);
    })();
    
    if (window.marked) {
        const renderer = new window.marked.Renderer();
        const originalLinkRenderer = renderer.link;
        renderer.link = (href, title, text) => {
            const link = originalLinkRenderer.call(renderer, href, title, text);
            return link.replace(/^<a/, '<a target="_blank" rel="noopener noreferrer"');
        };

        window.marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false,
            smartLists: true,
            smartypants: true,
            renderer: renderer
        });
    }
    
    const DOMPURIFY_CONFIG = {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input', 'svg', 'math', 'foreignObject'],
        FORBID_ATTR: [
            'onerror','onload','onclick','onmouseover','onfocus','onblur','onmouseenter','onmouseleave',
            'onpointerover','onpointerenter','onpointerleave','onpointerdown','onpointerup','onwheel',
            'xlink:href','style'
        ],
        ADD_ATTR: ['target', 'rel'],
        ALLOW_DATA_ATTR: false,
        ALLOWED_URI_REGEXP: /^https:/i
    };
    
    function renderMarkdownSafe(text) {
        if (window.marked && window.DOMPurify) {
            try {
                const dirtyHtml = window.marked.parse(text || '');
                return window.DOMPurify.sanitize(dirtyHtml, DOMPURIFY_CONFIG);
            } catch {
                return null;
            }
        }
        return null;
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
            return '\\u' + ('0000' + hex).slice(-4);
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
            const mode = window.getChatMode();
            updateChatHistoryData(mode, { role: 'divider', parts: [{ text: '---' }] });
        } catch (e) {
            console.error('Error appending divider to history:', e);
        }
    };

    function addMessage(text, sender, shouldScroll = true, allowBlurFade = false) {
        const chatMode = window.getChatMode();
        const msg = document.createElement('div');
        msg.className = `message ${sender}-message`;
        
        const aiMessageCount = messageList.querySelectorAll('.ai-message').length;
        const isFirstAiMessage = sender === 'ai' && aiMessageCount === 0;
        const shouldShowBlurFade = allowBlurFade && isFirstAiMessage && (chatMode === 'saved_songs' || chatMode === 'new_songs');
        
        if (shouldShowBlurFade) {
            msg.classList.add('blur-fade-container');
            const contentDiv = document.createElement('div');
            contentDiv.className = 'blur-fade-combo';
            msg.appendChild(contentDiv);
            
            const safeHtml = renderMarkdownSafe(text);
            if (safeHtml != null) {
                contentDiv.innerHTML = safeHtml;
            } else {
                contentDiv.textContent = text;
            }

            let transitionFired = false;
            const handleTransitionEnd = (e) => {
                if (e.target === contentDiv &&
                    e.propertyName === 'opacity' &&
                    contentDiv.classList.contains('focused')) {
                    transitionFired = true;
                    toggleChatInput(false);
                    if (window.matchMedia('(min-width: 769px)').matches) {
                        userInput?.focus();
                    }
                    contentDiv.removeEventListener('transitionend', handleTransitionEnd);
                }
            };
            contentDiv.addEventListener('transitionend', handleTransitionEnd);

            setTimeout(() => {
                if (!transitionFired && contentDiv.classList.contains('focused') && userInput && userInput.disabled) {
                    toggleChatInput(false);
                    if (window.matchMedia('(min-width: 769px)').matches) {
                        userInput.focus();
                    }
                }
            }, 1500);
        } else {
            const safeHtml = renderMarkdownSafe(text);
            if (safeHtml != null) {
                msg.innerHTML = safeHtml;
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
                const content = msg.querySelector('.blur-fade-combo');
                if (content) content.classList.add('focused');
            };

            const delay = initialMessageDelayNeeded ? 650 : 450;
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
        if (ariaIntroInProgress) {
            pendingEphemeralMessages.push({ text, sender, allowBlurFade });
            return;
        }
        const prev = suppressHistoryUpdate;
        suppressHistoryUpdate = true;
        addMessage(text, sender, true, allowBlurFade);
        suppressHistoryUpdate = prev;
    }
    window.addEphemeralMessage = addEphemeralMessage;

    window.addMessageAndScroll = (text, sender, { suppressPersist = false } = {}) => {
        const prev = suppressHistoryUpdate;
        if (suppressPersist) suppressHistoryUpdate = true;
        const newMessage = addMessage(text, sender, false);
        suppressHistoryUpdate = prev;
        
        setTimeout(() => {
            const messageTop = newMessage.offsetTop - messageList.offsetTop;
            const contentHeight = messageList.scrollHeight;
            const viewHeight = messageList.clientHeight;
            if (contentHeight - messageTop <= viewHeight) {
                scrollToBottom();
            } else {
                messageList.scrollTo({
                    top: messageTop,
                    behavior: 'smooth'
                });
            }
        }, 10);
        
        return newMessage;
    };

    function hasDuplicatePlaylistTitlesInResponse(resp) {
        const texts = Array.isArray(resp)
            ? resp.filter(t => typeof t === 'string')
            : (typeof resp === 'string' ? [resp] : []);
        if (!texts.length) return false;
        let totalSets = 0;
        for (const text of texts) {
            let i = 0;
            const n = text.length;
            while (i < n) {
                if (text.charCodeAt(i) === 43) {
                    let j = i + 1;
                    while (j < n && text.charCodeAt(j) === 43) j++;
                    const runLen = j - i;
                    totalSets += Math.floor(runLen / 5);
                    if (totalSets > 2) return true;
                    i = j;
                } else {
                    i++;
                }
            }
        }
        return totalSets > 2;
    }
    
    const listenForResponse = (taskId, thinkingMsgElement, userMessageElement) => {
        const eventSource = new EventSource(`/stream_chat_response/${taskId}/`);

        function removeLastUserMessageFromHistory() {
            const el = document.getElementById('chat-history-data');
            if (!el) return;
            const indexMap = { new_songs: 0, saved_songs: 1, analysis: 2 };
            const mode = window.getChatMode();
            const idx = indexMap[mode];
            if (idx == null) return;

            let all;
            try { all = JSON.parse(el.textContent || '[]'); } catch { return; }
            
            const arr = all?.[idx];
            if (!Array.isArray(arr) || arr.length === 0) return;

            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i]?.role === 'user') {
                    arr.splice(i, 1);
                    el.textContent = escapeNonAscii(JSON.stringify(all));
                    break;
                }
            }
        }

        const cleanup = () => {
            eventSource.close();
            if (thinkingMsgElement) thinkingMsgElement.remove();
            toggleChatInput(false);
            if (window.matchMedia('(min-width: 769px)').matches) {
                userInput.focus();
            }
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.chat_mode && data.chat_mode !== window.getChatMode()) {
                console.log(`Ignoring response for '${data.chat_mode}' mode as current mode is '${window.getChatMode()}'.`);
                return; 
            }

            if (data.response) {
                if (hasDuplicatePlaylistTitlesInResponse(data.response)) {
                    removeLastUserMessageFromHistory();
                    addEphemeralMessage(`Sorry, I had a problem with your request. Please resend your message.`, 'ai');
                    cleanup();
                    return;
                }

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
                    const userTop = userMessageElement.offsetTop - messageList.offsetTop;
                    const contentHeight = messageList.scrollHeight;
                    const viewHeight = messageList.clientHeight;
                    if (contentHeight - userTop <= viewHeight) {
                        scrollToBottom();
                    } else {
                        messageList.scrollTo({
                            top: userTop,
                            behavior: 'smooth'
                        });
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
            const KNOWN_ERROR_MESSAGES = [MAX_TOKENS_ERROR, HIGH_TRAFFIC_ERROR, EMPTY_PLAYLIST_ERROR];
            if (KNOWN_ERROR_MESSAGES.includes(serverMsg)) {
                addEphemeralMessage(serverMsg, 'ai');
            } else {
                addEphemeralMessage(fallback, 'ai');
            }
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
        const maxWords = 500;
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
                body: JSON.stringify({message: text, chat_mode: window.getChatMode()})
            });

            if (!res.ok) {
                const err = (await res.json().catch(() => ({}))).error || `Server error: ${res.status}`;
                throw new Error(err);
            }

            const data = await res.json();
            if (data && data.message === LONG_CONVO_MSG) {
                if (thinkingMsgElement) thinkingMsgElement.remove();
                const aiMsgEl = addMessage(LONG_CONVO_MSG, 'ai', true, false);
                if (aiMsgEl && window.createSecondaryActionsContainer) {
                    const hasPlaylistInDom = !!document.querySelector('.ai-message.has-playlist-button');
                    const firstButtonLabel = hasPlaylistInDom ? "Revise Last Playlist" : "";
                    const actions = window.createSecondaryActionsContainer(firstButtonLabel, "Create New Playlist");
                    aiMsgEl.classList.add('long-convo-termination-options');
                    aiMsgEl.appendChild(actions);
                    toggleChatInput(true);
                }
                return;
            }

            if (data && data.message === LONG_CONVO_DISPLAY_MSG) {
                if (thinkingMsgElement) thinkingMsgElement.remove();
                addMessage(LONG_CONVO_DISPLAY_MSG, 'ai', true, false);
                toggleChatInput(true, { persist: true });
                return;
            }

            const {task_id} = data;
            listenForResponse(task_id, thinkingMsgElement, userMessageElement);

        } catch (e) {
            if (thinkingMsgElement) thinkingMsgElement.remove();
            const errMsg = (e && (e.message || (typeof e === 'string' ? e : ''))) || '';
            if (errMsg.includes(HIGH_TRAFFIC_ERROR)) {
                addEphemeralMessage(HIGH_TRAFFIC_ERROR, 'ai');
            } else {
                addEphemeralMessage(`Sorry, something went wrong. Please try again later.`, 'ai');
            }
            console.error('Chat send error:', e);
            toggleChatInput(false);
            if (window.matchMedia('(min-width: 769px)').matches) {
                userInput.focus();
            }
        }
    };

    sendButton.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    function forceResetAnalysis(reinitIfActive = true) {
        try {
            const el = document.getElementById('chat-history-data');
            if (el) {
                let all = JSON.parse(el.textContent || '[[],[],[]]');
                if (!Array.isArray(all) || all.length !== 3) all = [[], [], []];
                all[2] = [];
                el.textContent = JSON.stringify(all);
            }
        } catch (e) {
            console.error('forceResetAnalysis: failed to clear cached analysis history');
        }

        if (initialAnalysisEventSource) {
            try {
                initialAnalysisEventSource.close();
            } catch (e) {
                console.error('forceResetAnalysis: failed to close EventSource');
            }
            initialAnalysisEventSource = null;
        }
        if (analysisLoadingInterval) {
            clearInterval(analysisLoadingInterval);
            analysisLoadingInterval = null;
        }
        if (analysisLoadingIndicator) {
            analysisLoadingIndicator.remove();
            analysisLoadingIndicator = null;
        }

        const currentMode = window.getChatMode();
        if (reinitIfActive && currentMode === 'analysis') {
            toggleChatInput(true);
            initializeChatMode('analysis');
        }
    }
    window.forceResetAnalysis = forceResetAnalysis;

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
    window.isChatModeInitialized = isChatModeInitialized;

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

                    const hasPlaylistInHistory = history.some(m =>
                        m?.role === 'model' &&
                        m?.parts?.[0]?.text &&
                        m.parts[0].text.includes('+++++')
                    );

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
                            
                            if (sender === 'ai' && message.parts[0].text === LONG_CONVO_MSG) {
                                if (index < lastDividerIndex) {
                                    messageElement.innerHTML = '';
                                    messageElement.textContent = '~ New Conversation Started ~';
                                    messageElement.classList.add('previous-termination-message');
                                } else if (window.createSecondaryActionsContainer && !messageElement.querySelector('.additional-buttons-container')) {
                                    const firstButtonLabel = hasPlaylistInHistory ? "Revise Last Playlist" : "";
                                    const actions = window.createSecondaryActionsContainer(firstButtonLabel, "Create New Playlist");
                                    messageElement.classList.add('long-convo-termination-options');
                                    messageElement.appendChild(actions);
                                }
                            }

                            if (mode === 'saved_songs') {
                                const msgTxt = (message.parts && message.parts[0] && typeof message.parts[0].text === 'string') ? message.parts[0].text.trim() : '';
                                if (msgTxt === '~ Music Collection Updated & New Conversation Started ~' || msgTxt === '~ Music Updated & New Chat Started ~') {
                                    messageElement.classList.add('music-collection-updated-message');
                                }
                            }

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

                    const hasTerminationMessage = !!messageList.querySelector('.long-convo-termination-options');

                    if (hasTerminationMessage || isModePersistentlyDisabled(mode)) {
                        toggleChatInput(true);
                    } else {
                        toggleChatInput(false);
                        if (window.matchMedia('(min-width: 769px)').matches) {
                            userInput.focus();
                        }
                    }
                }
            } catch (e) {
                console.error("Could not parse chat history:", e);
                addEphemeralMessage(`Sorry, there was an error loading your chat history. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
            }
        }
    }
    window.renderHistory = renderHistory;

    function initializeChatMode(mode) {
        while (messageList.firstChild) messageList.removeChild(messageList.firstChild);
        toggleChatInput(true);

        if (mode === 'analysis') {
            setTimeout(() => {
                if (!analysisLoadingIndicator && window.getChatMode() === 'analysis' && messageList.querySelectorAll('.message').length === 0) {
                    showAnalysisLoadingIndicator({ forceReplace: false });
                }
            }, 300);
        } else if (mode === 'saved_songs') {
            const initialMessage = `Cool – you got some music imported. Let’s craft some custom playlists using your tracks. I can filter through your music using any criteria you can imagine. You could say:

* Make a playlist of all my songs from the 90s
* Make me a playlist of my most niche tracks
* Create a playlist of all of the dream pop songs in my imported music
* I’m on a road trip with my grandma – make a playlist of my songs that she might like
* Playlist of my most uplifting songs
* Make a playlist of all my songs that are sung in Spanish`;
            setTimeout(() => {
                const existingMessages = messageList.querySelectorAll('.message');
                if (existingMessages.length === 0) {
                    const el = addMessage(initialMessage, 'ai', false, true);
                    el.classList.add('initial-mode-message');
                }
            }, 0);
        } else if (mode === 'new_songs') {
            const initialMessage = `Let’s get to it. What kind of playlist can I make for you? I can handle requests like:

* Make a playlist of songs released in 2014
* Playlist of chill lo-fi beats for studying
* Make me a playlist with songs by Drake, Kendrick Lamar, and J. Cole
* Road trip anthems to sing along to
* Playlist of songs that tell a complete story
* Create a playlist of cover songs that became more famous than the originals
* Give me a playlist of international songs that blew up in the US`;

            const injectInitial = () => {
                setTimeout(() => {
                    const existingMessages = messageList.querySelectorAll('.message');
                    if (existingMessages.length === 0) {
                        const el = addMessage(initialMessage, 'ai', false, true);
                        el.classList.add('initial-mode-message');
                    }
                }, 0);
            };

            if (!sessionStorage.getItem('ariaIntroShown')) {
                showAriaIntroSplash(injectInitial);
            } else {
                injectInitial();
            }
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

            if (data.chat_mode && data.chat_mode !== window.getChatMode()) {
                console.log(`Ignoring initialization response for '${data.chat_mode}' mode as current mode is '${window.getChatMode()}'.`);
                return;
            }

            if (mode === 'analysis') {
                if (data.already_initialized) {
                    if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
                    if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }
                    const firstMsgs = Array.isArray(data.first_ai_message) ? data.first_ai_message : [];
                    const FAILURE_MARKER = "Failed to generate analysis.";
                    if (firstMsgs.some(m => typeof m === 'string' && m.includes(FAILURE_MARKER))) {
                        addEphemeralMessage(`Whoops - your musical analysis failed. Please click the three dots (...) and select "Reset" to try again. You will need to reattach your Spotify playlists.`, 'ai');
                        toggleChatInput(true);
                        return;
                    }
                    for (const msg of firstMsgs) addMessage(msg, 'ai', false, false);
                    toggleChatInput(false);
                    if (window.matchMedia('(min-width: 769px)').matches) {
                        userInput.focus();
                    }
                } else if (data.analysis_started) {
                    if (initialAnalysisEventSource) {
                        console.log('Initial analysis EventSource already open');
                        return;
                    }

                    const es = new EventSource(`/stream_initial_analysis/`);
                    initialAnalysisEventSource = es;

                    es.onmessage = (e) => {
                        if (window.getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }

                        const payload = JSON.parse(e.data);

                        if (payload.status === 'in_progress') {
                            const hasOtherMessages = messageList.querySelectorAll('.message').length > 1;
                            if (!analysisLoadingIndicator || hasOtherMessages) {
                                showAnalysisLoadingIndicator({ forceReplace: true });
                            }
                            return;
                        }

                        if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
                        if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }

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
                        if (window.matchMedia('(min-width: 769px)').matches) {
                            userInput.focus();
                        }
                    };

                    es.addEventListener('stream_error', (e) => {
                        if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
                        if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }
                        if (window.getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        const errorData = JSON.parse(e.data);
                        addEphemeralMessage(`Sorry, an error occurred while processing your request. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                        console.error('Stream error:', errorData.message);
                        es.close();
                        initialAnalysisEventSource = null;
                    });

                    es.onerror = () => {
                        if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
                        if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }
                        if (window.getChatMode() !== 'analysis') {
                            es.close();
                            initialAnalysisEventSource = null;
                            return;
                        }
                        addEphemeralMessage(`Sorry, a connection error occurred while fetching your analysis. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                        es.close();
                        initialAnalysisEventSource = null;
                    };
                } else {
                    if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
                    if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }
                    addEphemeralMessage(`Sorry, something went wrong starting your analysis. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                }
            } else if (mode === 'saved_songs' || mode === 'new_songs') {
                if (data.error) {
                    console.error(`Initialization failed: ${data.error}`);
                    addEphemeralMessage(`Sorry, there was a problem initializing the chat. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
                    const intros = messageList.querySelectorAll('.initial-mode-message');
                    intros.forEach(el => el.remove());
                    toggleChatInput(true);
                }
            }
        })
        .catch((error) => {
            if (analysisLoadingIndicator) { analysisLoadingIndicator.remove(); analysisLoadingIndicator = null; }
            if (analysisLoadingInterval) { clearInterval(analysisLoadingInterval); analysisLoadingInterval = null; }
            console.error("Initialization error:", error);
            addEphemeralMessage(`Sorry, there was a problem initializing the chat. Please refresh the page and try again. If that doesn't fix it, click the three dots (...) and select "Reset" to start over.`, 'ai');
            if (mode === 'saved_songs' || mode === 'new_songs') {
                const intros = messageList.querySelectorAll('.initial-mode-message');
                intros.forEach(el => el.remove());
                toggleChatInput(true);
            }
        });
    }
    window.initializeChatMode = initializeChatMode;
});