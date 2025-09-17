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
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
        modal.classList.add('open');
    });
}

function closeModal() {
    const modal = document.getElementById('legalModal');
    if (!modal) return;

    modal.classList.remove('open');
    const tidy = () => {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        modal.removeEventListener('transitionend', tidy);
    };
    modal.addEventListener('transitionend', tidy);
}

if (window.pendingModeSwitch === undefined) {
    window.pendingModeSwitch = null;
}

if (window.hasImportedPlaylists === undefined) {
    window.hasImportedPlaylists = false;
}

let _importModalResizeObserver = null;
let _importModalAdjustBound = null;

function adjustImportModalBounds() {
    try {
        const importModal = document.getElementById('importModal');
        if (!importModal || !importModal.classList.contains('open')) return;

        const panel = importModal.querySelector('.import-modal-content');
        const header = document.querySelector('.header-row');
        const list = document.getElementById('message-list');
        if (!panel || !header || !list) return;

        const hr = header.getBoundingClientRect();
        const lr = list.getBoundingClientRect();

        const top = hr.top;
        const left = Math.min(hr.left, lr.left);
        const right = Math.max(hr.right, lr.right);
        const bottom = lr.bottom;

        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);

        panel.style.setProperty('--import-top', `${Math.max(0, top)}px`);
        panel.style.setProperty('--import-left', `${Math.max(0, left)}px`);
        panel.style.setProperty('--import-width', `${width}px`);
        panel.style.setProperty('--import-height', `${height}px`);

        panel.style.setProperty('--import-max-width', 'none');
        panel.style.setProperty('--import-max-height', 'none');
        panel.style.setProperty('--import-margin', '0');

        if (!panel.style.getPropertyValue('--import-transform')) {
            panel.style.setProperty('--import-transform', 'translateY(10px) scale(0.98)');
        }
        if (!panel.style.getPropertyValue('--import-transform-open')) {
            panel.style.setProperty('--import-transform-open', 'translateY(0) scale(1)');
        }
    } catch (_) {}
}

function attachImportModalSizing() {
    if (_importModalAdjustBound) return;
    _importModalAdjustBound = () => adjustImportModalBounds();

    window.addEventListener('resize', _importModalAdjustBound, { passive: true });
    window.addEventListener('scroll', _importModalAdjustBound, { passive: true });

    try {
        const header = document.querySelector('.header-row');
        const list = document.getElementById('message-list');
        if (window.ResizeObserver && header && list) {
            _importModalResizeObserver = new ResizeObserver(_importModalAdjustBound);
            _importModalResizeObserver.observe(header);
            _importModalResizeObserver.observe(list);
        }
    } catch (_) {}
}

function detachImportModalSizing() {
    window.removeEventListener('resize', _importModalAdjustBound || (() => {}));
    window.removeEventListener('scroll', _importModalAdjustBound || (() => {}));
    _importModalAdjustBound = null;

    if (_importModalResizeObserver) {
        try { _importModalResizeObserver.disconnect(); } catch (_) {}
        _importModalResizeObserver = null;
    }

    const panel = document.querySelector('#importModal .import-modal-content');
    if (panel) {
        ['--import-top','--import-left','--import-width','--import-height',
         '--import-max-width','--import-max-height','--import-margin',
         '--import-transform','--import-transform-open']
        .forEach(v => panel.style.removeProperty(v));
    }
}

function setImportUiState() {
    const labelEl = document.querySelector('#import-music-link .dropdown-link-text');
    const tooltipEl = document.querySelector('#import-music-link .dropdown-tooltip');
    const headerEl = document.querySelector('#importModal .modal-header h2');

    if (window.hasImportedPlaylists) {
        if (labelEl) labelEl.textContent = 'Edit Imported Playlists';
        if (tooltipEl) tooltipEl.textContent = 'Manage your previously imported playlists';
        if (headerEl) headerEl.textContent = 'Update Your Imported Playlists';
    } else {
        if (labelEl) labelEl.textContent = 'Import My Music';
        if (tooltipEl) tooltipEl.textContent = 'Import your Spotify music collection to create personalized playlists and gain insights into your music';
        if (headerEl) headerEl.textContent = 'Import Your Spotify Playlists';
    }
}

function openImportModal(switchToModeOnCompletion) {
    if (hamburgerDropdown.classList.contains('show')) {
        hamburgerDropdown.classList.remove('show');
    }
    if (switchToModeOnCompletion) {
        window.pendingModeSwitch = switchToModeOnCompletion;
    }

    setImportUiState();
    
    if (window.playlistImport && typeof window.playlistImport.resetPlaylistData === 'function') {
        window.playlistImport.resetPlaylistData();
    }

    const importModal = document.getElementById('importModal');
    importModal.style.display = 'block';
    document.body.classList.add('modal-open');

    const panel = importModal.querySelector('.import-modal-content');
    if (panel) {
        panel.style.setProperty('--import-transform', 'translateY(10px) scale(0.98)');
        panel.style.setProperty('--import-transform-open', 'translateY(0) scale(1)');
    }

    requestAnimationFrame(() => {
        importModal.classList.add('open');
        adjustImportModalBounds();
        attachImportModalSizing();
        setTimeout(adjustImportModalBounds, 100);
    });

    if (window.playlistImport) {
        if (typeof window.playlistImport.initialize === 'function') {
            window.playlistImport.initialize();
        }
        if (typeof window.playlistImport.populatePlaylistStates === 'function') {
            window.playlistImport.populatePlaylistStates();
        }
    }
}

function closeImportModal() {
    const importModal = document.getElementById('importModal');
    if (!importModal) return;

    importModal.classList.remove('open');

    const tidy = () => {
        importModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        importModal.removeEventListener('transitionend', tidy);
        detachImportModalSizing();

        if (window.playlistImport && typeof window.playlistImport.resetPlaylistData === 'function') {
            window.playlistImport.resetPlaylistData();
        }
    };
    importModal.addEventListener('transitionend', tidy);
}

document.addEventListener('DOMContentLoaded', () => {
    const importMusicLink = document.getElementById('import-music-link');
    if (importMusicLink) {
        importMusicLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (document.querySelector('.thinking-message')) {
                alert("Aria's still thinking! Let her finish.");
                return;
            }
            openImportModal();
        });
    }

    (async () => {
        try {
            const resp = await fetch('/get_submitted_playlists/', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            if (!resp.ok) return;
            const data = await resp.json();
            window.hasImportedPlaylists = Array.isArray(data.playlists) && data.playlists.length > 0;
            setImportUiState();
        } catch (_) {}
    })();

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