/******************************************************************************
 * Confetti Celebration Utility
 * High-performance particle bursts via canvas-confetti on workout completion
 ******************************************************************************/

import confetti from "canvas-confetti";

import { triggerHaptic } from "./audio.js";

// Multi-stage celebratory confetti cannons for completed workout
export const fireWorkoutConfetti = () => {
    // Stage 1: Massive center explosion
    confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: [ "#10b981", "#34d399", "#06b6d4", "#f59e0b", "#ec4899", "#8b5cf6" ],
        disableForReducedMotion: true
    });

    // Stage 2: Left and right perimeter cannons
    setTimeout( () => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.75 },
            colors: [ "#10b981", "#34d399", "#6ee7b7", "#fbbf24" ],
            disableForReducedMotion: true
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.75 },
            colors: [ "#10b981", "#34d399", "#6ee7b7", "#fbbf24" ],
            disableForReducedMotion: true
        });
    }, 200 );

    // Stage 3: Shimmering gold and emerald sparkle shower
    setTimeout( () => {
        confetti({
            particleCount: 40,
            spread: 120,
            origin: { y: 0.5 },
            shapes: [ "circle" ],
            colors: [ "#fbbf24", "#38bdf8", "#34d399", "#a7f3d0" ],
            scalar: 1.2,
            disableForReducedMotion: true
        });
    }, 400 );

    // Celebratory victory haptic pattern on mobile hardware
    triggerHaptic( [ 80, 50, 100, 50, 150 ] );
};

