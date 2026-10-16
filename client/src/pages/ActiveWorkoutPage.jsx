/******************************************************************************
 * Active Workout Page Component
 * Live gym session tracker w/ elapsed timer, set checklist, and completion controls
 ******************************************************************************/

import {
    Check,
    CheckCircle2,
    Dumbbell,
    Loader2,
    Plus,
    Search,
    Trash2,
    X
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { exerciseApi, setApi, workoutApi, workoutExerciseApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";

// Standard exercise category filters for the picker
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
    const { activeWorkout, refreshActiveWorkout, setActiveWorkout } = useAuth();
    const modal = useModal();

    const [ workoutDetails, setWorkoutDetails ] = useState( null );
    const [ loadingDetails, setLoadingDetails ] = useState( false );
    const [ elapsed, setElapsed ] = useState( "00:00" );
    const [ finishing, setFinishing ] = useState( false );
    const [ discarding, setDiscarding ] = useState( false );
    const [ startingEmpty, setStartingEmpty ] = useState( false );

    // Exercise Picker modal state
    const [ isPickerOpen, setIsPickerOpen ] = useState( false );
    const [ catalogExercises, setCatalogExercises ] = useState( [] );
    const [ loadingCatalog, setLoadingCatalog ] = useState( false );
    const [ pickerSearch, setPickerSearch ] = useState( "" );
    const [ pickerCategory, setPickerCategory ] = useState( "All" );
    const [ addingExerciseId, setAddingExerciseId ] = useState( null );
    const [ removingExerciseId, setRemovingExerciseId ] = useState( null );

    // Lock background scroll when picker modal is open
    useEffect( () => {
        if ( isPickerOpen ) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [ isPickerOpen ] );

    // Fetch full workout details w/ exercises and sets on mount/change
    const fetchFullWorkout = async () => {
        if ( !activeWorkout?.id ) {
            setWorkoutDetails( null );
            return;
        }

        setLoadingDetails( true );
        try {
            const data = await workoutApi.getWorkoutById( activeWorkout.id );
            setWorkoutDetails( data );
        } catch ( err ) {
            console.error( "[ActiveWorkout] Failed to load session details:", err );
        } finally {
            setLoadingDetails( false );
        }
    };

    useEffect( () => {
        fetchFullWorkout();
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

    // Open Exercise Picker
    const handleOpenPicker = async () => {
        setIsPickerOpen( true );
        setPickerSearch( "" );
        setPickerCategory( "All" );

        if ( catalogExercises.length === 0 ) {
            setLoadingCatalog( true );
            try {
                const data = await exerciseApi.getExercises();
                setCatalogExercises( Array.isArray( data ) ? data : [] );
            } catch ( err ) {
                console.error( "[ActiveWorkout] Failed to load exercise catalog for picker:", err );
            } finally {
                setLoadingCatalog( false );
            }
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

    // Used to remove an exercise and its sets from the active workout session
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
            await workoutApi.completeWorkout( activeWorkout.id );
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

        setDiscarding( true );
        try {
            await workoutApi.deleteWorkout( activeWorkout.id );
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
            await modal.alert({
                title: "Failed to Start Workout",
                message: err.message || "Failed to start workout"
            });
        } finally {
            setStartingEmpty( false );
        }
    };

    // Used to toggle set completion status
    const handleToggleSet = async ( setId, currentCompleted ) => {
        try {
            await setApi.updateSet( setId, { isCompleted: !currentCompleted } );
            await fetchFullWorkout();
        } catch ( err ) {
            console.error( "[ActiveWorkout] Failed to toggle set:", err );
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
                        className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
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
                        className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-200 font-bold text-sm transition active:scale-[0.98]"
                    >
                        Choose from Saved Routines
                    </button>
                </div>
            </div>
        );
    }

    const exercises = workoutDetails?.workoutExercises || activeWorkout?.workoutExercises || [];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header: Title, Split Tag, Add Exercise & Elapsed Timer */}
            <div className="flex items-start justify-between pb-2 border-b border-slate-800/80 gap-3">
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
                    <h1 className="text-2xl md:text-3xl font-black text-white mt-1 truncate">
                        {activeWorkout.name}
                    </h1>
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

                        return (
                            <div key={we.id || exIdx} className="p-4 md:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-white">{ex.name || "Exercise"}</h3>
                                        <p className="text-xs text-slate-400">
                                            {ex.category || "General"} • {ex.equipment || "Standard"}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={removingExerciseId === we.id}
                                        onClick={() => handleRemoveExercise( we.id, ex.name )}
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                                        title="Remove exercise from workout"
                                    >
                                        {removingExerciseId === we.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 stroke-[2]" />
                                        )}
                                    </button>
                                </div>

                                {/* Set Table Header (Modality Adaptive) */}
                                <div className="grid grid-cols-12 gap-2 text-center text-xs font-bold text-slate-400 pb-1.5 border-b border-slate-800">
                                    <span className="col-span-2">{ex.modality === "DISTANCE_TIME" ? "Interval" : "Set"}</span>
                                    {ex.modality === "TIME_DURATION" ? (
                                        <span className="col-span-8">Duration</span>
                                    ) : ex.modality === "DISTANCE_TIME" ? (
                                        <>
                                            <span className="col-span-4">Distance</span>
                                            <span className="col-span-4">Time</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="col-span-4">Weight (lbs)</span>
                                            <span className="col-span-4">Reps</span>
                                        </>
                                    )}
                                    <span className="col-span-2">Done</span>
                                </div>

                                {/* Set Rows */}
                                {sets.map( ( set ) => (
                                    <div
                                        key={set.id}
                                        className={`grid grid-cols-12 gap-2 items-center text-center p-1 rounded-xl transition ${
                                            set.isCompleted ? "bg-emerald-500/10 text-emerald-300 font-semibold" : "bg-slate-950/60 text-slate-200"
                                        }`}
                                    >
                                        <span className="col-span-2 text-xs font-bold">{set.setNumber}</span>
                                        {ex.modality === "TIME_DURATION" ? (
                                            <span className="col-span-8 text-xs font-mono">
                                                {set.durationSeconds ? `${set.durationSeconds}s` : "—"}
                                            </span>
                                        ) : ex.modality === "DISTANCE_TIME" ? (
                                            <>
                                                <span className="col-span-4 text-xs font-mono">
                                                    {set.distance !== null && set.distance !== undefined ? `${set.distance} ${set.distanceUnit || "mi"}` : "—"}
                                                </span>
                                                <span className="col-span-4 text-xs font-mono">
                                                    {set.durationSeconds ? (
                                                        set.durationSeconds >= 60
                                                            ? `${Math.floor( set.durationSeconds / 60 )}m ${set.durationSeconds % 60 ? `${set.durationSeconds % 60}s` : ""}`
                                                            : `${set.durationSeconds}s`
                                                    ) : "—"}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="col-span-4 text-xs font-mono">{set.weight ?? "—"}</span>
                                                <span className="col-span-4 text-xs font-mono">{set.reps ?? "—"}</span>
                                            </>
                                        )}
                                        <div className="col-span-2 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSet( set.id, set.isCompleted )}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
                                                    set.isCompleted
                                                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                                        : "bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-700"
                                                }`}
                                            >
                                                <Check className="w-4 h-4 stroke-[3]" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}

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

                            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
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
