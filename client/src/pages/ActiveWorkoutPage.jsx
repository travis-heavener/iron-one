/******************************************************************************
 * Active Workout Page Component
 * Live gym session tracker w/ tactile sets, hot-swapping, rest timer, and offline shield
 ******************************************************************************/

import {
    Activity,
    ArrowLeftRight,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Dumbbell,
    Edit2,
    FileText,
    Flame,
    Gauge,
    Info,
    Loader2,
    Minus,
    Plus,
    RefreshCw,
    Search,
    Timer,
    Trash2,
    WifiOff,
    X
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { exerciseApi, setApi, workoutApi, workoutExerciseApi } from "../api/client.js";
import { RestTimer } from "../components/RestTimer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";
import { playSetDoneTone, primeAudioContext } from "../utils/audio.js";
import { fireWorkoutConfetti } from "../utils/confetti.js";
import {
    clearOfflineQueue,
    clearWorkoutDraft,
    enqueueOfflineUpdate,
    getOfflineQueue,
    getWorkoutDraft,
    saveWorkoutDraft
} from "../utils/offlineSync.js";
import { releaseWakeLock, requestWakeLock } from "../utils/wakeLock.js";

// Standard exercise category filters for pickers
const PICKER_CATEGORIES = [
    "All",
    "Chest",
    "Back",
    "Shoulders",
    "Legs",
    "Arms",
    "Core",
    "Cardio",
    "Full Body"
];

// Set type sequence for 1-tap cycling
const SET_TYPES = [ "NORMAL", "WARMUP", "DROP", "FAILURE" ];

// Used to identify if movement is cardio-oriented (minutes-based pacing)
const isCardioMovement = ( ex ) => {
    if ( !ex ) return false;
    if ( ex.modality === "DISTANCE_TIME" ) return true;
    if ( ex.category === "Cardio" ) return true;
    const name = ( ex.name || "" ).toLowerCase();
    return name.includes( "running" ) || name.includes( "bike" ) || name.includes( "rowing" ) || name.includes( "jump rope" ) || name.includes( "cardio" );
};

// Used to calculate pace in MM:SS per distance unit
const calculatePace = ( distance, durationSeconds, unit ) => {
    if ( !distance || distance <= 0 || !durationSeconds || durationSeconds <= 0 ) return null;
    const paceTotalMinutes = ( durationSeconds / 60 ) / distance;
    const mins = Math.floor( paceTotalMinutes );
    const secs = Math.round( ( paceTotalMinutes - mins ) * 60 );
    return `${mins}:${String( secs ).padStart( 2, "0" )}/${unit}`;
};

// Used to format live elapsed time in MM:SS or HH:MM:SS
const formatElapsed = ( startedAt ) => {
    if ( !startedAt ) return "00:00";
    const diff = Math.max( 0, Math.floor( ( Date.now() - new Date( startedAt ).getTime() ) / 1000 ) );
    const hours = Math.floor( diff / 3600 );
    const minutes = Math.floor( ( diff % 3600 ) / 60 );
    const seconds = diff % 60;

    const pad = ( n ) => String( n ).padStart( 2, "0" );
    if ( hours > 0 ) {
        return `${hours}:${pad( minutes )}:${pad( seconds )}`;
    }
    return `${pad( minutes )}:${pad( seconds )}`;
};

// Used to track and manage live in-progress gym workout session
export const ActiveWorkoutPage = ({ onNavigate }) => {
    const { activeWorkout, refreshActiveWorkout, setActiveWorkout, user } = useAuth();
    const modal = useModal();

    const isMetric = user?.unitPreference === "metric";
    const weightUnit = isMetric ? "kg" : "lbs";
    const weightStep = isMetric ? 2.5 : 5;
    const distanceUnit = isMetric ? "km" : "mi";

    const [ workoutDetails, setWorkoutDetails ] = useState( null );
    const [ loadingDetails, setLoadingDetails ] = useState( false );
    const [ elapsed, setElapsed ] = useState( "00:00" );
    const [ finishing, setFinishing ] = useState( false );
    const [ discarding, setDiscarding ] = useState( false );
    const [ startingEmpty, setStartingEmpty ] = useState( false );
    const [ isOnline, setIsOnline ] = useState( typeof navigator !== "undefined" ? navigator.onLine : true );

    // Rest Timer State
    const [ isRestTimerOpen, setIsRestTimerOpen ] = useState( false );
    const [ restTimerTrigger, setRestTimerTrigger ] = useState( 0 );

    // Session Notes & Renaming modal state
    const [ isDetailsModalOpen, setIsDetailsModalOpen ] = useState( false );
    const [ sessionNameInput, setSessionNameInput ] = useState( "" );
    const [ sessionNotesInput, setSessionNotesInput ] = useState( "" );
    const [ savingSessionDetails, setSavingSessionDetails ] = useState( false );

    // Exercise Notes drawer state: { [workoutExerciseId]: boolean }
    const [ expandedExerciseNotes, setExpandedExerciseNotes ] = useState( {} );

    // Exercise Picker modal state
    const [ isPickerOpen, setIsPickerOpen ] = useState( false );
    const [ catalogExercises, setCatalogExercises ] = useState( [] );
    const [ loadingCatalog, setLoadingCatalog ] = useState( false );
    const [ pickerSearch, setPickerSearch ] = useState( "" );
    const [ pickerCategory, setPickerCategory ] = useState( "All" );
    const [ addingExerciseId, setAddingExerciseId ] = useState( null );
    const [ removingExerciseId, setRemovingExerciseId ] = useState( null );

    // Exercise Hot-Swap modal state
    const [ isSwapOpen, setIsSwapOpen ] = useState( false );
    const [ swapTarget, setSwapTarget ] = useState( null ); // Target shape: { workoutExerciseId, exerciseId, exerciseName, exerciseCategory }
    const [ swapSearch, setSwapSearch ] = useState( "" );
    const [ swapCategory, setSwapCategory ] = useState( "All" );
    const [ swapKeepSets, setSwapKeepSets ] = useState( true );
    const [ swapping, setSwapping ] = useState( false );

    const pickerCategoryScrollRef = useRef( null );
    const swapCategoryScrollRef = useRef( null );

    // Used to smoothly scroll horizontal chip containers on desktop button click
    const handleScrollContainer = ( ref, direction ) => {
        if ( ref.current ) {
            ref.current.scrollBy({ left: direction * 160, behavior: "smooth" });
        }
    };

    // Used to translate vertical mouse wheel into horizontal chip scrolling on desktop
    const handleWheelHorizontal = ( e ) => {
        if ( e.deltaY !== 0 ) {
            e.currentTarget.scrollLeft += e.deltaY;
        }
    };

    // Debounce timers and actions map to throttle rapid stepper clicks and keystrokes
    const debounceTimers = useRef( {} );
    const pendingDebounceActions = useRef( {} );
    const workoutDetailsRef = useRef( null );
    const activeWorkoutRef = useRef( activeWorkout );

    useEffect( () => {
        workoutDetailsRef.current = workoutDetails;
    }, [ workoutDetails ] );

    useEffect( () => {
        activeWorkoutRef.current = activeWorkout;
    }, [ activeWorkout ] );

    const flushPendingDebouncedUpdates = async () => {
        const promises = [];
        for ( const [ key, timer ] of Object.entries( debounceTimers.current ) ) {
            clearTimeout( timer );
            if ( pendingDebounceActions.current[key] ) {
                promises.push( pendingDebounceActions.current[key]() );
                delete pendingDebounceActions.current[key];
            }
        }
        debounceTimers.current = {};
        if ( promises.length > 0 ) {
            await Promise.allSettled( promises );
        }
    };

    // Clean up debounce timers on unmount
    useEffect( () => {
        return () => {
            Object.values( debounceTimers.current ).forEach( ( timer ) => clearTimeout( timer ) );
            debounceTimers.current = {};
            pendingDebounceActions.current = {};
        };
    }, [] );

    // Screen wake lock during active workout session
    useEffect( () => {
        if ( activeWorkout ) {
            requestWakeLock();
            const handleVisibility = () => {
                if ( document.visibilityState === "visible" ) {
                    requestWakeLock();
                }
            };
            document.addEventListener( "visibilitychange", handleVisibility );
            return () => {
                document.removeEventListener( "visibilitychange", handleVisibility );
                releaseWakeLock();
            };
        }
    }, [ activeWorkout?.id ] );

    // Network connectivity listener w/ automatic offline update queue flush
    useEffect( () => {
        const handleOnline = async () => {
            setIsOnline( true );
            const queue = getOfflineQueue();
            if ( queue.length > 0 ) {
                const remainingQueue = [];
                for ( const item of queue ) {
                    try {
                        await setApi.updateSet( item.setId, item.payload );
                    } catch ( err ) {
                        console.warn( "[ActiveWorkout] Failed to sync queued offline update:", item, err );
                        remainingQueue.push( item );
                    }
                }
                if ( remainingQueue.length === 0 ) {
                    clearOfflineQueue();
                } else {
                    localStorage.setItem( "ironone_offline_queue", JSON.stringify( remainingQueue ) );
                }
                await fetchFullWorkout( true );
            }
        };

        const handleOffline = () => setIsOnline( false );

        window.addEventListener( "online", handleOnline );
        window.addEventListener( "offline", handleOffline );
        return () => {
            window.removeEventListener( "online", handleOnline );
            window.removeEventListener( "offline", handleOffline );
        };
    }, [] );

    // Lock background scroll when any modal is open
    useEffect( () => {
        if ( isPickerOpen || isSwapOpen || isDetailsModalOpen ) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [ isPickerOpen, isSwapOpen, isDetailsModalOpen ] );

    // Fetch full workout details w/ exercises and sets on mount/change
    const fetchFullWorkout = async ( silent = false ) => {
        const targetId = activeWorkoutRef.current?.id || activeWorkout?.id;
        if ( !targetId ) {
            setWorkoutDetails( null );
            return;
        }

        if ( !silent ) setLoadingDetails( true );
        try {
            const data = await workoutApi.getWorkoutById( targetId );
            setWorkoutDetails( data );
            workoutDetailsRef.current = data;
            saveWorkoutDraft( data );
        } catch ( err ) {
            if ( !silent ) {
                console.error( "[ActiveWorkout] Failed to load session details:", err );
                const cached = getWorkoutDraft();
                if ( cached?.workout && cached.workout.id === targetId ) {
                    setWorkoutDetails( cached.workout );
                    workoutDetailsRef.current = cached.workout;
                }
            }
        } finally {
            if ( !silent ) setLoadingDetails( false );
        }
    };

    useEffect( () => {
        fetchFullWorkout();
    }, [ activeWorkout?.id ] );

    // Multi-device sync: poll active session every 3.5s and on window focus
    useEffect( () => {
        if ( !activeWorkout?.id ) return;

        let isPolling = false;

        const syncRemoteState = async () => {
            if ( isPolling || document.visibilityState !== "visible" ) return;
            // Skip sync if user is actively typing in input or pending debounce
            const activeEl = document.activeElement;
            if ( activeEl && ( activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" ) ) {
                return;
            }
            if ( Object.keys( debounceTimers.current ).length > 0 ) {
                return;
            }

            isPolling = true;
            try {
                const remote = await workoutApi.getWorkoutById( activeWorkout.id );
                if ( !remote ) return;

                setWorkoutDetails( ( current ) => {
                    if ( !current ) return remote;
                    const currentExercises = current.workoutExercises || [];
                    const remoteExercises = remote.workoutExercises || [];

                    // Check if exercises were added, removed, or swapped on another device
                    const hasExerciseCountChange = currentExercises.length !== remoteExercises.length;
                    const hasExerciseIdChange = remoteExercises.some( ( re, idx ) => (
                        !currentExercises[idx] || currentExercises[idx].id !== re.id
                    ) );

                    if ( hasExerciseCountChange || hasExerciseIdChange ) {
                        saveWorkoutDraft( remote );
                        refreshActiveWorkout();
                        return remote;
                    }

                    // Check if set metrics or completion status changed remotely
                    const hasSetChanges = remoteExercises.some( ( re, idx ) => {
                        const ce = currentExercises[idx];
                        if ( !ce ) return true;
                        if ( ( ce.sets || [] ).length !== ( re.sets || [] ).length ) return true;
                        return re.sets?.some( ( rs, sIdx ) => {
                            const cs = ce.sets[sIdx];
                            if ( !cs ) return true;
                            return cs.isCompleted !== rs.isCompleted ||
                                   cs.weight !== rs.weight ||
                                   cs.reps !== rs.reps ||
                                   cs.durationSeconds !== rs.durationSeconds ||
                                   cs.distance !== rs.distance ||
                                   cs.setType !== rs.setType;
                        } );
                    } );

                    if ( hasSetChanges ) {
                        saveWorkoutDraft( remote );
                        return remote;
                    }

                    return current;
                } );
            } catch ( err ) {
                // Ignore transient network hiccups during background sync
            } finally {
                isPolling = false;
            }
        };

        const interval = setInterval( syncRemoteState, 3500 );
        const handleFocus = () => syncRemoteState();
        window.addEventListener( "focus", handleFocus );
        document.addEventListener( "visibilitychange", handleFocus );

        return () => {
            clearInterval( interval );
            window.removeEventListener( "focus", handleFocus );
            document.removeEventListener( "visibilitychange", handleFocus );
        };
    }, [ activeWorkout?.id ] );

    // Live elapsed timer interval
    useEffect( () => {
        if ( !activeWorkout?.startedAt ) return;

        setElapsed( formatElapsed( activeWorkout.startedAt ) );
        const interval = setInterval( () => {
            setElapsed( formatElapsed( activeWorkout.startedAt ) );
        }, 1000 );

        return () => clearInterval( interval );
    }, [ activeWorkout?.startedAt ] );

    // Ensure exercise catalog is loaded for picker or swap
    const ensureCatalogLoaded = async () => {
        if ( catalogExercises.length === 0 ) {
            setLoadingCatalog( true );
            try {
                const data = await exerciseApi.getExercises();
                setCatalogExercises( Array.isArray( data ) ? data : [] );
            } catch ( err ) {
                console.error( "[ActiveWorkout] Failed to load exercise catalog:", err );
            } finally {
                setLoadingCatalog( false );
            }
        }
    };

    // Open Exercise Picker
    const handleOpenPicker = async () => {
        primeAudioContext();
        setIsPickerOpen( true );
        setPickerSearch( "" );
        setPickerCategory( "All" );
        await ensureCatalogLoaded();
    };

    // Open Hot-Swap Modal
    const handleOpenSwap = async ( we, ex ) => {
        primeAudioContext();
        setSwapTarget({
            workoutExerciseId: we.id,
            exerciseId: ex.id,
            exerciseName: ex.name,
            exerciseCategory: ex.category
        });
        setSwapSearch( "" );
        setSwapCategory( ex.category || "All" );
        setSwapKeepSets( true );
        setIsSwapOpen( true );
        await ensureCatalogLoaded();
    };

    // Open Workout Details / Renaming Modal
    const handleOpenDetailsModal = () => {
        setSessionNameInput( workoutDetails?.name || activeWorkout?.name || "Quick Workout" );
        setSessionNotesInput( workoutDetails?.notes || activeWorkout?.notes || "" );
        setIsDetailsModalOpen( true );
    };

    // Save Workout Details (name and session notes)
    const handleSaveSessionDetails = async () => {
        if ( !activeWorkout?.id ) return;

        setSavingSessionDetails( true );
        try {
            await workoutApi.updateWorkout( activeWorkout.id, {
                name: sessionNameInput.trim() || "Quick Workout",
                notes: sessionNotesInput.trim() || null
            } );
            await fetchFullWorkout();
            await refreshActiveWorkout();
            setIsDetailsModalOpen( false );
        } catch ( err ) {
            await modal.alert({
                title: "Update Error",
                message: err.message || "Failed to update workout details"
            });
        } finally {
            setSavingSessionDetails( false );
        }
    };

    // Toggle exercise notes drawer
    const handleToggleExerciseNotes = ( workoutExerciseId ) => {
        setExpandedExerciseNotes( ( prev ) => ({
            ...prev,
            [workoutExerciseId]: !prev[workoutExerciseId]
        }) );
    };

    // Update exercise notes w/ debouncing
    const handleUpdateExerciseNotes = ( workoutExerciseId, notes ) => {
        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => (
                    we.id === workoutExerciseId ? { ...we, notes } : we
                ) )
            };
            saveWorkoutDraft( updated );
            return updated;
        } );

        const key = `ex_note_${workoutExerciseId}`;
        if ( debounceTimers.current[key] ) {
            clearTimeout( debounceTimers.current[key] );
        }
        const action = async () => {
            try {
                await workoutExerciseApi.updateExercise( workoutExerciseId, { notes: notes.trim() || null } );
            } catch ( err ) {
                console.error( "[ActiveWorkout] Failed to save exercise notes:", err );
            }
        };
        pendingDebounceActions.current[key] = action;
        debounceTimers.current[key] = setTimeout( async () => {
            delete debounceTimers.current[key];
            delete pendingDebounceActions.current[key];
            await action();
        }, 500 );
    };

    // Execute Exercise Swap
    const handleExecuteSwap = async ( replacementEx ) => {
        if ( !swapTarget?.workoutExerciseId ) return;

        setSwapping( true );
        try {
            await workoutExerciseApi.swapExercise( swapTarget.workoutExerciseId, {
                newExerciseId: replacementEx.id,
                keepSets: swapKeepSets
            } );
            await fetchFullWorkout();
            await refreshActiveWorkout();
            setIsSwapOpen( false );
        } catch ( err ) {
            await modal.alert({
                title: "Swap Error",
                message: err.message || "Failed to swap exercise"
            });
        } finally {
            setSwapping( false );
        }
    };

    // Add selected exercise from picker to the active workout
    const handleAddExercise = async ( ex ) => {
        if ( !activeWorkout?.id ) return;

        setAddingExerciseId( ex.id );
        try {
            await workoutExerciseApi.addExercise( activeWorkout.id, { exerciseId: ex.id } );
            await fetchFullWorkout();
            await refreshActiveWorkout();
        } catch ( err ) {
            await modal.alert({
                title: "Failed to Add Exercise",
                message: err.message || "Could not add exercise to workout session"
            });
        } finally {
            setAddingExerciseId( null );
        }
    };

    // Remove exercise from active workout session
    const handleRemoveExercise = async ( workoutExerciseId, exerciseName ) => {
        const confirmed = await modal.confirm({
            title: "Remove Exercise?",
            message: `Are you sure you want to remove "${exerciseName || "this exercise"}" and all its logged sets from this workout session?`,
            confirmText: "Remove",
            cancelText: "Keep",
            destructive: true
        });
        if ( !confirmed ) return;

        setRemovingExerciseId( workoutExerciseId );
        try {
            await workoutExerciseApi.deleteExercise( workoutExerciseId );
            await fetchFullWorkout();
            await refreshActiveWorkout();
        } catch ( err ) {
            await modal.alert({
                title: "Error Removing Exercise",
                message: err.message || "Failed to remove exercise from workout session"
            });
        } finally {
            setRemovingExerciseId( null );
        }
    };

    // Filter exercises inside picker modal
    const filteredPickerExercises = useMemo( () => {
        const query = pickerSearch.trim().toLowerCase();

        return catalogExercises.filter( ( ex ) => {
            if ( query ) {
                const matchName = ex.name?.toLowerCase().includes( query );
                const matchCat = ex.category?.toLowerCase().includes( query );
                if ( !matchName && !matchCat ) return false;
            }

            if ( pickerCategory !== "All" ) {
                if ( ex.category?.toLowerCase() !== pickerCategory.toLowerCase() ) return false;
            }

            return true;
        } );
    }, [ catalogExercises, pickerSearch, pickerCategory ] );

    // Filter exercises inside hot-swap modal (cleanly excluding active movement)
    const filteredSwapExercises = useMemo( () => {
        const query = swapSearch.trim().toLowerCase();

        return catalogExercises.filter( ( ex ) => {
            if ( swapTarget && ex.id === swapTarget.exerciseId ) return false;

            if ( query ) {
                const matchName = ex.name?.toLowerCase().includes( query );
                const matchCat = ex.category?.toLowerCase().includes( query );
                if ( !matchName && !matchCat ) return false;
            }

            if ( swapCategory !== "All" ) {
                if ( ex.category?.toLowerCase() !== swapCategory.toLowerCase() ) return false;
            }

            return true;
        } );
    }, [ catalogExercises, swapSearch, swapCategory, swapTarget ] );

    // Used to finish active workout session
    const handleFinishWorkout = async () => {
        if ( !activeWorkout?.id ) return;

        const confirmed = await modal.confirm({
            title: "Finish Workout?",
            message: "Are you ready to complete and log this workout session?",
            confirmText: "Finish Workout",
            cancelText: "Keep Going"
        });
        if ( !confirmed ) return;

        setFinishing( true );
        try {
            // Flush pending debounced updates before completing session
            await flushPendingDebouncedUpdates();
            await workoutApi.completeWorkout( activeWorkout.id );
            clearWorkoutDraft();
            clearOfflineQueue();
            fireWorkoutConfetti();
            await refreshActiveWorkout();
            onNavigate( "dashboard" );
        } catch ( err ) {
            await modal.alert({
                title: "Error Completing Session",
                message: err.message || "Failed to complete workout session"
            });
        } finally {
            setFinishing( false );
        }
    };

    // Used to cancel and discard in-progress workout session
    const handleDiscardWorkout = async () => {
        if ( !activeWorkout?.id ) return;

        const confirmed = await modal.confirm({
            title: "Discard In-Progress Workout?",
            message: "Are you sure you want to discard this workout? All sets and progress will be deleted.",
            confirmText: "Discard Workout",
            cancelText: "Keep Workout",
            destructive: true
        });
        if ( !confirmed ) return;

        // Clear debounce timers without saving
        Object.values( debounceTimers.current ).forEach( ( timer ) => clearTimeout( timer ) );
        debounceTimers.current = {};
        pendingDebounceActions.current = {};

        setDiscarding( true );
        try {
            await workoutApi.deleteWorkout( activeWorkout.id );
            clearWorkoutDraft();
            clearOfflineQueue();
            await refreshActiveWorkout();
            onNavigate( "dashboard" );
        } catch ( err ) {
            await modal.alert({
                title: "Error Discarding Session",
                message: err.message || "Failed to discard workout session"
            });
        } finally {
            setDiscarding( false );
        }
    };

    // Used to start quick workout when none is active
    const handleStartEmpty = async () => {
        setStartingEmpty( true );
        try {
            const entry = await workoutApi.createWorkout({ name: "Quick Workout" });
            setActiveWorkout( entry );
        } catch ( err ) {
            if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
                await refreshActiveWorkout();
            } else {
                await modal.alert({
                    title: "Failed to Start Workout",
                    message: err.message || "Failed to start workout"
                });
            }
        } finally {
            setStartingEmpty( false );
        }
    };

    // Used to toggle set completion status w/ rest timer auto-trigger and audio chime
    const handleToggleSet = async ( setId, currentCompleted ) => {
        const nextCompleted = !currentCompleted;

        // Optimistic UI update
        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, isCompleted: nextCompleted } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        if ( nextCompleted ) {
            playSetDoneTone();
            setRestTimerTrigger( Date.now() );
            setIsRestTimerOpen( true );
        }

        try {
            await setApi.updateSet( setId, { isCompleted: nextCompleted } );
        } catch ( err ) {
            console.error( "[ActiveWorkout] Failed to toggle set:", err );
            if ( !navigator.onLine ) {
                enqueueOfflineUpdate( setId, { isCompleted: nextCompleted } );
            } else {
                await fetchFullWorkout();
            }
        }
    };

    // Debounced metric updater to consolidate rapid edits and typing
    const debouncedSaveMetric = ( setId, field, value ) => {
        const key = `${setId}_${field}`;
        if ( debounceTimers.current[key] ) {
            clearTimeout( debounceTimers.current[key] );
        }

        const action = async () => {
            try {
                await setApi.updateSet( setId, { [field]: value } );
            } catch ( err ) {
                console.error( `[ActiveWorkout] Failed to save set ${field}:`, err );
                if ( !navigator.onLine ) {
                    enqueueOfflineUpdate( setId, { [field]: value } );
                }
            }
        };
        pendingDebounceActions.current[key] = action;

        debounceTimers.current[key] = setTimeout( async () => {
            delete debounceTimers.current[key];
            delete pendingDebounceActions.current[key];
            await action();
        }, 300 );
    };

    // Used to update standard metric field (weight, reps, distance)
    const handleUpdateSetMetric = ( setId, field, value ) => {
        let cleanValue = value;
        if ( cleanValue === "" || cleanValue === null || cleanValue === undefined ) {
            cleanValue = null;
        } else {
            const num = Number( cleanValue );
            cleanValue = Number.isNaN( num ) ? null : Math.max( 0, num );
        }

        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, [field]: cleanValue } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        debouncedSaveMetric( setId, field, cleanValue );
    };

    // Used to step-increment standard metric (e.g. +5 lb, -5 lb, +1 rep)
    const handleAdjustSetMetric = ( setId, field, delta, min = 0 ) => {
        const currentDetails = workoutDetailsRef.current || workoutDetails;
        if ( !currentDetails ) return;

        let currentVal = 0;
        let found = false;

        for ( const we of ( currentDetails.workoutExercises || [] ) ) {
            const s = ( we.sets || [] ).find( ( item ) => item.id === setId );
            if ( s ) {
                currentVal = Number( s[field] ) || 0;
                found = true;
                break;
            }
        }
        if ( !found ) return;

        const nextVal = Math.max( min, Math.round( ( currentVal + delta ) * 10 ) / 10 );

        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, [field]: nextVal } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        debouncedSaveMetric( setId, field, nextVal );
    };

    // Used to update cardio duration in minutes (converts to seconds for DB)
    const handleUpdateCardioMinutes = ( setId, valMinutes ) => {
        let secs = null;
        if ( valMinutes !== "" && valMinutes !== null && valMinutes !== undefined ) {
            const numMins = parseFloat( valMinutes );
            if ( !Number.isNaN( numMins ) ) {
                secs = Math.max( 0, Math.round( numMins * 60 ) );
            }
        }

        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, durationSeconds: secs } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        debouncedSaveMetric( setId, "durationSeconds", secs );
    };

    // Used to step-increment cardio duration by minutes (e.g. +1m, -1m, +5m)
    const handleAdjustCardioMinutes = ( setId, deltaMinutes ) => {
        const currentDetails = workoutDetailsRef.current || workoutDetails;
        if ( !currentDetails ) return;

        let foundCurrentSecs = 0;
        let found = false;

        for ( const we of ( currentDetails.workoutExercises || [] ) ) {
            const s = ( we.sets || [] ).find( ( item ) => item.id === setId );
            if ( s ) {
                foundCurrentSecs = s.durationSeconds ? Number( s.durationSeconds ) : 0;
                found = true;
                break;
            }
        }
        if ( !found ) return;

        const currentMins = foundCurrentSecs / 60;
        const nextMins = Math.max( 0, Math.round( ( currentMins + deltaMinutes ) * 10 ) / 10 );
        const nextSecs = Math.round( nextMins * 60 );

        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, durationSeconds: nextSecs } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        debouncedSaveMetric( setId, "durationSeconds", nextSecs );
    };

    // Used to cycle set type (NORMAL -> WARMUP -> DROP -> FAILURE -> NORMAL)
    const handleCycleSetType = async ( setId, currentType ) => {
        const currentIdx = SET_TYPES.indexOf( currentType || "NORMAL" );
        const nextType = SET_TYPES[( currentIdx + 1 ) % SET_TYPES.length];

        setWorkoutDetails( ( prev ) => {
            if ( !prev ) return prev;
            const updated = {
                ...prev,
                workoutExercises: ( prev.workoutExercises || [] ).map( ( we ) => ({
                    ...we,
                    sets: ( we.sets || [] ).map( ( s ) => ( s.id === setId ? { ...s, setType: nextType } : s ) )
                }) )
            };
            workoutDetailsRef.current = updated;
            saveWorkoutDraft( updated );
            return updated;
        } );

        try {
            await setApi.updateSet( setId, { setType: nextType } );
        } catch ( err ) {
            console.error( "[ActiveWorkout] Failed to cycle set type:", err );
            if ( !navigator.onLine ) {
                enqueueOfflineUpdate( setId, { setType: nextType } );
            }
        }
    };

    // Used to add new set to an exercise copying previous set baseline w/ modality awareness
    const handleAddSet = async ( workoutExerciseId, previousSet, ex ) => {
        let payload = {
            setType: "NORMAL",
            isCompleted: false
        };

        if ( ex?.modality === "DISTANCE_TIME" ) {
            payload = {
                ...payload,
                weight: null,
                reps: null,
                durationSeconds: previousSet?.durationSeconds ?? 1200, // 20m default
                distance: previousSet?.distance ?? 1.0,
                distanceUnit: previousSet?.distanceUnit ?? ( isMetric ? "km" : "mi" )
            };
        } else if ( ex?.modality === "TIME_DURATION" ) {
            payload = {
                ...payload,
                weight: previousSet?.weight ?? null,
                reps: null,
                durationSeconds: previousSet?.durationSeconds ?? ( isCardioMovement( ex ) ? 1200 : 60 ),
                distance: null,
                distanceUnit: null
            };
        } else {
            payload = {
                ...payload,
                weight: previousSet?.weight ?? null,
                reps: previousSet?.reps ?? 10,
                durationSeconds: null,
                distance: null,
                distanceUnit: null
            };
        }

        try {
            await setApi.addSet( workoutExerciseId, payload );
            await fetchFullWorkout();
        } catch ( err ) {
            await modal.alert({
                title: "Error Adding Set",
                message: err.message || "Failed to add set"
            });
        }
    };

    // Used to delete a specific set w/ confirmation if set holds logged data
    const handleDeleteSet = async ( set ) => {
        const hasData = set.isCompleted ||
            ( set.weight !== null && set.weight > 0 ) ||
            ( set.reps !== null && set.reps > 0 ) ||
            ( set.durationSeconds !== null && set.durationSeconds > 0 ) ||
            ( set.distance !== null && set.distance > 0 );
        if ( hasData ) {
            const confirmed = await modal.confirm({
                title: "Delete Set?",
                message: `Are you sure you want to delete Set ${set.setNumber}?`,
                confirmText: "Delete",
                cancelText: "Keep",
                destructive: true
            });
            if ( !confirmed ) return;
        }

        try {
            await setApi.deleteSet( set.id );
            await fetchFullWorkout();
        } catch ( err ) {
            await modal.alert({
                title: "Error Deleting Set",
                message: err.message || "Failed to delete set"
            });
        }
    };

    // Empty state when no workout is currently active
    if ( !activeWorkout ) {
        return (
            <div className="max-w-md mx-auto space-y-6 pt-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                    <Dumbbell className="w-10 h-10 stroke-[1.5]" />
                </div>

                <div>
                    <h2 className="text-2xl font-extrabold text-white">No Active Workout</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Start an ad-hoc session or select a routine template to begin tracking
                    </p>
                </div>

                <div className="space-y-3 pt-2">
                    <button
                        onClick={handleStartEmpty}
                        disabled={startingEmpty}
                        className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                    >
                        {startingEmpty ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Plus className="w-5 h-5 stroke-[2.5]" />
                                <span>Start Empty Workout</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => onNavigate( "routines" )}
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-200 font-bold text-sm transition active:scale-[0.98] cursor-pointer"
                    >
                        Choose from Saved Routines
                    </button>
                </div>
            </div>
        );
    }

    const exercises = workoutDetails?.workoutExercises || activeWorkout?.workoutExercises || [];

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
            {/* Offline Network Resilience Shield Alert */}
            {!isOnline && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                    <WifiOff className="w-4 h-4 shrink-0" />
                    <span>Gym Shield Active: Offline mode detected. All sets and loads are cached locally and will sync automatically when reconnected.</span>
                </div>
            )}

            {/* Header: Title, Split Tag, Controls & Elapsed Timer */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800/80 gap-3">
                <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                            Live Workout
                        </span>
                        {activeWorkout.splitTag && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {activeWorkout.splitTag}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 mt-1">
                        <h1 className="text-2xl md:text-3xl font-black text-white truncate">
                            {workoutDetails?.name || activeWorkout.name}
                        </h1>
                        <button
                            type="button"
                            onClick={handleOpenDetailsModal}
                            className="p-1 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Rename workout or add session notes"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {workoutDetails?.notes && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">
                            "{workoutDetails.notes}"
                        </p>
                    )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleOpenPicker}
                        className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add Exercise</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsRestTimerOpen( ( prev ) => !prev )}
                        className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 transition cursor-pointer"
                        title="Toggle Rest Timer"
                    >
                        <Timer className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={handleDiscardWorkout}
                        disabled={finishing || discarding}
                        className="inline-flex items-center space-x-1 px-2.5 py-2 rounded-xl bg-slate-900/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition cursor-pointer"
                        title="Discard in-progress workout"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Discard</span>
                    </button>

                    <div className="text-right pl-1">
                        <div className="text-2xl md:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                            {elapsed}
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Elapsed Time
                        </span>
                    </div>
                </div>
            </div>

            {/* Exercises & Set Rows */}
            {loadingDetails && !workoutDetails ? (
                <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading workout exercises...</span>
                </div>
            ) : exercises.length === 0 ? (
                <div className="p-8 rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-3">
                    <Dumbbell className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">No exercises added yet</p>
                    <p className="text-xs text-slate-500">
                        Select a movement from your catalog to log sets and track overload
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={handleOpenPicker}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>Add Exercise</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onNavigate( "exercises" )}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                        >
                            Browse Full Catalog
                        </button>
                        <button
                            type="button"
                            onClick={handleDiscardWorkout}
                            disabled={discarding}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-500/10 text-rose-400/80 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Discard Workout</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {exercises.map( ( we, exIdx ) => {
                        const ex = we.exercise || {};
                        const sets = we.sets || [];
                        const isNotesOpen = Boolean( expandedExerciseNotes[we.id] );
                        const isCardio = isCardioMovement( ex );

                        return (
                            <div key={we.id || exIdx} className="p-3.5 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3.5">
                                {/* Exercise Card Header & Quick Actions */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-base font-bold text-white truncate">{ex.name || "Exercise"}</h3>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleExerciseNotes( we.id )}
                                                className={`p-1 rounded-md text-xs transition cursor-pointer ${
                                                    we.notes
                                                        ? "text-emerald-400 bg-emerald-500/10"
                                                        : "text-slate-500 hover:text-slate-300"
                                                }`}
                                                title={we.notes ? "View/Edit exercise notes" : "Add exercise note"}
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">
                                            {ex.category || "General"} • {ex.equipment || "Standard"}
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenSwap( we, ex )}
                                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer active:scale-95"
                                            title="Hot-Swap Movement (Replace with alternative)"
                                            aria-label="Hot-swap movement"
                                        >
                                            <ArrowLeftRight className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={removingExerciseId === we.id}
                                            onClick={() => handleRemoveExercise( we.id, ex.name )}
                                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                                            title="Remove exercise from workout"
                                        >
                                            {removingExerciseId === we.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 stroke-[2]" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Exercise Notes Drawer */}
                                {isNotesOpen && (
                                    <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 animate-in fade-in duration-150">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                                            <span>Exercise Notes / Machine Settings</span>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleExerciseNotes( we.id )}
                                                className="text-slate-500 hover:text-slate-300"
                                            >
                                                Close
                                            </button>
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={we.notes || ""}
                                            onChange={( e ) => handleUpdateExerciseNotes( we.id, e.target.value )}
                                            placeholder="e.g., Seat pin 4, wide grip, pause at bottom..."
                                            className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none transition"
                                        />
                                    </div>
                                )}

                                {/* Set Table Header (Modality Adaptive) */}
                                <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-bold text-slate-400 pb-1.5 border-b border-slate-800">
                                    <span className="w-8 sm:w-10 shrink-0 text-left">Set</span>
                                    {ex.modality === "DISTANCE_TIME" ? (
                                        <>
                                            <span className="flex-1 text-center">Distance ({distanceUnit})</span>
                                            <span className="flex-1 text-center">Time (Mins)</span>
                                        </>
                                    ) : ex.modality === "TIME_DURATION" ? (
                                        isCardio ? (
                                            <span className="flex-1 text-center">Time Duration (Minutes)</span>
                                        ) : (
                                            <span className="flex-1 text-center">Hold Duration (Seconds)</span>
                                        )
                                    ) : (
                                        <>
                                            <span className="flex-1 text-center">Weight ({weightUnit})</span>
                                            <span className="flex-1 text-center">Reps</span>
                                        </>
                                    )}
                                    <span className="w-8 sm:w-9 text-center shrink-0">Done</span>
                                    <span className="w-7 shrink-0" />
                                </div>

                                {/* Tactile Responsive Set Rows (Non-Shrinking Steppers) */}
                                <div className="space-y-2">
                                    {sets.map( ( set ) => {
                                        const paceStr = ex.modality === "DISTANCE_TIME"
                                            ? calculatePace( set.distance, set.durationSeconds, distanceUnit )
                                            : null;

                                        return (
                                            <div key={set.id} className="space-y-1">
                                                <div
                                                    className={`flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-2xl transition border ${
                                                        set.isCompleted
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                                            : "bg-slate-950/70 border-slate-800/80 text-slate-200"
                                                    }`}
                                                >
                                                    {/* Set Number & Type Toggle */}
                                                    <div className="w-8 sm:w-10 shrink-0 flex items-center justify-start">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCycleSetType( set.id, set.setType )}
                                                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center active:scale-95 ${
                                                                set.setType === "WARMUP"
                                                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                                                    : set.setType === "DROP"
                                                                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                                                                        : set.setType === "FAILURE"
                                                                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                                                            : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 hover:border-slate-500"
                                                            }`}
                                                            title={`Set type: ${set.setType || "NORMAL"} (Tap to cycle: Normal -> Warmup -> Drop -> Failure)`}
                                                            aria-label={`Cycle set ${set.setNumber} type`}
                                                        >
                                                            {set.setType === "WARMUP" ? `W${set.setNumber}` : set.setType === "DROP" ? `D${set.setNumber}` : set.setType === "FAILURE" ? `F${set.setNumber}` : set.setNumber}
                                                        </button>
                                                    </div>

                                                    {/* Modality: WEIGHT_REPS */}
                                                    {( ex.modality === "WEIGHT_REPS" || ( !ex.modality && !isCardio ) ) && (
                                                        <>
                                                            {/* Weight Input w/ Non-Shrinking Steppers */}
                                                            <div className="flex-1 min-w-0 flex items-center justify-center space-x-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "weight", -weightStep, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={set.weight !== null && set.weight !== undefined ? set.weight : ""}
                                                                    onChange={( e ) => handleUpdateSetMetric( set.id, "weight", e.target.value === "" ? null : Number( e.target.value ) )}
                                                                    placeholder="0"
                                                                    className="w-14 sm:w-16 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "weight", weightStep, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>

                                                            {/* Reps Input w/ Non-Shrinking Steppers */}
                                                            <div className="flex-1 min-w-0 flex items-center justify-center space-x-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "reps", -1, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={set.reps !== null && set.reps !== undefined ? set.reps : ""}
                                                                    onChange={( e ) => handleUpdateSetMetric( set.id, "reps", e.target.value === "" ? null : parseInt( e.target.value, 10 ) )}
                                                                    placeholder="0"
                                                                    className="w-11 sm:w-14 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "reps", 1, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Modality: Non-Cardio Isometric Holds (Planks in Seconds) */}
                                                    {!isCardio && ex.modality === "TIME_DURATION" && (
                                                        <div className="flex-1 min-w-0 flex items-center justify-center space-x-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustSetMetric( set.id, "durationSeconds", -15, 0 )}
                                                                className="px-2.5 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer active:scale-95"
                                                            >
                                                                -15s
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={set.durationSeconds !== null && set.durationSeconds !== undefined ? set.durationSeconds : ""}
                                                                onChange={( e ) => handleUpdateSetMetric( set.id, "durationSeconds", e.target.value === "" ? null : parseInt( e.target.value, 10 ) )}
                                                                placeholder="0s"
                                                                className="w-16 sm:w-20 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustSetMetric( set.id, "durationSeconds", 15, 0 )}
                                                                className="px-2.5 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition cursor-pointer active:scale-95"
                                                            >
                                                                +15s
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Modality: Cardio Duration (Jump Rope, Running Time in Minutes) */}
                                                    {isCardio && ex.modality === "TIME_DURATION" && (
                                                        <div className="flex-1 min-w-0 flex items-center justify-center space-x-1 sm:space-x-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustCardioMinutes( set.id, -5 )}
                                                                className="hidden sm:flex px-2 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold items-center justify-center transition cursor-pointer active:scale-95"
                                                                title="Decrease 5 minutes"
                                                            >
                                                                -5m
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustCardioMinutes( set.id, -1 )}
                                                                className="w-8 sm:w-9 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-black flex items-center justify-center transition cursor-pointer active:scale-95"
                                                            >
                                                                -1m
                                                            </button>
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={set.durationSeconds !== null && set.durationSeconds !== undefined ? Math.round( ( set.durationSeconds / 60 ) * 10 ) / 10 : ""}
                                                                    onChange={( e ) => handleUpdateCardioMinutes( set.id, e.target.value )}
                                                                    placeholder="0"
                                                                    className="w-14 sm:w-16 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustCardioMinutes( set.id, 1 )}
                                                                className="w-8 sm:w-9 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-black flex items-center justify-center transition cursor-pointer active:scale-95"
                                                            >
                                                                +1m
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdjustCardioMinutes( set.id, 5 )}
                                                                className="hidden sm:flex px-2 h-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold items-center justify-center transition cursor-pointer active:scale-95"
                                                                title="Increase 5 minutes"
                                                            >
                                                                +5m
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Modality: Cardio Distance + Time (Running Distance in Miles/Km & Minutes) */}
                                                    {ex.modality === "DISTANCE_TIME" && (
                                                        <>
                                                            {/* Distance Control */}
                                                            <div className="flex-1 min-w-0 flex items-center justify-center space-x-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "distance", -0.5, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    -
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={set.distance !== null && set.distance !== undefined ? set.distance : ""}
                                                                    onChange={( e ) => handleUpdateSetMetric( set.id, "distance", e.target.value === "" ? null : Number( e.target.value ) )}
                                                                    placeholder="0.0"
                                                                    className="w-14 sm:w-16 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustSetMetric( set.id, "distance", 0.5, 0 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>

                                                            {/* Duration in Minutes Control */}
                                                            <div className="flex-1 min-w-0 flex items-center justify-center space-x-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustCardioMinutes( set.id, -1 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    -1
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={set.durationSeconds !== null && set.durationSeconds !== undefined ? Math.round( ( set.durationSeconds / 60 ) * 10 ) / 10 : ""}
                                                                    onChange={( e ) => handleUpdateCardioMinutes( set.id, e.target.value )}
                                                                    placeholder="0m"
                                                                    className="w-14 sm:w-16 min-w-0 py-1.5 px-1 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-center text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAdjustCardioMinutes( set.id, 1 )}
                                                                    className="w-7 h-8 sm:w-8 sm:h-9 shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-black flex items-center justify-center border border-slate-800 transition cursor-pointer active:scale-95"
                                                                >
                                                                    +1
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Done Completion Checkbox */}
                                                    <div className="w-8 sm:w-9 shrink-0 flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleSet( set.id, set.isCompleted )}
                                                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition cursor-pointer active:scale-95 ${
                                                                set.isCompleted
                                                                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25"
                                                                    : "bg-slate-900 text-slate-600 hover:text-slate-300 border border-slate-800 hover:border-slate-700"
                                                            }`}
                                                            title={set.isCompleted ? "Completed (tap to uncheck)" : "Mark Done"}
                                                        >
                                                            <Check className="w-4 h-4 stroke-[3]" />
                                                        </button>
                                                    </div>

                                                    {/* Delete Set Action */}
                                                    <div className="w-7 shrink-0 flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSet( set )}
                                                            className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                                            title="Delete Set"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Calculated Cardio Pace Badge */}
                                                {paceStr && (
                                                    <div className="flex items-center space-x-1.5 pl-10 text-[10px] font-semibold text-emerald-400">
                                                        <Gauge className="w-3 h-3" />
                                                        <span>Calculated Pace: {paceStr}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } )}
                                </div>

                                {/* Add Set Action Button */}
                                <button
                                    type="button"
                                    onClick={() => handleAddSet( we.id, sets[sets.length - 1], ex )}
                                    className="w-full py-2.5 px-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-emerald-400 text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Add Set</span>
                                </button>
                            </div>
                        );
                    } )}

                    {/* Add Exercise Action Below List */}
                    <button
                        type="button"
                        onClick={handleOpenPicker}
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-dashed border-slate-700/80 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Add Exercise to Workout</span>
                    </button>
                </div>
            )}

            {/* Session Action Controls */}
            <div className="pt-4 space-y-3">
                <button
                    onClick={handleFinishWorkout}
                    disabled={finishing || discarding}
                    className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                    {finishing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Finishing Session...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                            <span>Finish Workout</span>
                        </>
                    )}
                </button>

                <button
                    onClick={handleDiscardWorkout}
                    disabled={finishing || discarding}
                    className="w-full py-3 px-4 rounded-xl bg-slate-900/60 hover:bg-rose-500/10 text-rose-400/80 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                    {discarding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Discard In-Progress Workout</span>
                        </>
                    )}
                </button>
            </div>

            {/* Rest Timer Floating Component */}
            <RestTimer
                isOpen={isRestTimerOpen}
                trigger={restTimerTrigger}
                onClose={() => setIsRestTimerOpen( false )}
            />

            {/* Workout Details & Notes Modal Mounted via Portal at z-[90] */}
            {isDetailsModalOpen && createPortal(
                <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-extrabold text-white">Workout Details</h3>
                            <button
                                type="button"
                                onClick={() => setIsDetailsModalOpen( false )}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">
                                    Workout Name
                                </label>
                                <input
                                    type="text"
                                    value={sessionNameInput}
                                    onChange={( e ) => setSessionNameInput( e.target.value )}
                                    placeholder="e.g., Push Day A, Morning Cardio"
                                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">
                                    Session Notes
                                </label>
                                <textarea
                                    rows={3}
                                    value={sessionNotesInput}
                                    onChange={( e ) => setSessionNotesInput( e.target.value )}
                                    placeholder="Add general workout notes, energy levels, or gym observations..."
                                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none transition"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => setIsDetailsModalOpen( false )}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={savingSessionDetails}
                                onClick={handleSaveSessionDetails}
                                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                            >
                                {savingSessionDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Save Details</span>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Exercise Hot-Swap Modal Mounted via Portal at z-[90] */}
            {isSwapOpen && createPortal(
                <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 my-auto max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-white">Hot-Swap Movement</h3>
                                <p className="text-xs text-slate-400">
                                    Replace <span className="text-emerald-400 font-bold">{swapTarget?.exerciseName}</span> with alternative
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSwapOpen( false )}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Keep Sets Switch */}
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <span className="block text-xs font-bold text-white">Keep Logged Sets & Loads</span>
                                <span className="block text-[11px] text-slate-400">Preserve existing sets for the new movement</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSwapKeepSets( ( prev ) => !prev )}
                                className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer ${
                                    swapKeepSets ? "bg-emerald-500 justify-end" : "bg-slate-800 justify-start"
                                }`}
                            >
                                <span className="w-5 h-5 rounded-full bg-white shadow-md block" />
                            </button>
                        </div>

                        {/* Search & Categories */}
                        <div className="space-y-2 shrink-0">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={swapSearch}
                                    onChange={( e ) => setSwapSearch( e.target.value )}
                                    placeholder="Filter replacement movements..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                                />
                            </div>

                            <div className="flex items-center space-x-1 w-full">
                                <button
                                    type="button"
                                    onClick={() => handleScrollContainer( swapCategoryScrollRef, -1 )}
                                    className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                                    aria-label="Scroll categories left"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <div
                                    ref={swapCategoryScrollRef}
                                    onWheel={handleWheelHorizontal}
                                    className="flex-1 min-w-0 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth px-0.5"
                                >
                                    {PICKER_CATEGORIES.map( ( cat ) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setSwapCategory( cat )}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                                                swapCategory === cat
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ) )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleScrollContainer( swapCategoryScrollRef, 1 )}
                                    className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                                    aria-label="Scroll categories right"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Swap Selection List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {loadingCatalog ? (
                                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                    <span>Loading exercise library...</span>
                                </div>
                            ) : filteredSwapExercises.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 text-xs">
                                    No matching replacement exercises found.
                                </div>
                            ) : (
                                filteredSwapExercises.map( ( ex ) => (
                                    <div
                                        key={ex.id}
                                        className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition"
                                    >
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-bold text-white truncate">{ex.name}</h4>
                                            <p className="text-[10px] text-slate-400">
                                                {ex.category} • {ex.equipment}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={swapping}
                                            onClick={() => handleExecuteSwap( ex )}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                        >
                                            {swapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Swap</span>}
                                        </button>
                                    </div>
                                ) )
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsSwapOpen( false )}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Exercise Picker Modal Mounted via Portal at z-[90] */}
            {isPickerOpen && createPortal(
                <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 my-auto max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-white">Add Exercise to Workout</h3>
                                <p className="text-xs text-slate-400">Select movements from your catalog to log</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPickerOpen( false )}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search & Categories */}
                        <div className="space-y-2 shrink-0">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={( e ) => setPickerSearch( e.target.value )}
                                    placeholder="Filter by name..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                                />
                            </div>

                            <div className="flex items-center space-x-1 w-full">
                                <button
                                    type="button"
                                    onClick={() => handleScrollContainer( pickerCategoryScrollRef, -1 )}
                                    className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                                    aria-label="Scroll categories left"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <div
                                    ref={pickerCategoryScrollRef}
                                    onWheel={handleWheelHorizontal}
                                    className="flex-1 min-w-0 flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth px-0.5"
                                >
                                    {PICKER_CATEGORIES.map( ( cat ) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setPickerCategory( cat )}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                                                pickerCategory === cat
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ) )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleScrollContainer( pickerCategoryScrollRef, 1 )}
                                    className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                                    aria-label="Scroll categories right"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Exercise Selection List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {loadingCatalog ? (
                                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                    <span>Loading exercise library...</span>
                                </div>
                            ) : filteredPickerExercises.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 text-xs">
                                    No exercises matched your search.
                                </div>
                            ) : (
                                filteredPickerExercises.map( ( ex ) => {
                                    const alreadyInWorkout = exercises.some( ( we ) => we.exerciseId === ex.id );
                                    const isAdding = addingExerciseId === ex.id;

                                    return (
                                        <div
                                            key={ex.id}
                                            className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition"
                                        >
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-bold text-white truncate">
                                                    {ex.name}
                                                </h4>
                                                <p className="text-[10px] text-slate-400">
                                                    {ex.category} • {ex.equipment}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={isAdding}
                                                onClick={() => handleAddExercise( ex )}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 ${
                                                    alreadyInWorkout
                                                        ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                                                        : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
                                                }`}
                                            >
                                                {isAdding ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : alreadyInWorkout ? (
                                                    <>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>Add More</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>Add</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                } )
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsPickerOpen( false )}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
