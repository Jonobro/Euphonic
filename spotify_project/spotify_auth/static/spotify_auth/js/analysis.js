document.addEventListener('DOMContentLoaded', function() {
    const scriptData = document.getElementById('analysis-script-data');
    const isLoadingInitial = scriptData.dataset.isLoadingInitial === 'true';
    const initialChatHistory = JSON.parse(scriptData.dataset.chatHistoryJson);
    const initializeChatDataUrl = scriptData.dataset.initializeChatDataUrl;
    
    const analysisContainer = document.getElementById('analysis-container');

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');

    if (isLoadingInitial) {
        analysisContainer.innerHTML = '<p>Analyzing your library... This may take a moment.</p>';
        
        fetch(initializeChatDataUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({})
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                analysisContainer.innerHTML = `<p>Error: ${data.error}</p>`;
            } else {
                // Replace escaped newlines with <br> for HTML display
                analysisContainer.innerHTML = data.analysis_result.replace(/\n/g, '<br>');
            }
        })
        .catch(error => {
            console.error('Error fetching initial analysis:', error);
            analysisContainer.innerHTML = '<p>An error occurred while fetching your analysis. Please try again later.</p>';
        });
    } else {
         if (initialChatHistory.length > 0) {
            const lastMessage = initialChatHistory[initialChatHistory.length - 1];
            if (lastMessage.role === 'model') {
                 analysisContainer.innerHTML = lastMessage.parts[0].text.replace(/\n/g, '<br>');
            }
        }
    }
});