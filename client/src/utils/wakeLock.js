/******************************************************************************
 * Screen Wake Lock Utility
 * Keeps mobile display awake during active gym workouts and rest intervals
 ******************************************************************************/

let sentinel = null;

// Request screen wake lock to prevent mobile display sleep
export const requestWakeLock = async () => {
    if ( typeof navigator === "undefined" || !( "wakeLock" in navigator ) ) return;
    try {
        if ( !sentinel || sentinel.released ) {
            sentinel = await navigator.wakeLock.request( "screen" );
            sentinel.addEventListener( "release", () => {
                sentinel = null;
            } );
        }
    } catch {
        // Ignored if unsupported or user has low battery
    }
};

// Release screen wake lock
export const releaseWakeLock = async () => {
    if ( sentinel && !sentinel.released ) {
        try {
            await sentinel.release();
        } catch {}
        sentinel = null;
    }
};

