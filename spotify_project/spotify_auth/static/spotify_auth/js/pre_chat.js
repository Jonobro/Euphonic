document.addEventListener('DOMContentLoaded', function() {
    const optionButtons = document.querySelectorAll('.option-button');

    optionButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const action = this.getAttribute('data-action');
            const url = this.getAttribute('href');
            window.location.href = `${url}?action=${action}`;
        });
    });
});