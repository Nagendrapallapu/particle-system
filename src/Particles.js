import * as THREE from 'three';
import { parametric, randomRange, SHAPE_COLORS, SHAPE_META } from './utils.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.count = 20000;
        this.currentTemplate = 'galaxy';
        this.morphSpeed = 0.04;
        this.time = 0;
        this.colorPaletteIndex = 0;

        // ─── Geometry ───
        this.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const velocities = new Float32Array(this.count * 3);
        const randoms = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
            colors[i * 3] = 0.2;
            colors[i * 3 + 1] = 0.5;
            colors[i * 3 + 2] = 1.0;
            sizes[i] = randomRange(0.2, 1.0);
            randoms[i] = Math.random();
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

        this.velocities = velocities;
        this.targetPositions = new Float32Array(this.count * 3);
        this.targetColors = new Float32Array(this.count * 3);

        // ─── Custom Shader Material ───
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uExpansion: { value: 1.0 },
            },
            vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float aRandom;

        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uExpansion;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vec3 pos = position * uExpansion;
          // Gentle breathing motion
          pos += sin(uTime * 0.8 + aRandom * 6.283) * 0.15;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          float sizeAtt = size * (280.0 / -mvPosition.z) * uPixelRatio;
          gl_PointSize = max(sizeAtt, 1.0);

          // Fade distant particles
          float dist = length(mvPosition.xyz);
          vAlpha = smoothstep(200.0, 20.0, dist);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
            fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          if (dist > 0.5) discard;

          // Soft glow
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          alpha = pow(alpha, 1.8);

          // Inner hot-core
          float innerGlow = 1.0 - smoothstep(0.0, 0.25, dist);
          vec3 color = mix(vColor, vec3(1.0), innerGlow * 0.4);

          gl_FragColor = vec4(color, alpha * vAlpha * 0.85);
        }
      `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);

        // Initialize targets
        this.setTemplate('galaxy');
    }

    setTemplate(templateName) {
        if (!parametric[templateName]) return;
        this.currentTemplate = templateName;

        const dummy = new THREE.Vector3();
        const palette = SHAPE_COLORS[templateName] || SHAPE_COLORS.sphere;

        for (let i = 0; i < this.count; i++) {
            const u = Math.random();
            const v = Math.random();
            parametric[templateName](u, v, dummy);

            // Small random jitter for organic feel
            dummy.x += (Math.random() - 0.5) * 0.3;
            dummy.y += (Math.random() - 0.5) * 0.3;
            dummy.z += (Math.random() - 0.5) * 0.3;

            this.targetPositions[i * 3] = dummy.x;
            this.targetPositions[i * 3 + 1] = dummy.y;
            this.targetPositions[i * 3 + 2] = dummy.z;

            // Target color
            const c = palette[i % palette.length];
            // Add slight random variation
            const variation = 0.1;
            this.targetColors[i * 3] = Math.min(1, c[0] + (Math.random() - 0.5) * variation);
            this.targetColors[i * 3 + 1] = Math.min(1, c[1] + (Math.random() - 0.5) * variation);
            this.targetColors[i * 3 + 2] = Math.min(1, c[2] + (Math.random() - 0.5) * variation);
        }

        // Show shape indicator
        this.showShapeIndicator(templateName);
    }

    showShapeIndicator(name) {
        const indicator = document.getElementById('shape-indicator');
        const emojiEl = document.getElementById('shape-emoji');
        const nameEl = document.getElementById('shape-name');
        const meta = SHAPE_META[name];
        if (!indicator || !meta) return;

        emojiEl.textContent = meta.emoji;
        nameEl.textContent = meta.name;

        indicator.classList.remove('hidden');
        indicator.classList.add('show');

        clearTimeout(this._indicatorTimeout);
        this._indicatorTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 1200);
    }

    update(dt, gestures) {
        if (!gestures) gestures = {};
        this.time += dt;
        this.material.uniforms.uTime.value = this.time;

        const positions = this.geometry.attributes.position.array;
        const colors = this.geometry.attributes.color.array;
        const sizes = this.geometry.attributes.size.array;

        // ─── Gesture → Template mapping ───
        if (gestures.isFist) {
            if (this.currentTemplate !== 'heart') this.setTemplate('heart');
        } else if (gestures.isPinching) {
            if (this.currentTemplate !== 'dna') this.setTemplate('dna');
        } else if (gestures.isOpen) {
            if (this.currentTemplate !== 'galaxy') this.setTemplate('galaxy');
        } else if (gestures.isRock) {
            if (this.currentTemplate !== 'saturn') this.setTemplate('saturn');
        } else if (gestures.isPeace) {
            if (this.currentTemplate !== 'flower') this.setTemplate('flower');
        } else if (gestures.isPointing) {
            if (this.currentTemplate !== 'fireworks') this.setTemplate('fireworks');
        }

        // Hand-based expansion
        const targetExpansion = gestures.handDetected
            ? 0.7 + gestures.handSpread * 0.8
            : 1.0;
        const currentExp = this.material.uniforms.uExpansion.value;
        this.material.uniforms.uExpansion.value += (targetExpansion - currentExp) * 0.03;

        // Pointer interaction position (in world-ish space)
        const hasPointer = gestures.handDetected && gestures.pointer;
        const bx = hasPointer ? gestures.pointer.x * 40 : 9999;
        const by = hasPointer ? gestures.pointer.y * 20 : 9999;

        // ─── Per-particle update ───
        const seekStrength = 2.5;
        const damping = 0.88;
        const colorLerp = 0.025;

        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;

            let px = positions[i3];
            let py = positions[i3 + 1];
            let pz = positions[i3 + 2];

            let vx = this.velocities[i3];
            let vy = this.velocities[i3 + 1];
            let vz = this.velocities[i3 + 2];

            // Target seeking
            const tx = this.targetPositions[i3];
            const ty = this.targetPositions[i3 + 1];
            const tz = this.targetPositions[i3 + 2];

            if (!isNaN(tx)) {
                vx += (tx - px) * seekStrength * dt;
                vy += (ty - py) * seekStrength * dt;
                vz += (tz - pz) * seekStrength * dt;
            }

            // Hand repulsion / ripple
            const dx = bx - px;
            const dy = by - py;
            const dz = 0 - pz;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < 50 && distSq > 0.01) {
                const dist = Math.sqrt(distSq);
                const force = (7 - dist) * 3.0;
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                vx -= nx * force * dt * 6;
                vy -= ny * force * dt * 6;
                vz -= nz * force * dt * 6;

                // Highlight particles near hand
                colors[i3] = Math.min(1, colors[i3] + 0.15);
                colors[i3 + 1] = Math.min(1, colors[i3 + 1] + 0.15);
                colors[i3 + 2] = Math.min(1, colors[i3 + 2] + 0.15);
            } else {
                // Lerp to target color
                colors[i3] += (this.targetColors[i3] - colors[i3]) * colorLerp;
                colors[i3 + 1] += (this.targetColors[i3 + 1] - colors[i3 + 1]) * colorLerp;
                colors[i3 + 2] += (this.targetColors[i3 + 2] - colors[i3 + 2]) * colorLerp;
            }

            // Damping
            vx *= damping;
            vy *= damping;
            vz *= damping;

            // Integrate
            px += vx * dt;
            py += vy * dt;
            pz += vz * dt;

            positions[i3] = px;
            positions[i3 + 1] = py;
            positions[i3 + 2] = pz;
            this.velocities[i3] = vx;
            this.velocities[i3 + 1] = vy;
            this.velocities[i3 + 2] = vz;

            // Pulsing particle sizes
            sizes[i] = 0.3 + 0.4 * Math.sin(this.time * 1.5 + i * 0.01);
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
    }

    // Allow external color palette cycling
    cycleColors() {
        const palette = SHAPE_COLORS[this.currentTemplate] || SHAPE_COLORS.sphere;
        // Shift palette hue slightly
        for (let i = 0; i < this.count; i++) {
            const c = palette[(i + this.colorPaletteIndex) % palette.length];
            const hueShift = this.colorPaletteIndex * 0.25;
            this.targetColors[i * 3] = Math.min(1, c[0] * Math.cos(hueShift) + c[2] * Math.sin(hueShift));
            this.targetColors[i * 3 + 1] = c[1];
            this.targetColors[i * 3 + 2] = Math.min(1, c[2] * Math.cos(hueShift) - c[0] * Math.sin(hueShift));
        }
        this.colorPaletteIndex++;
    }
}
