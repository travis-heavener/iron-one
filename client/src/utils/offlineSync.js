/******************************************************************************
 * Offline Sync & Local Resilience Shield
 * Caches active workout state locally to protect in-progress workouts from Wi-Fi drops
 ******************************************************************************/

const DRAFT_KEY = "ironone_active_workout_draft";
const QUEUE_KEY = "ironone_offline_queue";

// Save active workout draft snapshot to localStorage
export const saveWorkoutDraft = ( workoutData ) => {
    if ( typeof window === "undefined" || !workoutData ) return;
    try {
        localStorage.setItem( DRAFT_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            workout: workoutData
        }) );
    } catch ( err ) {
        console.warn( "[OfflineSync] Failed to save draft:", err );
    }
};

// Retrieve cached workout draft from localStorage
export const getWorkoutDraft = () => {
    if ( typeof window === "undefined" ) return null;
    try {
        const raw = localStorage.getItem( DRAFT_KEY );
        if ( !raw ) return null;
        return JSON.parse( raw );
    } catch {
        return null;
    }
};

// Clear cached workout draft upon completion or discard
export const clearWorkoutDraft = () => {
    if ( typeof window === "undefined" ) return;
    try {
        localStorage.removeItem( DRAFT_KEY );
    } catch {}
};

// Retrieve pending offline action queue
export const getOfflineQueue = () => {
    if ( typeof window === "undefined" ) return [];
    try {
        const raw = localStorage.getItem( QUEUE_KEY );
        return raw ? JSON.parse( raw ) : [];
    } catch {
        return [];
    }
};

// Enqueue offline set update for automatic background sync when reconnected
export const enqueueOfflineUpdate = ( setId, payload ) => {
    if ( typeof window === "undefined" || !setId ) return;
    try {
        const queue = getOfflineQueue();
        const existingIdx = queue.findIndex( ( item ) => item.setId === setId );
        if ( existingIdx >= 0 ) {
            queue[existingIdx].payload = { ...queue[existingIdx].payload, ...payload };
            queue[existingIdx].timestamp = Date.now();
        } else {
            queue.push({
                setId,
                payload,
                timestamp: Date.now()
            });
        }
        localStorage.setItem( QUEUE_KEY, JSON.stringify( queue ) );
    } catch ( err ) {
        console.warn( "[OfflineSync] Failed to enqueue update:", err );
    }
};

// Clear pending offline queue
export const clearOfflineQueue = () => {
    if ( typeof window === "undefined" ) return;
    try {
        localStorage.removeItem( QUEUE_KEY );
    } catch {}
};
