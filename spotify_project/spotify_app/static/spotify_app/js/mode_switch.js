let hasImportedTracks = false;
let modeSwitchCooldown = false;

function getChatMode() {
    const activeBtn = document.querySelector('.segment-button.active');
    if (activeBtn) return activeBtn.dataset.mode;
    throw new Error('No active chat mode button found');
}
window.getChatMode = getChatMode;

function setActiveSegment(mode) {
    const buttons = document.querySelectorAll('.segment-button');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

function switchChatMode(newMode) {
    if (typeof window.resetAnalysisLoadingUI === 'function') {
        window.resetAnalysisLoadingUI(newMode);
    }

    if (window.playlistNames) {
        window.playlistNames = [];
    }

    const chatMode = newMode;
    sessionStorage.setItem('chatMode', chatMode);
    setActiveSegment(chatMode);
    document.body.dataset.chatMode = chatMode;
    if (window.isChatModeInitialized(chatMode)) {
        window.renderHistory(chatMode);
    } else {
        window.initializeChatMode(chatMode);
    }
}
window.switchChatMode = switchChatMode;

(function initSegmentedControlAnimation() {
    const control = document.querySelector('.segmented-control');
    const svg = document.getElementById('segment-animation-svg');
    if (!control || !svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"></feGaussianBlur>
            <feMerge>
                <feMergeNode in="coloredBlur"></feMergeNode>
                <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
        </filter>
    `;
    svg.appendChild(defs);

    const buttons = Array.from(control.querySelectorAll('.segment-button'));

    const getStrokeWidth = () => {
        const activeBtn = control.querySelector('.segment-button.active');
        if (activeBtn) {
            const w = parseFloat(getComputedStyle(activeBtn).borderWidth);
            if (!isNaN(w) && w > 0) return w;
        }
        return 2;
    };

    const referenceWidth = 600; // reference width in pixels
    const referenceEraseSpeed  = 1; // px/ms at reference width
    const referencePaintSpeed  = 1;
    const referenceTravelSpeed = 3;

    const cfg = {
        strokeWidth: getStrokeWidth(),
        glowColor: 'rgb(30,200,90)',
        dotRadius: 3.5,
        eraseSpeed: referenceEraseSpeed,
        paintSpeed: referencePaintSpeed,
        travelSpeed: referenceTravelSpeed,
        easingIn: t => t*t*t,
        easingOut: t => 1 - Math.pow(1 - t, 3)
    };

    function updateSpeeds() {
        const currentWidth = Math.max(1, control.getBoundingClientRect().width);
        const scale = currentWidth / referenceWidth;
        cfg.eraseSpeed  = referenceEraseSpeed  * scale;
        cfg.paintSpeed  = referencePaintSpeed  * scale;
        cfg.travelSpeed = referenceTravelSpeed * scale;
    }
    updateSpeeds();

    let isAnimating = false;

    function ensureSVGSize() {
        const r = control.getBoundingClientRect();
        const cs = getComputedStyle(control);

        let cssH = parseFloat((cs.getPropertyValue('--segmented-control-height') || '').trim());
        if (!Number.isFinite(cssH) || cssH <= 0) {
            cssH = r.height || control.offsetHeight || 39;
            control.style.setProperty('--segmented-control-height', `${cssH}px`);
        }

        svg.setAttribute('width', r.width);
        svg.setAttribute('height', cssH);
        svg.setAttribute('viewBox', `0 0 ${r.width} ${cssH}`);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        svg.style.overflow = 'visible';
        if (!control.style.position) control.style.position = 'relative';
        updateSpeeds();
    }

    const oldPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const newPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dotEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    [oldPathEl, newPathEl].forEach(p => {
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', cfg.glowColor);
        p.setAttribute('stroke-width', cfg.strokeWidth);
        p.setAttribute('stroke-linejoin', 'round');
        p.setAttribute('stroke-linecap', 'round');
        p.style.visibility = 'hidden';
        p.setAttribute('filter', 'url(#glow)');
    });

    dotEl.setAttribute('r', cfg.dotRadius);
    dotEl.setAttribute('fill', cfg.glowColor);
    dotEl.style.visibility = 'hidden';
    dotEl.setAttribute('filter', 'url(#glow)');

    svg.appendChild(oldPathEl);
    svg.appendChild(newPathEl);
    svg.appendChild(dotEl);

    function rectFor(el) {
        const parent = control.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(control);
        const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
        const borderTop  = parseFloat(cs.borderTopWidth) || 0;
        const result = {
            x: r.left - parent.left - borderLeft,
            y: -borderTop,
            width: r.width,
            height: r.height
        };
        return result;
    }

    function buildPillPath(r) {
        const inset = ((cfg && typeof cfg.strokeWidth === 'number') ? cfg.strokeWidth : 2) * 0.5;
        let { x, y, width, height } = r;
        x += inset;
        y += inset;
        width -= inset * 2;
        height -= inset * 2;
        const radius = height / 2;
        const sx = x + width / 2;
        const sy = y + height;
        const brA = x + width - radius;
        return [
            `M ${sx} ${sy}`,
            `L ${brA} ${y + height}`,
            `A ${radius} ${radius} 0 0 0 ${x + width} ${y + height - radius}`,
            `L ${x + width} ${y + radius}`,
            `A ${radius} ${radius} 0 0 0 ${x + width - radius} ${y}`,
            `L ${x + radius} ${y}`,
            `A ${radius} ${radius} 0 0 0 ${x} ${y + radius}`,
            `L ${x} ${y + height - radius}`,
            `A ${radius} ${radius} 0 0 0 ${x + radius} ${y + height}`,
            `L ${sx} ${sy}`
        ].join(' ');
    }

    function dashArray(L) {
        return `${L} ${L}`;
    }

    function animateStroke(pathEl, type, direction, speedPxPerMs) {
        return new Promise(res => {
            pathEl.style.visibility = 'visible';
            const length = pathEl.getTotalLength();
            pathEl.setAttribute('stroke-dasharray', dashArray(length));
            let from, to;
            if (type === 'erase') {
                from = 0;
                to = direction === 'reverse' ? length : -length;
                pathEl.setAttribute('stroke-dashoffset', '0');
            } else {
                from = direction === 'reverse' ? -length : length;
                to = 0;
                pathEl.setAttribute('stroke-dashoffset', `${from}`);
            }
            const duration = length / speedPxPerMs;
            let start = null;
            function frame(ts) {
                if (!start) start = ts;
                const raw = Math.min((ts - start) / duration, 1);
                const eased = type === 'erase' ? cfg.easingIn(raw) : cfg.easingOut(raw);
                const current = from + (to - from) * eased;
                pathEl.setAttribute('stroke-dashoffset', `${current}`);
                const prog = direction === 'reverse' ? 1 - eased : eased;
                const posLen = prog * length;
                const pt = pathEl.getPointAtLength(Math.max(0, Math.min(length, posLen)));
                dotEl.setAttribute('cx', pt.x);
                dotEl.setAttribute('cy', pt.y);
                dotEl.style.visibility = 'visible';
                if (raw < 1) requestAnimationFrame(frame); else res();
            }
            requestAnimationFrame(frame);
        });
    }

    function animateTravel(fromRect, toRect) {
        return new Promise(res => {
            const y = fromRect.y + fromRect.height;
            const startX = fromRect.x + fromRect.width / 2;
            const endX = toRect.x + toRect.width / 2;
            const dx = endX - startX;
            const dist = Math.abs(dx);
            const duration = dist / cfg.travelSpeed;
            let startTime = null;
            dotEl.style.visibility = 'visible';
            dotEl.setAttribute('cx', startX);
            dotEl.setAttribute('cy', y);
            function frame(ts) {
                if (!startTime) startTime = ts;
                const raw = Math.min((ts - startTime) / duration, 1);
                dotEl.setAttribute('cx', startX + dx * raw);
                if (raw < 1) requestAnimationFrame(frame); else res();
            }
            requestAnimationFrame(frame);
        });
    }

    function animateTransition(fromBtn, toBtn, done) {
        if (isAnimating || !fromBtn || !toBtn || fromBtn === toBtn) { done && done(); return; }
        isAnimating = true;
        if (window.toggleChatInput) window.toggleChatInput(true);
        control.classList.add('is-animating');
        ensureSVGSize();

        const fromRect = rectFor(fromBtn);
        const toRect = rectFor(toBtn);
        if ((window.matchMedia && window.matchMedia('(max-width: 768px)').matches) || window.innerWidth <= 768) {
            const controlBorderWidth = parseFloat(getComputedStyle(control).borderTopWidth) || 0;
            toRect.height -= controlBorderWidth;
            fromRect.height -= controlBorderWidth;
        } else {
            toRect.width = fromRect.width;
            toRect.height = fromRect.height;
        }
        
        oldPathEl.setAttribute('d', buildPillPath(fromRect));
        newPathEl.setAttribute('d', buildPillPath(toRect));
        newPathEl.style.visibility = 'hidden';
        dotEl.style.visibility = 'hidden';

        const fromIdx = buttons.indexOf(fromBtn);
        const toIdx = buttons.indexOf(toBtn);
        const direction = toIdx > fromIdx ? 'forward' : 'reverse';

        fromBtn.classList.remove('active');
        fromBtn.classList.add('was-active');

        animateStroke(oldPathEl, 'erase', direction, cfg.eraseSpeed)
            .then(() => animateTravel(fromRect, toRect))
            .then(() => animateStroke(newPathEl, 'paint', direction, cfg.paintSpeed))
            .then(() => {
                toBtn.classList.add('active');
                toBtn.classList.remove('tap-target');
                oldPathEl.style.visibility = 'hidden';
                newPathEl.style.visibility = 'hidden';
                setTimeout(() => {
                    dotEl.style.visibility = 'hidden';
                    control.classList.remove('is-animating');
                    fromBtn.classList.remove('was-active');
                    isAnimating = false;
                    done && done();
                }, 0);
            });
    }

    window.addEventListener('resize', () => {
        if (isAnimating) return;
        ensureSVGSize();
    });

    buttons.forEach(btn => {
        btn.addEventListener('click', async function() {
            if (isAnimating || modeSwitchCooldown || this.classList.contains('active')) return;
            if (document.querySelector('.thinking-message')) {
                alert("Aria's still thinking! Let her finish.");
                return;
            }

            const targetMode = this.dataset.mode;

            if ((targetMode === 'saved_songs' || targetMode === 'analysis') && !hasImportedTracks) {
                try {
                    const resp = await fetch('/check_import_status_api/', {
                        method: 'GET',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (!data.completed) {
                            if (typeof window.openImportModal === 'function') {
                                window.openImportModal(targetMode);
                            } else {
                                alert("Please import at least one Spotify playlist to continue. The import screen can be accessed by clicking the three dots (...) and selecting 'Import My Music'.");
                            }
                            return;
                        }
                        hasImportedTracks = true;
                    } else {
                        if (typeof window.openImportModal === 'function') {
                            window.openImportModal(targetMode);
                        } else {
                            alert("Please import at least one Spotify playlist to continue. The import screen can be accessed by clicking the three dots (...) and selecting 'Import My Music'.");
                        }
                        return;
                    }
                } catch (e) {
                    if (typeof window.openImportModal === 'function') {
                        window.openImportModal(targetMode);
                    } else {
                        alert("Please import at least one Spotify playlist to continue. The import screen can be accessed by clicking the three dots (...) and selecting 'Import My Music'.");
                    }
                    return;
                }
            }

            const fromBtn = document.querySelector('.segment-button.active');
            const toBtn = this;
            modeSwitchCooldown = true;
            buttons.forEach(b => b.style.pointerEvents='none');

            const isMobile = (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) || window.innerWidth <= 768;
            if (isMobile) {
                toBtn.classList.add('tap-target');
            }

            animateTransition(fromBtn, toBtn, () => {
                switchChatMode(toBtn.dataset.mode);
                setTimeout(() => {
                    modeSwitchCooldown = false;
                    buttons.forEach(b => b.style.pointerEvents='');
                }, 300);
            });
        }, { capture: true });
    });
})();