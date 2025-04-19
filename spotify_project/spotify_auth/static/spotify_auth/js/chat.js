document.addEventListener('DOMContentLoaded', function() {
    const sendButton = document.getElementById('send-button');
    const userInput = document.getElementById('user-input');
    const messageList = document.getElementById('message-list');
    // Get CSRF token from the hidden input added in the template
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    // Function to add a message to the chat display
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
        
        const messageP = document.createElement('p');
        messageP.textContent = text; // Use textContent for security
        
        messageDiv.appendChild(messageP);
        messageList.appendChild(messageDiv);
        
        // Scroll to the bottom
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

            // TODO: Add a loading indicator here if desired
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
                // Display a more specific error if available from the backend
                const errorMessage = error.message.includes('Server responded')
                    ? `Sorry, there was an issue: ${error.message.split(': ')[1] || 'Please try again.'}`
                    : "Sorry, I couldn't get a response. Please check your connection and try again.";
                addMessage(errorMessage, 'ai');
            } finally {
                // TODO: Remove loading indicator here
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
        // Check if Enter key is pressed without the Shift key
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default newline behavior
            handleSendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto'; // Reset height
        this.style.height = (this.scrollHeight) + 'px'; // Set to scroll height
    });

    // Initial scroll to bottom (in case initial message makes it scrollable)
    messageList.scrollTop = messageList.scrollHeight;
});
