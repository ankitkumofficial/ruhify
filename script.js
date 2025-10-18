(() => {
    const ringEl = document.getElementById('ring');
    const soundBtn = document.getElementById('soundBtn');
    const cyclesSel = document.getElementById('cycles');
    const phaseEl = document.getElementById('phase');
    const timerEl = document.getElementById('timer');
    const orbEl = document.getElementById('orb');
    const hintEl = document.getElementById('hint');
    const footerHints = document.getElementById('footerHints');

    const phases = [
        { name: 'Inhale', seconds: 4, color: getComputedStyle(document.documentElement).getPropertyValue('--inhale').trim(), hint: 'Breathe in gently through the nose' },
        { name: 'Hold', seconds: 7, color: getComputedStyle(document.documentElement).getPropertyValue('--hold').trim(), hint: 'Rest softly, shoulders relaxed' },
        { name: 'Exhale', seconds: 8, color: getComputedStyle(document.documentElement).getPropertyValue('--exhale').trim(), hint: 'Exhale slowly through the mouth' },
    ];

    let audioCtx = null, soundOn = true;
    let running = false, requested = false;
    let currentPhase = -1, cycleCount = 0, targetCycles = parseInt(cyclesSel.value, 10);
    let rafId = null, intervalId = null;
    let startTime = 0, elapsedPhaseMs = 0;

    // --- SOUND ----
    function ensureAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { soundOn = false; updateSoundBtn(); }
        }
    }

    function beep({ duration = 0.12, freq = 440, type = 'sine', gain = 0.03 } = {}) {
        if (!soundOn) return;
        ensureAudio();
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(g).connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    function updateSoundBtn() {
        soundBtn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
        soundBtn.setAttribute('aria-pressed', String(soundOn));
    }

    // --- VISUALS ----
    function setRingProgress(progress, color) {
        ringEl.style.background = `conic-gradient(from -90deg, ${color} ${progress * 360}deg, var(--ring) ${progress * 360}deg 360deg)`;
    }

    // Orb scaling constants
    const scaleMin = 0.8;  // smallest (start of inhale / end of exhale)
    const scaleMax = 1.15; // largest (during hold)

    function setOrbScale(progress, phaseName) {
        orbEl.style.transition = 'none';

        let scale;
        if (phaseName === 'Inhale') {
            scale = scaleMin + (scaleMax - scaleMin) * progress; // expand
        } else if (phaseName === 'Exhale') {
            scale = scaleMax - (scaleMax - scaleMin) * progress; // collapse
        } else {
            scale = scaleMax; // Hold stays fixed
        }

        orbEl.style.transform = `scale(${scale})`;
    }

    // --- MAIN LOOP ----
    function runPhase(i) {
        if (i >= phases.length) {
            cycleCount++;
            if (cycleCount >= targetCycles) {
                finishSession();
                return;
            }
            setRingProgress(0, 'var(--ring-active)');
            orbEl.style.transform = `scale(${scaleMin})`;
            setTimeout(() => runPhase(0), 1000);
            return;
        }

        currentPhase = i;
        const p = phases[i];
        const duration = p.seconds * 1000;
        elapsedPhaseMs = 0;
        startTime = performance.now();

        phaseEl.textContent = p.name;
        phaseEl.style.color = p.color;
        hintEl.textContent = p.hint;

        if (p.name === 'Inhale') beep({ freq: 392, gain: 0.03 });
        if (p.name === 'Hold') beep({ freq: 262, gain: 0.025 });
        if (p.name === 'Exhale') beep({ freq: 220, gain: 0.03 });

        cancelAnimationFrame(rafId);
        clearInterval(intervalId);

        function animate(now) {
            if (!running) return;

            const elapsed = now - startTime;
            elapsedPhaseMs = elapsed;
            const progress = Math.min(1, elapsed / duration);

            if (p.name === 'Inhale') {
                setRingProgress(progress, p.color);
                setOrbScale(progress, 'Inhale');
            } else if (p.name === 'Hold') {
                setRingProgress(1, p.color);
                setOrbScale(1, 'Hold');
            } else if (p.name === 'Exhale') {
                setRingProgress(1 - progress, p.color);
                setOrbScale(progress, 'Exhale');
            }

            if (progress < 1) {
                rafId = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(rafId);
                clearInterval(intervalId);
                setTimeout(() => runPhase(i + 1), 50);
            }
        }
        rafId = requestAnimationFrame(animate);

        intervalId = setInterval(() => {
            const remaining = Math.max(0, duration - elapsedPhaseMs);
            timerEl.textContent = String(Math.ceil(remaining / 1000));
        }, 100);
    }

    function finishSession() {
        running = false;
        ringEl.setAttribute('aria-pressed', 'false');
        phaseEl.textContent = 'Cycle complete ✓';
        timerEl.textContent = '0';
        hintEl.textContent = 'Tap the ring to start again';
        orbEl.style.transform = `scale(${scaleMin})`;
        setRingProgress(0, 'var(--ring-active)');
        beep({ freq: 660, duration: 0.18, type: 'triangle', gain: 0.035 });
        beep({ freq: 880, duration: 0.18, type: 'triangle', gain: 0.035 });
    }

    // --- SESSION CONTROLS ----
    function startSession() {
        if (running) return;
        if (!requested) { ensureAudio(); requested = true; }
        targetCycles = parseInt(cyclesSel.value, 10);
        cycleCount = 0;
        running = true;
        ringEl.setAttribute('aria-pressed', 'true');
        runPhase(0);
        hintEl.textContent = 'Tap the ring to pause';
    }

    function pauseSession() {
        if (!running) return;
        running = false;
        ringEl.setAttribute('aria-pressed', 'false');
        phaseEl.textContent = 'Paused';
        hintEl.textContent = 'Tap the ring to resume';
        cancelAnimationFrame(rafId);
        clearInterval(intervalId);
    }

    function resumeSession() {
        running = true;
        ringEl.setAttribute('aria-pressed', 'true');
        const p = phases[currentPhase];
        const duration = p.seconds * 1000;
        startTime = performance.now() - elapsedPhaseMs;

        cancelAnimationFrame(rafId);
        clearInterval(intervalId);

        function animate(now) {
            if (!running) return;

            const elapsed = now - startTime;
            elapsedPhaseMs = elapsed;
            const progress = Math.min(1, elapsed / duration);

            if (p.name === 'Inhale') {
                setRingProgress(progress, p.color);
                setOrbScale(progress, 'Inhale');
            } else if (p.name === 'Hold') {
                setRingProgress(1, p.color);
                setOrbScale(1, 'Hold');
            } else if (p.name === 'Exhale') {
                setRingProgress(1 - progress, p.color);
                setOrbScale(progress, 'Exhale');
            }

            if (progress < 1) {
                rafId = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(rafId);
                clearInterval(intervalId);
                setTimeout(() => runPhase(i + 1), 50);
            }
        }
        rafId = requestAnimationFrame(animate);

        intervalId = setInterval(() => {
            const remaining = Math.max(0, duration - elapsedPhaseMs);
            timerEl.textContent = String(Math.ceil(remaining / 1000));
        }, 100);
    }

    function toggleSession() {
        if (!requested || (!running && (phaseEl.textContent === 'Ready' || phaseEl.textContent.includes('complete')))) {
            startSession();
            return;
        }
        if (running) {
            pauseSession();
        } else {
            resumeSession();
        }
    }

    // --- HINTS & CONTROLS ----
    function isCoarse() { return window.matchMedia('(pointer: coarse)').matches; }
    function applyHints() {
        if (isCoarse()) {
            footerHints.innerHTML = '<div>Tap the ring to begin or pause</div><div>Use Sound to toggle audio</div>';
        } else {
            footerHints.innerHTML = '<div>Press Space to start/pause</div><div>Shift+S toggles sound</div>';
        }
    }

    ringEl.addEventListener('click', toggleSession);
    soundBtn.addEventListener('click', () => { soundOn = !soundOn; updateSoundBtn(); });
    document.addEventListener('keydown', e => {
        if (!isCoarse()) {
            if (e.code === 'Space') { e.preventDefault(); toggleSession(); }
            if (e.shiftKey && e.code === 'KeyS') { soundOn = !soundOn; updateSoundBtn(); }
        }
    });

    cyclesSel.addEventListener('change', () => {
        cancelAnimationFrame(rafId);
        clearInterval(intervalId);
        running = false;
        currentPhase = -1;
        cycleCount = 0;
        elapsedPhaseMs = 0;
        orbEl.style.transform = `scale(${scaleMin})`;
        setRingProgress(0, 'var(--ring-active)');
        phaseEl.textContent = 'Ready';
        timerEl.textContent = '0';
        hintEl.textContent = 'Tap the ring to begin';
        ringEl.setAttribute('aria-pressed', 'false');
    });

    updateSoundBtn();
    setRingProgress(0, 'var(--ring-active)');
    orbEl.style.transform = `scale(${scaleMin})`;
    applyHints();
})();
