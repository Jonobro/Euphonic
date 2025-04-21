document.addEventListener('DOMContentLoaded', function() {
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');

    // safely grab CSRF token (won't blow up if the input isn't there)
    const csrfInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    const csrfToken = csrfInput ? csrfInput.value : null;

    // Configure marked options for better Markdown rendering
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            gfm: true,                // GitHub Flavored Markdown
            breaks: true,             // Convert \n to <br>
            headerIds: false,         // Don't add IDs to headers
            mangle: false,            // Don't mangle email addresses
            smartLists: true,         // Use smarter list behavior
            smartypants: true         // Use "smart" typographic punctuation
        });
    }

    const initialAiMessageDiv = document.getElementById('initial-ai-message');

    // --- Process Initial AI Message ---
    if (initialAiMessageDiv && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        try {
            // use textContent to pull in the raw markdown from Django
            const rawMarkdown = initialAiMessageDiv.textContent.trim();
            
            // Debug: check what we're actually getting
            console.log("Raw initial markdown:", rawMarkdown);
            
            const rawHtml = marked.parse(rawMarkdown);
            const safeHtml = DOMPurify.sanitize(rawHtml);
            
            // Debug: check what HTML we're generating
            console.log("Processed HTML:", safeHtml);
            
            initialAiMessageDiv.innerHTML = safeHtml;
        } catch (error) {
            console.error("Error processing initial AI message:", error);
            initialAiMessageDiv.innerHTML = "<p>Error displaying initial analysis. Please refresh.</p>";
        }
    } else if (initialAiMessageDiv) {
        console.warn("Libraries not loaded: marked available?", typeof marked !== 'undefined', 
                    "DOMPurify available?", typeof DOMPurify !== 'undefined');
    }
    // --- End Process Initial AI Message ---

    // Function to add a message to the chat display
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

        if (sender === 'ai' && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            try {
                // Debug: check what we're actually getting
                console.log("Raw markdown from response:", text);
                
                const rawHtml = marked.parse(text);
                const safeHtml = DOMPurify.sanitize(rawHtml);
                
                // Debug: check what HTML we're generating
                console.log("Processed HTML:", safeHtml);
                
                messageDiv.innerHTML = safeHtml;
            } catch (error) {
                console.error("Error parsing AI message:", error);
                messageDiv.textContent = text;
            }
        } else if (sender === 'ai') {
            console.warn("Libraries not loaded when processing AI message");
            messageDiv.textContent = text;
        } else {
            const p = document.createElement('p');
            p.textContent = text;
            messageDiv.appendChild(p);
        }

        messageList.appendChild(messageDiv);
        // Scroll after adding the message
        messageList.scrollTop = messageList.scrollHeight;
    }

    // --- Send message to backend ---
    async function sendMessageToBackend(message) {
        const url = '/chat/'; // <-- UPDATE THIS URL to match urls.py

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Include CSRF token
                },
                body: JSON.stringify({ message: message }) // Send message in JSON body
            });

            if (!response.ok) {
                // Handle HTTP errors (e.g., 400, 401, 500)
                const errorData = await response.json().catch(() => ({})); // Try to parse error JSON
                console.error(`HTTP error ${response.status}:`, errorData);
                throw new Error(`Server responded with status ${response.status}. ${errorData.error || ''}`);
            }

            const data = await response.json();
            return data.response; // Return the AI's response text

        } catch (error) {
            console.error("Error sending message to backend:", error);
            // Re-throw the error to be caught by handleSendMessage
            throw error;
        }
    }
    // --- End Send message to backend ---

    // Handle sending a message
    async function handleSendMessage() {
        const messageText = userInput.value.trim();
        if (messageText) {
            // Display user message immediately
            addMessage(messageText, 'user');
            userInput.value = ''; // Clear input field
            userInput.style.height = 'auto'; // Reset height after clearing

            // Disable input/button during processing
            userInput.disabled = true;
            sendButton.disabled = true;
            addMessage("...", 'ai'); // Optional: Add a temporary thinking indicator
            const thinkingMessage = messageList.lastElementChild; // Get reference to thinking indicator

            try {
                // Send message to backend and get AI response
                const aiResponse = await sendMessageToBackend(messageText);
                if (thinkingMessage && thinkingMessage.textContent === "...") {
                    messageList.removeChild(thinkingMessage); // Remove thinking indicator
                }
                addMessage(aiResponse, 'ai');
            } catch (error) {
                if (thinkingMessage && thinkingMessage.textContent === "...") {
                    messageList.removeChild(thinkingMessage); // Remove thinking indicator
                }
                console.error("Error sending message:", error);
                const errorMessage = error.message.includes('Server responded')
                    ? `Sorry, there was an issue: ${error.message.split(': ')[1] || 'Please try again.'}`
                    : "Sorry, I couldn't get a response. Please check your connection and try again.";
                addMessage(errorMessage, 'ai'); // Add error message as an AI message
            } finally {
                // Re-enable input/button
                userInput.disabled = false;
                sendButton.disabled = false;
                userInput.focus(); // Set focus back to input
                // Ensure textarea resizes correctly after being disabled/enabled
                userInput.dispatchEvent(new Event('input'));
            }
        }
    }

    // Event listener for the send button
    sendButton.addEventListener('click', handleSendMessage);

    // Event listener for pressing Enter in the textarea
    userInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Initial scroll to bottom (ensure it runs after initial message processing)
    // Use a small timeout to allow the browser to render the potentially updated initial message height
    setTimeout(() => {
        messageList.scrollTop = messageList.scrollHeight;
    }, 0);
});
