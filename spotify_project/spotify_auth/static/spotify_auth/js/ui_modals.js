const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerDropdown = document.getElementById('hamburger-dropdown');

hamburgerBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    hamburgerDropdown.classList.toggle('show');
});

window.addEventListener('click', (event) => {
    if (hamburgerDropdown.classList.contains('show')) {
        hamburgerDropdown.classList.remove('show');
    }
});

function openModal(type) {
    if (hamburgerDropdown.classList.contains('show')) {
        hamburgerDropdown.classList.remove('show');
    }
    const modal = document.getElementById('legalModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    const map = {
        privacy: {title: 'Privacy Policy', tpl: 'privacy-template'},
        eula: {title: 'End-User License Agreement', tpl: 'eula-template'}
    };
    const entry = map[type];
    if (!entry) return;

    title.textContent = entry.title;
    body.innerHTML = document.getElementById(entry.tpl).innerHTML;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('legalModal').style.display = 'none';
}

if (window.pendingModeSwitch === undefined) {
    window.pendingModeSwitch = null;
}

function openImportModal(switchToModeOnCompletion) {
    if (hamburgerDropdown.classList.contains('show')) {
        hamburgerDropdown.classList.remove('show');
    }
    if (switchToModeOnCompletion) {
        window.pendingModeSwitch = switchToModeOnCompletion;
    }
    document.getElementById('importModal').style.display = 'block';
    if (window.playlistImport) {
        window.playlistImport.initialize();
    }
}

function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('legalModal');
    const importModal = document.getElementById('importModal');
    if (event.target == modal) {
        closeModal();
    }
    if (event.target == importModal) {
        closeImportModal();
    }
}