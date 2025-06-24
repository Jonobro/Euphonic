document.addEventListener('DOMContentLoaded', () => {
    const sendButton = document.getElementById('send-button');
    const userInput  = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

    if (window.marked) {
        marked.setOptions({ gfm: true, breaks: true, headerIds: false, mangle: false, smartLists: true, smartypants: true });
    }

    const scrollToBottom = () => {
        messageList.scrollTo({ top: messageList.scrollHeight });
    };

    const addMessage = (text, sender) => {
        const msg = document.createElement('div');
        msg.className = `message ${sender}-message`;
        if (window.marked && window.DOMPurify) {
            try { msg.innerHTML = DOMPurify.sanitize(marked.parse(text || '')); }
            catch { msg.textContent = text; }
        } else {
            msg.textContent = text;
        }
        messageList.append(msg);
        scrollToBottom();
        return msg;
    };

    const sendMessageToBackend = async (message) => {
        const res = await fetch('/chat_message_api/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ message })
        });
        if (!res.ok) {
            const err = (await res.json().catch(() => ({}))).error || `Server error: ${res.status}`;
            throw new Error(err);
        }
        return (await res.json()).response;
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

        addMessage(text, 'user');
        userInput.value = '';
        userInput.disabled = sendButton.disabled = true;
        
        const thinkingMsgElement = addMessage('Thinking.', 'ai'); 
        let dotCount = 1;
        const thinkingInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            thinkingMsgElement.textContent = 'Thinking' + '.'.repeat(dotCount);
        }, 400);

        try {
            const reply = await sendMessageToBackend(text);
            clearInterval(thinkingInterval);
            if (thinkingMsgElement) thinkingMsgElement.remove(); 
            addMessage(reply, 'ai');
        } catch (e) {
            clearInterval(thinkingInterval);
            if (thinkingMsgElement) thinkingMsgElement.remove(); 
            addMessage(`Sorry, ${e.message}`, 'ai');
        } finally {
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

        fetch('/initialize_chat_data/', {
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
            } else if (data.analysis_result) {
                addMessage(data.analysis_result, 'ai');
            }
            messageList.removeAttribute('data-is-loading-initial');
        })
        .catch(error => {
            clearInterval(loadingInterval);
            if (loadingIndicator) loadingIndicator.remove();
            addMessage(`Sorry, an error occurred during initialization: ${error.message}`, 'ai');
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