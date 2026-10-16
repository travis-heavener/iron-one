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
    Trash2
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { setApi, workoutApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

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

    const [ workoutDetails, setWorkoutDetails ] = useState( null );
    const [ loadingDetails, setLoadingDetails ] = useState( false );
    const [ elapsed, setElapsed ] = useState( "00:00" );
    const [ finishing, setFinishing ] = useState( false );
    const [ discarding, setDiscarding ] = useState( false );
    const [ startingEmpty, setStartingEmpty ] = useState( false );

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

    // Used to finish active workout session
    const handleFinishWorkout = async () => {
        if ( !activeWorkout?.id ) return;

        setFinishing( true );
        try {
            await workoutApi.completeWorkout( activeWorkout.id );
            await refreshActiveWorkout();
            onNavigate( "dashboard" );
        } catch ( err ) {
            alert( err.message || "Failed to complete workout session" );
        } finally {
            setFinishing( false );
        }
    };

    // Used to cancel and discard in-progress workout session
    const handleDiscardWorkout = async () => {
        if ( !activeWorkout?.id ) return;

        const confirmed = window.confirm( "Are you sure you want to discard this workout? All sets and progress will be deleted." );
        if ( !confirmed ) return;

        setDiscarding( true );
        try {
            await workoutApi.deleteWorkout( activeWorkout.id );
            await refreshActiveWorkout();
            onNavigate( "dashboard" );
        } catch ( err ) {
            alert( err.message || "Failed to discard workout session" );
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
            alert( err.message || "Failed to start workout" );
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
            {/* Header: Title, Split Tag & Elapsed Timer */}
            <div className="flex items-start justify-between pb-2 border-b border-slate-800/80">
                <div>
                    <div className="flex items-center space-x-2">
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
                    <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                        {activeWorkout.name}
                    </h1>
                </div>

                <div className="text-right">
                    <div className="text-2xl md:text-3xl font-mono font-black text-emerald-400 tracking-tight">
                        {elapsed}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Elapsed Time
                    </span>
                </div>
            </div>

            {/* Exercises & Set Rows */}
            {loadingDetails && !workoutDetails ? (
                <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading workout exercises...</span>
                </div>
            ) : exercises.length === 0 ? (
                <div className="p-8 rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                    <Dumbbell className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-semibold text-slate-300">No exercises added yet</p>
                    <p className="text-xs text-slate-500">
                        Tap below or head to the Exercise Catalog to add your first movement
                    </p>
                    <button
                        onClick={() => onNavigate( "exercises" )}
                        className="mt-3 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition inline-flex items-center space-x-1"
                    >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Browse Exercise Catalog</span>
                    </button>
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
                                            {ex.category || "General"} • {ex.equipment || "Standard"} • {ex.modality || "WEIGHT_REPS"}
                                        </p>
                                    </div>
                                </div>

                                {/* Set Table Header */}
                                <div className="grid grid-cols-12 gap-2 text-center text-xs font-bold text-slate-400 pb-1.5 border-b border-slate-800">
                                    <span className="col-span-2">Set</span>
                                    <span className="col-span-4">{ex.modality === "TIME_DURATION" ? "Seconds" : ex.modality === "DISTANCE_TIME" ? "Distance" : "Weight (lbs)"}</span>
                                    <span className="col-span-4">{ex.modality === "TIME_DURATION" ? "Weight" : "Reps"}</span>
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
                                        <span className="col-span-4 text-xs font-mono">{set.weight ?? set.durationSeconds ?? set.distance ?? "—"}</span>
                                        <span className="col-span-4 text-xs font-mono">{set.reps ?? "—"}</span>
                                        <div className="col-span-2 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSet( set.id, set.isCompleted )}
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
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
                </div>
            )}

            {/* Session Action Controls */}
            <div className="pt-4 space-y-3">
                <button
                    onClick={handleFinishWorkout}
                    disabled={finishing || discarding}
                    className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
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
                    className="w-full py-3 px-4 rounded-xl bg-slate-900/60 hover:bg-rose-500/10 text-rose-400/80 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs font-bold transition flex items-center justify-center space-x-1.5 active:scale-[0.98] disabled:opacity-50"
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
        </div>
    );
};
