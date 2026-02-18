import { HAND_CONNECTIONS } from './utils.js';

export class HandInput {
    constructor() {
        this.handLandmarker = null;
        this.video = null;
        this.hands = [];
        this.isReady = false;

        // Gesture state — exposed to Particle system
        this.gestures = {
            isFist: false,
            isOpen: false,
            isPinching: false,
            isPointing: false,
            isRock: false,
            isPeace: false,
            fingerCount: -1,
            pointer: { x: 0, y: 0, z: 0 },
            palmCenter: { x: 0.5, y: 0.5 },
            handSpread: 0,
            handDetected: false,
        };

        // Webcam overlay canvas
        this.overlayCanvas = document.getElementById('webcam-canvas');
        this.overlayCtx = this.overlayCanvas ? this.overlayCanvas.getContext('2d') : null;
    }

    async init() {
        const statusEl = document.getElementById('loading-status');
        const fillEl = document.getElementById('loader-fill');
        const setProgress = (pct, msg) => {
            if (fillEl) fillEl.style.width = pct + '%';
            if (statusEl) statusEl.textContent = msg;
        };

        try {
            setProgress(10, 'Loading vision runtime…');

            // Dynamic import from CDN to avoid Vite WASM bundling issues
            const { FilesetResolver, HandLandmarker } = window.vision
                ? window.vision
                : await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs');

            setProgress(30, 'Initializing WASM…');

            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
            );

            setProgress(55, 'Loading hand landmark model…');

            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
                numHands: 2,
            });

            setProgress(75, 'Setting up camera…');
            await this.setupCamera();

            setProgress(90, 'Starting detection…');
            this.startPredicting();
            this.isReady = true;

            setProgress(100, 'Ready!');
            console.log('[HandInput] Initialized successfully');
        } catch (e) {
            console.error('[HandInput] Init failed:', e);
            const loader = document.querySelector('.loader-content');
            if (loader) {
                loader.innerHTML = `
          <p style="color:#ff5555;font-size:1.2rem;margin-bottom:0.5rem;">⚠ Camera Error</p>
          <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">${e.message}</p>
          <p style="color:rgba(255,255,255,0.3);font-size:0.75rem;margin-top:1rem;">
            Keyboard controls still work — press any number key (0-8).
          </p>
        `;
            }
            // Don't throw — allow app to run with keyboard only
        }
    }

    async setupCamera() {
        this.video = document.createElement('video');
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.style.display = 'none';
        document.body.appendChild(this.video);

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
        });
        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadeddata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    startPredicting() {
        let lastTime = -1;
        const tick = () => {
            if (this.handLandmarker && this.video && this.video.currentTime !== lastTime) {
                lastTime = this.video.currentTime;
                const results = this.handLandmarker.detectForVideo(this.video, performance.now());
                this.processResults(results);
                this.drawOverlay(results);
            }
            requestAnimationFrame(tick);
        };
        tick();

        // Show webcam preview
        const preview = document.getElementById('webcam-preview');
        if (preview) preview.classList.add('visible');
    }

    processResults(results) {
        // Reset
        this.gestures.isFist = false;
        this.gestures.isOpen = false;
        this.gestures.isPinching = false;
        this.gestures.isPointing = false;
        this.gestures.isRock = false;
        this.gestures.isPeace = false;
        this.gestures.fingerCount = -1;
        this.gestures.handDetected = false;
        this.gestures.handSpread = 0;
        this.hands = [];

        const handDot = document.getElementById('hand-dot');
        const handLabel = document.getElementById('hand-label');

        if (!results.landmarks || results.landmarks.length === 0) {
            if (handDot) handDot.classList.remove('active');
            if (handLabel) handLabel.textContent = 'No hand';
            return;
        }

        this.gestures.handDetected = true;
        if (handDot) handDot.classList.add('active');
        this.hands = results.landmarks;

        const lm = results.landmarks[0];

        // Palm center
        const palmX = (lm[0].x + lm[5].x + lm[17].x) / 3;
        const palmY = (lm[0].y + lm[5].y + lm[17].y) / 3;
        this.gestures.palmCenter = { x: palmX, y: palmY };

        // Pointer (index fingertip)
        this.gestures.pointer = {
            x: (lm[8].x - 0.5) * 2,
            y: -(lm[8].y - 0.5) * 2,
            z: lm[8].z,
        };

        // Finger extension detection (compare tip y vs PIP y)
        // In MediaPipe, y increases downward
        const isThumbOut = Math.abs(lm[4].x - lm[2].x) > 0.06;
        const isIndexUp = lm[8].y < lm[6].y;
        const isMiddleUp = lm[12].y < lm[10].y;
        const isRingUp = lm[16].y < lm[14].y;
        const isPinkyUp = lm[20].y < lm[18].y;

        const fingerCount = [isThumbOut, isIndexUp, isMiddleUp, isRingUp, isPinkyUp]
            .filter(Boolean).length;
        this.gestures.fingerCount = fingerCount;

        // Pinch: thumb tip ↔ index tip distance
        const pinchDist = this.dist(lm[4], lm[8]);
        this.gestures.isPinching = pinchDist < 0.05;

        // Hand spread (average distance of fingertips from palm center)
        const palm = { x: palmX, y: palmY, z: (lm[0].z + lm[5].z + lm[17].z) / 3 };
        const tips = [lm[4], lm[8], lm[12], lm[16], lm[20]];
        const avgDist = tips.reduce((s, t) => s + this.dist(t, palm), 0) / 5;
        this.gestures.handSpread = Math.min(avgDist / 0.25, 1.0);

        // Gesture classification
        if (fingerCount === 0) {
            this.gestures.isFist = true;
        } else if (fingerCount >= 4 && !this.gestures.isPinching) {
            this.gestures.isOpen = true;
        } else if (isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
            this.gestures.isPointing = true;
        } else if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
            this.gestures.isPeace = true;
        } else if (isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) {
            this.gestures.isRock = true;
        }

        // Update label
        if (handLabel) {
            let gesture = 'Tracking';
            if (this.gestures.isFist) gesture = '✊ Fist';
            else if (this.gestures.isPinching) gesture = '🤏 Pinch';
            else if (this.gestures.isOpen) gesture = '🖐️ Open';
            else if (this.gestures.isPointing) gesture = '☝️ Point';
            else if (this.gestures.isPeace) gesture = '✌️ Peace';
            else if (this.gestures.isRock) gesture = '🤟 Rock';
            handLabel.textContent = gesture;
        }
    }

    drawOverlay(results) {
        if (!this.overlayCtx || !this.video) return;
        const ctx = this.overlayCtx;
        const cw = this.overlayCanvas.width;
        const ch = this.overlayCanvas.height;

        ctx.clearRect(0, 0, cw, ch);

        // Draw mirrored video feed
        ctx.save();
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, 0, 0, cw, ch);
        ctx.restore();

        // Darken slightly
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, cw, ch);

        if (!results.landmarks || results.landmarks.length === 0) return;

        for (const landmarks of results.landmarks) {
            // Draw connections
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
            ctx.lineWidth = 1.5;
            for (const [a, b] of HAND_CONNECTIONS) {
                const ax = (1 - landmarks[a].x) * cw; // Mirror
                const ay = landmarks[a].y * ch;
                const bx = (1 - landmarks[b].x) * cw;
                const by = landmarks[b].y * ch;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
                ctx.stroke();
            }

            // Draw landmark dots
            for (let i = 0; i < landmarks.length; i++) {
                const x = (1 - landmarks[i].x) * cw;
                const y = landmarks[i].y * ch;
                const isTip = [4, 8, 12, 16, 20].includes(i);
                const r = isTip ? 4 : 2;

                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fillStyle = isTip ? '#ff2d7b' : '#00e5ff';
                ctx.fill();

                if (isTip) {
                    ctx.beginPath();
                    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 45, 123, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    dist(p1, p2) {
        return Math.sqrt(
            (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2
        );
    }
}
