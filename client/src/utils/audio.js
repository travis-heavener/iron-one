/******************************************************************************
 * Audio & Haptic Feedback Utility
 * Web Audio API synthesized tones and mobile vibration without external assets
 ******************************************************************************/

let audioCtx = null;

// Initialize or resume browser AudioContext
const getAudioContext = () => {
    if ( typeof window === "undefined" ) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if ( !AudioContextClass ) return null;
    if ( !audioCtx ) {
        audioCtx = new AudioContextClass();
    }
    if ( audioCtx.state === "suspended" ) {
        audioCtx.resume();
    }
    return audioCtx;
};

// Prime audio context on user gesture
export const primeAudioContext = () => {
    getAudioContext();
};

// Native haptic feedback trigger w/ fallback verification
export const triggerHaptic = ( pattern = [ 60 ] ) => {
    if ( typeof navigator === "undefined" || !( "vibrate" in navigator ) ) {
        return false;
    }
    try {
        const payload = Array.isArray( pattern ) ? pattern : [ pattern ];
        const success = navigator.vibrate( payload );
        return success;
    } catch ( err ) {
        console.warn( "[Haptics] Vibration failed:", err );
        return false;
    }
};

// Play a cheerful chime when rest timer completes
export const playTimerCompleteTone = () => {
    try {
        const ctx = getAudioContext();
        if ( !ctx ) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        // Two-tone rising chime (880Hz -> 1760Hz)
        osc.frequency.setValueAtTime( 880, now );
        osc.frequency.exponentialRampToValueAtTime( 1760, now + 0.15 );

        gain.gain.setValueAtTime( 0.25, now );
        gain.gain.exponentialRampToValueAtTime( 0.001, now + 0.6 );

        osc.connect( gain );
        gain.connect( ctx.destination );

        osc.start( now );
        osc.stop( now + 0.6 );
    } catch ( err ) {
        console.warn( "[Audio] Unable to play timer tone:", err );
    }

    // Trigger mobile vibration if supported on device
    triggerHaptic( [ 120, 80, 120 ] );
};

// Short tactile click tone for set completion
export const playSetDoneTone = () => {
    try {
        const ctx = getAudioContext();
        if ( !ctx ) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime( 660, now );
        osc.frequency.exponentialRampToValueAtTime( 880, now + 0.08 );

        gain.gain.setValueAtTime( 0.15, now );
        gain.gain.exponentialRampToValueAtTime( 0.001, now + 0.1 );

        osc.connect( gain );
        gain.connect( ctx.destination );

        osc.start( now );
        osc.stop( now + 0.1 );
    } catch {}

    // Trigger snappy haptic pulse on mobile hardware
    triggerHaptic( [ 60 ] );
};
