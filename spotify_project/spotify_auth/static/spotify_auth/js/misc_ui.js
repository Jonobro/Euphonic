const hamburgerBtn = document.getElementById('hamburger-btn');
const hamburgerDropdown = document.getElementById('hamburger-dropdown');
const hamburgerBackdrop = document.getElementById('hamburger-backdrop');

hamburgerBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    hamburgerDropdown.classList.toggle('show');
});

if (hamburgerBackdrop) {
    hamburgerBackdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hamburgerDropdown.classList.contains('show')) {
            hamburgerDropdown.classList.remove('show');
        }
    });
}

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
let _importModalDisabledChat = false;

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

        const top = hr.top - 5;
        const left = Math.min(hr.left, lr.left);
        const right = Math.max(hr.right, lr.right);
        const bottom = lr.bottom;

        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top) + 5;

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
    const headerEl = document.querySelector('#importModal .import-modal-header h2');

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
    try {
        const userInput = document.getElementById('user-input');

        if (userInput && typeof userInput.blur === 'function') {
            try { userInput.blur(); } catch (_) {}
        }

        if (window.toggleChatInput && userInput && !userInput.disabled) {
            window.toggleChatInput(true);
            _importModalDisabledChat = true;
        } else {
            _importModalDisabledChat = false;
        }
    } catch (_) { _importModalDisabledChat = false; }

    setImportUiState();
    
    if (window.playlistImport && typeof window.playlistImport.resetPlaylistData === 'function') {
        window.playlistImport.resetPlaylistData();
    }

    const importModal = document.getElementById('importModal');
    importModal.style.display = 'block';

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
        importModal.removeEventListener('transitionend', tidy);
        detachImportModalSizing();

        if (window.playlistImport && typeof window.playlistImport.resetPlaylistData === 'function') {
            window.playlistImport.resetPlaylistData();
        }
        try {
            if (window.toggleChatInput && _importModalDisabledChat) {
                window.toggleChatInput(false);
            }
        } catch (_) {}
        _importModalDisabledChat = false;
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

    const eulaLinkMenu = document.getElementById('eula-link-menu');
    if (eulaLinkMenu) {
        eulaLinkMenu.addEventListener('click', (event) => {
            event.preventDefault();
            openModal('eula');
        });
    }
    
    const privacyLinkMenu = document.getElementById('privacy-link-menu');
    if (privacyLinkMenu) {
        privacyLinkMenu.addEventListener('click', (event) => {
            event.preventDefault();
            openModal('privacy');
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
};

(function () {
    let supportsPassive = false;
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get() { supportsPassive = true; }
        });
        window.addEventListener('testPassive', null, opts);
        window.removeEventListener('testPassive', null, opts);
    } catch (_) {}
    const listenerOpts = supportsPassive ? { passive: false } : false;

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
        document.addEventListener(evt, e => e.preventDefault(), listenerOpts);
    });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', e => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, listenerOpts);
})();

(function () {
    function setViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    function debounce(fn, wait) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }
    const debouncedSetViewportHeight = debounce(setViewportHeight, 100);

    document.addEventListener('DOMContentLoaded', setViewportHeight);
    window.addEventListener('load', setViewportHeight);
    window.addEventListener('resize', debouncedSetViewportHeight);
    window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 300));
    if ('visualViewport' in window) {
        window.visualViewport.addEventListener('resize', debouncedSetViewportHeight);
    }
    if (/Android/i.test(navigator.userAgent)) {
        window.addEventListener('scroll', debouncedSetViewportHeight, { passive: true });
    }
})();

(function () {
    const mq = window.matchMedia('(max-width: 768px)');
    let isKeyboardOpen = false;

    function setKeyboardOpen(open) {
        if (isKeyboardOpen === open) return;
        isKeyboardOpen = open;
        document.body.classList.toggle('keyboard-open', open);
    }

    function computeKeyboardOpen() {
        if (!mq.matches) {
            setKeyboardOpen(false);
            return;
        }
        const input = document.getElementById('user-input');
        setKeyboardOpen(document.activeElement === input);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('user-input');
        if (input) {
            input.addEventListener('focus', computeKeyboardOpen, { passive: true });
            input.addEventListener('blur', computeKeyboardOpen, { passive: true });
        }
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', computeKeyboardOpen);
        }
        window.addEventListener('orientationchange', () => setTimeout(computeKeyboardOpen, 300), { passive: true });
    });
})();

(function () {
  const chat = document.getElementById('chat-container');
  if (!chat) return;

  const isVisible = el => !!el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
  const toNumber = v => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  function computeAndSetChatHeight() {
    if (document.body.classList.contains('keyboard-open')) return;
    const vv = window.visualViewport;
    const viewportHeight = vv?.height ?? window.innerHeight;
    const chatRect = chat.getBoundingClientRect();
    const spaceAbove = Math.max(0, chatRect.top);
    let spaceBelow = 0;
    spaceBelow += toNumber(getComputedStyle(document.body).paddingBottom);

    const containerEl = document.querySelector('.container');
    if (isVisible(containerEl)) {
      const cs = getComputedStyle(containerEl);
      spaceBelow += toNumber(cs.paddingBottom);
    }

    const onMobile = window.matchMedia('(max-width: 768px)').matches;
    const footer = onMobile ? null : document.querySelector('.spotify-footer');
    if (isVisible(footer)) {
      const fs = getComputedStyle(footer);
      spaceBelow += footer.offsetHeight + toNumber(fs.marginTop) + toNumber(fs.marginBottom);
    }

    let targetHeight = Math.max(250, Math.floor(viewportHeight - spaceAbove - spaceBelow - (onMobile ? 2 : 0)));

    const isIOSSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
                       /Safari/i.test(navigator.userAgent) &&
                       !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    const isIOS26 = CSS.supports('color', 'contrast-color(white)');
    const keyboardOpen = document.body.classList.contains('keyboard-open');

    if (isIOSSafari && isIOS26 && !keyboardOpen) {
        targetHeight = targetHeight + 8;
    }
    
    chat.style.height = `${targetHeight}px`;
  }

  let rafId = null;
  const schedule = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (document.body.classList.contains('keyboard-open')) return;

    rafId = requestAnimationFrame(computeAndSetChatHeight);
  };

  document.addEventListener('DOMContentLoaded', schedule);
  window.addEventListener('load', () => {
    schedule();
    setTimeout(schedule, 50);
    setTimeout(schedule, 250);
  });

  window.addEventListener('resize', schedule);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', schedule);
    window.visualViewport.addEventListener('geometrychange', schedule);
  }

  const textarea = document.getElementById('user-input');
  if (textarea) {
    textarea.addEventListener('blur', schedule);
  }
})();