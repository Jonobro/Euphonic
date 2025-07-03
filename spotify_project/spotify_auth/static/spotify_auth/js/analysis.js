document.addEventListener('DOMContentLoaded', () => {
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
        messageList.scrollTo({ top: messageList.scrollHeight });
    };

    const addMessage = (text, sender, shouldScroll = true) => {
        const msg = document.createElement('div');
        msg.className = `message ${sender}-message`;
        if (window.marked && window.DOMPurify) {
            try {
                const dirtyHtml = marked.parse(text || '');
                msg.innerHTML = DOMPurify.sanitize(dirtyHtml, { ADD_ATTR: ['target'] });
            }
            catch { msg.textContent = text; }
        } else {
            msg.textContent = text;
        }
        messageList.append(msg);
        if (shouldScroll) {
            scrollToBottom();
        }
        return msg;
    };

    const listenForResponse = (taskId, thinkingMsgElement, userMessageElement, thinkingInterval) => {
        const eventSource = new EventSource(`/stream_chat_response/${taskId}/`);

        const cleanup = () => {
            clearInterval(thinkingInterval);
            eventSource.close();
            if (thinkingMsgElement) thinkingMsgElement.remove();
            userInput.disabled = sendButton.disabled = false;
            userInput.focus();
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.response) {
                addMessage(data.response, 'ai', false);
                userMessageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        
        const thinkingMsgElement = addMessage('Thinking.', 'ai'); 
        let dotCount = 1;
        const thinkingInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            thinkingMsgElement.textContent = 'Thinking' + '.'.repeat(dotCount);
        }, 400);

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
            listenForResponse(task_id, thinkingMsgElement, userMessageElement, thinkingInterval);

        } catch (e) {
            clearInterval(thinkingInterval);
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

    if (isInitiallyLoading) {
        const loadingIndicatorBaseText = "Welcome! I'm fetching your Spotify library and preparing your initial analysis. This might take a moment";
        const loadingIndicator = addMessage(loadingIndicatorBaseText + "...", 'ai');
        userInput.disabled = sendButton.disabled = true;
        let dotCount = 3;
        const loadingInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            if (loadingIndicator) {
                loadingIndicator.textContent = loadingIndicatorBaseText + '.'.repeat(dotCount);
            }
        }, 400);

        fetch('/initialize_music_analysis_data_view/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Content-Type': 'application/json' 
            },
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
            clearInterval(loadingInterval);
            if (loadingIndicator) loadingIndicator.remove();
            if (data.error) {
                addMessage(`Initialization failed: ${data.error}`, 'ai');
            } else if (Array.isArray(data.analysis_result)) {
                let lastMessageElement;
                (async () => {
                    for (const messageText of data.analysis_result) {
                        lastMessageElement = addMessage(messageText, 'ai', true);
                        await new Promise(resolve => setTimeout(resolve, 750)); 
                    }
                    if (lastMessageElement) {
                        lastMessageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                })();
            }
            messageList.removeAttribute('data-is-loading-initial');
        })
        .catch(error => {
            clearInterval(loadingInterval);
            if (loadingIndicator) loadingIndicator.remove();
            addMessage('Sorry, there was a problem initializing the chat. Please refresh the page to try again.', 'ai');
            console.error("Initialization error:", error);
        })
        .finally(() => {
            clearInterval(loadingInterval);
            userInput.disabled = sendButton.disabled = false;
            if (!isInitiallyLoading || (document.activeElement !== userInput && userInput.value === '')) {
                 userInput.focus();
            }
        });
    } else {
        const chatHistoryDataElement = document.getElementById('chat-history-data');
        if (chatHistoryDataElement) {
            try {
                const history = JSON.parse(chatHistoryDataElement.textContent);
                if (Array.isArray(history)) {
                    history.forEach(message => {
                        if (message.role && message.parts && message.parts[0] && message.parts[0].text) {
                            const sender = message.role === 'model' ? 'ai' : 'user';
                            addMessage(message.parts[0].text, sender);
                        }
                    });
                }
            } catch (e) {
                console.error("Could not parse chat history:", e);
                addMessage("Sorry, there was an error loading your chat history.", 'ai');
            }
        }
    }
    
    scrollToBottom();

    const tooltip = document.querySelector('.custom-tooltip');
    const tooltipContainer = document.querySelector('.tooltip-container');
    
    if (tooltip && tooltipContainer) {
        tooltipContainer.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
        });
    }
});