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
    if (window.playlistImport && typeof window.playlistImport.resetPlaylistData === 'function') {
        window.playlistImport.resetPlaylistData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const importMusicLink = document.getElementById('import-music-link');
    if (importMusicLink) {
        importMusicLink.addEventListener('click', (event) => {
            event.preventDefault();
            openImportModal();
        });
    }

    const eulaLink = document.getElementById('eula-link');
    if (eulaLink) {
        eulaLink.addEventListener('click', (event) => {
            event.preventDefault();
            openModal('eula');
        });
    }

    const privacyLink = document.getElementById('privacy-link');
    if (privacyLink) {
        privacyLink.addEventListener('click', (event) => {
            event.preventDefault();
            openModal('privacy');
        });
    }

    const legalModalClose = document.getElementById('legal-modal-close');
    if (legalModalClose) {
        legalModalClose.addEventListener('click', closeModal);
    }

    const importModalClose = document.getElementById('import-modal-close');
    if (importModalClose) {
        importModalClose.addEventListener('click', closeImportModal);
    }

    const importCancelBtn = document.getElementById('import-cancel-btn');
    if (importCancelBtn) {
        importCancelBtn.addEventListener('click', closeImportModal);
    }
});


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