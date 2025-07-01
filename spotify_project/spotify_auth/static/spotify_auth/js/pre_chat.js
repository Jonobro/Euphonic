document.addEventListener('DOMContentLoaded', function() {
    const optionButtons = document.querySelectorAll('.option-button');

    optionButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const mode = this.getAttribute('data-mode');
            const url = this.getAttribute('href');
            window.location.href = `${url}?mode=${mode}`;
        });
    });
});