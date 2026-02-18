import * as THREE from 'three';

export const randomRange = (min, max) => Math.random() * (max - min) + min;

// ═══════════════════════════════════════
// Parametric Shape Generators
// Each takes (u ∈ [0,1], v ∈ [0,1], THREE.Vector3 target)
// ═══════════════════════════════════════
export const parametric = {
    heart: (u, v, target) => {
        const phi = u * Math.PI * 2;
        const scale = Math.cbrt(v); // fill interior
        const x = 16 * Math.pow(Math.sin(phi), 3) * scale;
        const y = (13 * Math.cos(phi) - 5 * Math.cos(2 * phi) - 2 * Math.cos(3 * phi) - Math.cos(4 * phi)) * scale;
        const z = (Math.random() - 0.5) * 4 * scale;
        target.set(x * 0.45, y * 0.45 + 2, z);
    },

    flower: (u, v, target) => {
        const phi = u * Math.PI * 2;
        const theta = v * Math.PI;
        const petals = 5;
        const r = 10 * (1 + 0.6 * Math.sin(petals * phi) * Math.sin(theta));
        target.set(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(theta)
        );
    },

    saturn: (u, v, target) => {
        if (v < 0.35) {
            // Planet body (sphere)
            const phi = u * Math.PI * 2;
            const theta = (v / 0.35) * Math.PI;
            const r = 8 * Math.cbrt(Math.random());
            target.set(
                r * Math.sin(theta) * Math.cos(phi),
                r * Math.sin(theta) * Math.sin(phi) * 0.85,
                r * Math.cos(phi) * 0.4
            );
        } else {
            // Rings — tilted disk
            const angle = u * Math.PI * 2;
            const ringR = 13 + (v - 0.35) * 28;
            const y = (Math.random() - 0.5) * 0.4;
            const x = Math.cos(angle) * ringR;
            const z = Math.sin(angle) * ringR;
            // Tilt the rings ~25 degrees
            const tiltAngle = 0.44;
            target.set(
                x,
                y + z * Math.sin(tiltAngle),
                z * Math.cos(tiltAngle)
            );
        }
    },

    fireworks: (u, v, target) => {
        const burst = Math.floor(u * 5);
        const cx = (burst - 2) * 10 + (Math.sin(burst * 7.3) * 4);
        const cy = Math.cos(burst * 3.1) * 6 + 4;
        const cz = Math.sin(burst * 5.7) * 3;

        const phi = Math.acos(2 * v - 1);
        const theta = u * Math.PI * 2 * 12.5;
        const r = Math.random() * 6;

        target.set(
            cx + r * Math.sin(phi) * Math.cos(theta),
            cy + r * Math.sin(phi) * Math.sin(theta),
            cz + r * Math.cos(phi)
        );
    },

    galaxy: (u, v, target) => {
        const arms = 3;
        const arm = Math.floor(u * arms * 100) % arms;
        const armAngle = (arm / arms) * Math.PI * 2;
        const t = v * 30;
        const angle = armAngle + t * 0.4;
        const spread = 0.5 + t * 0.12;

        target.set(
            t * Math.cos(angle) + (Math.random() - 0.5) * spread * 3,
            (Math.random() - 0.5) * (1.5 + t * 0.05),
            t * Math.sin(angle) + (Math.random() - 0.5) * spread * 3
        );
    },

    dna: (u, v, target) => {
        const h = v * 50 - 25;
        const angle = h * 0.5;

        if (u < 0.4) {
            // Helix 1
            target.set(Math.cos(angle) * 6, h, Math.sin(angle) * 6);
        } else if (u < 0.8) {
            // Helix 2
            target.set(Math.cos(angle + Math.PI) * 6, h, Math.sin(angle + Math.PI) * 6);
        } else {
            // Cross-bars (every ~15 degrees)
            const lerp = Math.random();
            target.set(
                Math.cos(angle) * 6 * (1 - lerp) + Math.cos(angle + Math.PI) * 6 * lerp,
                h + (Math.random() - 0.5) * 0.3,
                Math.sin(angle) * 6 * (1 - lerp) + Math.sin(angle + Math.PI) * 6 * lerp
            );
        }
    },

    star: (u, v, target) => {
        const points = 5;
        const angle = u * Math.PI * 2;
        const segment = angle / (Math.PI / points);
        const segFloor = Math.floor(segment);
        const segFrac = segment - segFloor;
        const outerR = 15;
        const innerR = 6;
        const r1 = segFloor % 2 === 0 ? outerR : innerR;
        const r2 = segFloor % 2 === 0 ? innerR : outerR;
        const maxR = r1 + (r2 - r1) * segFrac;
        const r = Math.sqrt(v) * maxR;

        target.set(
            r * Math.cos(angle),
            r * Math.sin(angle),
            (Math.random() - 0.5) * 2
        );
    },

    tornado: (u, v, target) => {
        const angle = u * Math.PI * 2 * 10;
        const h = v * 40 - 20;
        const r = 2 + (v * v) * 18;
        target.set(
            Math.cos(angle + h * 0.2) * r,
            h,
            Math.sin(angle + h * 0.2) * r
        );
    },

    sphere: (u, v, target) => {
        const phi = u * Math.PI * 2;
        const theta = v * Math.PI;
        const r = 15 * Math.cbrt(Math.random());
        target.set(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(theta)
        );
    }
};

// ═══════════════════════════════════════
// Color Palettes per Shape
// Each is an array of [r, g, b] (0-1 range)
// ═══════════════════════════════════════
export const SHAPE_COLORS = {
    heart: [[1.0, 0.15, 0.35], [1.0, 0.35, 0.55], [0.85, 0.05, 0.25], [1.0, 0.55, 0.65]],
    flower: [[1.0, 0.75, 0.15], [0.2, 0.85, 0.35], [1.0, 0.45, 0.65], [0.95, 0.55, 0.1]],
    saturn: [[0.55, 0.25, 0.9], [0.9, 0.7, 0.2], [0.75, 0.45, 1.0], [0.3, 0.15, 0.7]],
    fireworks: [[1.0, 0.85, 0.1], [1.0, 0.25, 0.1], [0.15, 1.0, 0.35], [0.25, 0.6, 1.0]],
    galaxy: [[0.1, 0.7, 1.0], [0.85, 0.3, 1.0], [0.2, 0.4, 1.0], [0.95, 0.9, 0.75]],
    dna: [[0.0, 0.9, 0.8], [0.0, 0.6, 1.0], [0.3, 1.0, 0.5], [0.1, 0.8, 0.9]],
    star: [[1.0, 0.95, 0.5], [1.0, 0.8, 0.2], [1.0, 0.65, 0.0], [1.0, 1.0, 0.85]],
    tornado: [[0.6, 0.6, 0.7], [0.4, 0.45, 0.55], [0.8, 0.85, 0.9], [0.35, 0.4, 0.5]],
    sphere: [[0.3, 0.5, 1.0], [0.4, 0.65, 1.0], [0.5, 0.75, 1.0], [0.2, 0.4, 0.9]],
};

// Alternate color palettes for cycling
export const ALT_PALETTES = [
    // Neon
    { heart: [[0.0, 1.0, 0.8], [0.0, 0.7, 1.0], [0.5, 0.0, 1.0], [0.0, 1.0, 0.5]] },
    // Warm sunset
    { heart: [[1.0, 0.4, 0.1], [1.0, 0.6, 0.2], [0.9, 0.2, 0.3], [1.0, 0.8, 0.3]] },
    // Ice
    { heart: [[0.7, 0.9, 1.0], [0.5, 0.8, 1.0], [0.85, 0.95, 1.0], [0.4, 0.7, 0.95]] },
];

// Shape metadata for UI
export const SHAPE_META = {
    heart: { emoji: '❤️', name: 'Heart' },
    flower: { emoji: '🌸', name: 'Flower' },
    saturn: { emoji: '🪐', name: 'Saturn' },
    fireworks: { emoji: '🎆', name: 'Fireworks' },
    galaxy: { emoji: '🌀', name: 'Galaxy' },
    dna: { emoji: '🧬', name: 'DNA' },
    star: { emoji: '⭐', name: 'Star' },
    tornado: { emoji: '🌪️', name: 'Tornado' },
    sphere: { emoji: '🔮', name: 'Sphere' },
};

// Hand connection lines for drawing landmarks
export const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [0, 13], [13, 14], [14, 15], [15, 16],// Ring
    [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [5, 9], [9, 13], [13, 17],          // Palm
];
