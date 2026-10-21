/******************************************************************************
 * API Client Layer
 * Standardized HTTP request handler w/ JWT token injection and domain endpoints
 ******************************************************************************/

const TOKEN_KEY = "ironone_token";

// Used to retrieve stored authentication token
export const getToken = () => {
    return localStorage.getItem( TOKEN_KEY );
};

// Used to persist authentication token
export const setToken = ( token ) => {
    if ( token ) {
        localStorage.setItem( TOKEN_KEY, token );
    } else {
        localStorage.removeItem( TOKEN_KEY );
    }
};

// Used to remove authentication token
export const removeToken = () => {
    localStorage.removeItem( TOKEN_KEY );
};

// Used to execute standardized HTTP API requests
export const apiRequest = async ( endpoint, options = {} ) => {
    const token = getToken();
    const headers = {
        ...( options.headers || {} )
    };

    // Attach authorization header when token exists
    if ( token && !headers["Authorization"] ) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    // Default to JSON body unless FormData is passed
    if ( options.body && !( options.body instanceof FormData ) && !headers["Content-Type"] ) {
        headers["Content-Type"] = "application/json";
    }

    const config = {
        ...options,
        headers,
        body: options.body instanceof FormData
            ? options.body
            : ( options.body && typeof options.body === "object" ? JSON.stringify( options.body ) : options.body )
    };

    const response = await fetch( endpoint, config );
    const isJson = response.headers.get( "content-type" )?.includes( "application/json" );
    
    let data = null;
    if ( response.status !== 204 ) {
        const text = await response.text();
        if ( text ) {
            try {
                data = isJson ? JSON.parse( text ) : text;
            } catch {
                data = text;
            }
        }
    }

    if ( !response.ok ) {
        if ( response.status === 401 && token ) {
            removeToken();
            if ( typeof window !== "undefined" ) {
                window.dispatchEvent( new CustomEvent( "ironone:unauthorized" ) );
            }
        }

        const error = new Error( data?.error?.message || response.statusText || "Request failed" );
        error.status = response.status;
        error.code = data?.error?.code || "ERR_HTTP_ERROR";
        error.details = data?.error?.details || null;
        throw error;
    }

    return data?.data !== undefined ? data.data : data;
};

// Auth API endpoints
export const authApi = {
    login: ( credentials ) => apiRequest( "/api/auth/login", { method: "POST", body: credentials } ),
    register: ( credentials ) => apiRequest( "/api/auth/register", { method: "POST", body: credentials } )
};

// System & Diagnostic API endpoints
export const systemApi = {
    getHealth: () => apiRequest( "/api/health" )
};

// User Profile API endpoints
export const userApi = {
    getProfile: () => apiRequest( "/api/user/profile" ),
    updateProfile: ( profileData ) => apiRequest( "/api/user/profile", { method: "PUT", body: profileData } ),
    uploadAvatar: ( formData ) => apiRequest( "/api/user/avatar", { method: "POST", body: formData } )
};

// Exercise Catalog API endpoints
export const exerciseApi = {
    getExercises: ( params = {} ) => {
        const query = new URLSearchParams( params ).toString();
        return apiRequest( `/api/exercises${query ? `?${query}` : ""}` );
    },
    getExerciseById: ( id ) => apiRequest( `/api/exercises/${id}` ),
    createExercise: ( exerciseData ) => apiRequest( "/api/exercises", { method: "POST", body: exerciseData } ),
    updateExercise: ( id, exerciseData ) => apiRequest( `/api/exercises/${id}`, { method: "PUT", body: exerciseData } ),
    deleteExercise: ( id ) => apiRequest( `/api/exercises/${id}`, { method: "DELETE" } )
};

// Workout Routines (Templates) API endpoints
export const routineApi = {
    getRoutines: ( params = {} ) => {
        const query = new URLSearchParams( params ).toString();
        return apiRequest( `/api/routines${query ? `?${query}` : ""}` );
    },
    getRoutineById: ( id ) => apiRequest( `/api/routines/${id}` ),
    createRoutine: ( routineData ) => apiRequest( "/api/routines", { method: "POST", body: routineData } ),
    updateRoutine: ( id, routineData ) => apiRequest( `/api/routines/${id}`, { method: "PUT", body: routineData } ),
    copyRoutine: ( id, copyData = {} ) => apiRequest( `/api/routines/${id}/copy`, { method: "POST", body: copyData } ),
    startRoutine: ( id, startData = {} ) => apiRequest( `/api/routines/${id}/start`, { method: "POST", body: startData } ),
    deleteRoutine: ( id ) => apiRequest( `/api/routines/${id}`, { method: "DELETE" } )
};

// Workout Entries (Daily Journal & Live Gym Logs) API endpoints
export const workoutApi = {
    getActiveWorkout: () => apiRequest( "/api/workout-entries/active" ),
    createWorkout: ( entryData = {} ) => apiRequest( "/api/workout-entries", { method: "POST", body: entryData } ),
    getWorkouts: ( params = {} ) => {
        const query = new URLSearchParams( params ).toString();
        return apiRequest( `/api/workout-entries${query ? `?${query}` : ""}` );
    },
    getCalendar: ( params = {} ) => {
        const query = new URLSearchParams( params ).toString();
        return apiRequest( `/api/workout-entries/calendar${query ? `?${query}` : ""}` );
    },
    getStreak: ( timezoneOffset ) => {
        const query = timezoneOffset !== undefined ? `?timezoneOffset=${encodeURIComponent( timezoneOffset )}` : "";
        return apiRequest( `/api/workout-entries/streak${query}` );
    },
    getWorkoutById: ( id ) => apiRequest( `/api/workout-entries/${id}` ),
    updateWorkout: ( id, entryData ) => apiRequest( `/api/workout-entries/${id}`, { method: "PUT", body: entryData } ),
    completeWorkout: ( id, completeData = {} ) => apiRequest( `/api/workout-entries/${id}/complete`, { method: "POST", body: completeData } ),
    cloneWorkout: ( id, cloneData = {} ) => apiRequest( `/api/workout-entries/${id}/clone`, { method: "POST", body: cloneData } ),
    deleteWorkout: ( id ) => apiRequest( `/api/workout-entries/${id}`, { method: "DELETE" } )
};

// Workout Exercises & Sets API endpoints
export const workoutExerciseApi = {
    addExercise: ( workoutEntryId, exerciseData ) => apiRequest( `/api/workout-entries/${workoutEntryId}/exercises`, { method: "POST", body: exerciseData } ),
    updateExercise: ( id, exerciseData ) => apiRequest( `/api/workout-exercises/${id}`, { method: "PUT", body: exerciseData } ),
    deleteExercise: ( id ) => apiRequest( `/api/workout-exercises/${id}`, { method: "DELETE" } ),
    swapExercise: ( id, swapData ) => apiRequest( `/api/workout-exercises/${id}/swap`, { method: "POST", body: swapData } )
};

export const setApi = {
    addSet: ( workoutExerciseId, setData = {} ) => apiRequest( `/api/workout-exercises/${workoutExerciseId}/sets`, { method: "POST", body: setData } ),
    updateSet: ( id, setData ) => apiRequest( `/api/sets/${id}`, { method: "PUT", body: setData } ),
    deleteSet: ( id ) => apiRequest( `/api/sets/${id}`, { method: "DELETE" } )
};

