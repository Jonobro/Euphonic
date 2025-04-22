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
        const res = await fetch('/chat/', {
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
        
        const thinkingMsgElement = addMessage('...', 'ai'); 

        try {
            const reply = await sendMessageToBackend(text);
            if (thinkingMsgElement) thinkingMsgElement.remove(); 
            addMessage(reply, 'ai');
        } catch (e) {
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

    const initial = messageList.dataset.initialMessage;
    if (initial) {
        try { addMessage(JSON.parse(`"${initial}"`), 'ai'); }
        catch { addMessage(initial, 'ai'); }
    }
    scrollToBottom();
});