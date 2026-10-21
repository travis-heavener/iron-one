/******************************************************************************
 * Dashboard Page Component
 * Primary gym home view w/ quick session launch, active status, and overview
 ******************************************************************************/

import {
    ChevronRight,
    Dumbbell,
    Flame,
    Layers,
    Play,
    Plus,
    Sparkles
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { systemApi, workoutApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";

// Used to render main dashboard overview and quick actions
export const DashboardPage = ({ onNavigate, onOpenTour }) => {
    const { activeWorkout, refreshActiveWorkout, setActiveWorkout, user } = useAuth();
    const modal = useModal();
    const [ startingAdHoc, setStartingAdHoc ] = useState( false );
    const [ recentWorkouts, setRecentWorkouts ] = useState( [] );
    const [ loadingRecent, setLoadingRecent ] = useState( true );
    const [ totalCount, setTotalCount ] = useState( 0 );
    const [ streakData, setStreakData ] = useState( null );
    const [ loadingStreak, setLoadingStreak ] = useState( true );
    const [ storageHost, setStorageHost ] = useState( () => (
        typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost"
    ));

    useEffect( () => {
        const fetchRecent = async () => {
            try {
                const data = await workoutApi.getWorkouts({ limit: 3 });
                setRecentWorkouts( data.entries || [] );
                setTotalCount( data.pagination?.totalCount || 0 );
            } catch ( err ) {
                console.error( "[Dashboard] Failed to fetch recent workouts:", err );
            } finally {
                setLoadingRecent( false );
            }
        };

        const fetchStreak = async () => {
            try {
                const timezoneOffset = new Date().getTimezoneOffset();
                const data = await workoutApi.getStreak( timezoneOffset );
                setStreakData( data );
                if ( data?.totalWorkouts !== undefined ) {
                    setTotalCount( data.totalWorkouts );
                }
            } catch ( err ) {
                console.error( "[Dashboard] Failed to fetch weekly streak:", err );
            } finally {
                setLoadingStreak( false );
            }
        };

        const fetchSystemHost = async () => {
            try {
                const health = await systemApi.getHealth();
                if ( health?.hostname ) {
                    setStorageHost( health.hostname );
                }
            } catch ( err ) {
                console.warn( "[Dashboard] Failed to fetch server system hostname:", err.message );
            }
        };

        fetchRecent();
        fetchStreak();
        fetchSystemHost();
    }, [] );

    const handleStartEmptyWorkout = async () => {
        if ( activeWorkout ) {
            onNavigate( "active" );
            return;
        }

        setStartingAdHoc( true );
        try {
            const entry = await workoutApi.createWorkout({ name: "Quick Workout" });
            setActiveWorkout( entry );
            onNavigate( "active" );
        } catch ( err ) {
            if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
                await refreshActiveWorkout();
                onNavigate( "active" );
            } else {
                await modal.alert({
                    title: "Unable to Start Workout",
                    message: err.message || "Failed to start workout session",
                    variant: "danger"
                });
            }
        } finally {
            setStartingAdHoc( false );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Greeting */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Welcome back, <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{user?.username}</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Ready to push your limits today?
                    </p>
                </div>
                {onOpenTour && (
                    <button
                        type="button"
                        onClick={onOpenTour}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition shrink-0 cursor-pointer shadow-sm"
                        title="Open Introduction & Feature Tour"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Feature Tour</span>
                        <span className="sm:hidden">Tour</span>
                    </button>
                )}
            </div>

            {/* Active Workout Spotlight (if active session running) */}
            {activeWorkout && (
                <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/40 shadow-xl shadow-emerald-950/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold tracking-wider uppercase mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        <span>Workout In Progress</span>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-1">
                        {activeWorkout.name}
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                        {activeWorkout.workoutExercises?.length || 0} exercises currently in this session
                    </p>

                    <button
                        onClick={() => onNavigate( "active" )}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 flex items-center justify-center space-x-2 transition active:scale-[0.98]"
                    >
                        <Play className="w-4 h-4 fill-current stroke-[2.5]" />
                        <span>Resume Live Workout</span>
                    </button>
                </div>
            )}

            {/* Quick Gym Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                    onClick={handleStartEmptyWorkout}
                    disabled={startingAdHoc}
                    className="p-5 rounded-3xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 transition-all text-left group shadow-lg active:scale-[0.98] disabled:opacity-50"
                >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-105 transition">
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-white">Start Empty Workout</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Log a freeform session from scratch without a routine template
                    </p>
                </button>

                <button
                    onClick={() => onNavigate( "routines" )}
                    className="p-5 rounded-3xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/40 transition-all text-left group shadow-lg active:scale-[0.98]"
                >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition">
                        <Layers className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-white">Start from Routine</span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        Select a pre-built split (Push, Pull, Legs) with target sets
                    </p>
                </button>
            </div>

            {/* Overall Metric Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/70">
                    <div className="text-xs text-slate-400 font-medium">Total Workouts</div>
                    <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
                </div>
                {/* Weekly Streak Tracker (Replaces Unit System readout) */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/70 relative overflow-hidden flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                                <Flame className={`w-3.5 h-3.5 ${streakData?.currentStreak > 0 ? "text-amber-400 fill-amber-400/40" : "text-slate-500"}`} />
                                <span>Weekly Streak</span>
                            </div>
                            {streakData?.hasWorkedOutThisWeek ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Active
                                </span>
                            ) : streakData?.currentStreak > 0 ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Pending
                                </span>
                            ) : null}
                        </div>
                        <div className="flex items-baseline space-x-1.5 mt-1">
                            <div className="text-2xl font-bold text-white tracking-tight">
                                {loadingStreak ? "—" : ( streakData?.currentStreak ?? 0 )}
                            </div>
                            <span className="text-xs font-semibold text-slate-400">
                                {( streakData?.currentStreak === 1 ) ? "week" : "weeks"}
                            </span>
                        </div>
                    </div>

                    {/* 7-day mini dot strip starting on Sunday */}
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        {[ "S", "M", "T", "W", "T", "F", "S" ].map( ( dayLetter, idx ) => {
                            const currentDayIndex = streakData?.currentDayOfWeek !== undefined ? streakData.currentDayOfWeek : new Date().getDay();
                            const isToday = currentDayIndex === idx;
                            const isActive = Boolean( streakData?.daysActiveThisWeek?.[idx] );
                            return (
                                <div key={idx} className="flex flex-col items-center space-y-1">
                                    <span className={`text-[9px] font-semibold ${isToday ? "text-emerald-400" : "text-slate-500"}`}>
                                        {dayLetter}
                                    </span>
                                    <div
                                        className={`w-2 h-2 rounded-full transition-all ${
                                            isActive
                                                ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                                                : isToday
                                                    ? "border border-emerald-400/60 bg-transparent"
                                                    : "bg-slate-800"
                                        }`}
                                        title={isActive ? `Workout logged on day ${idx}` : isToday ? "Today" : ""}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/70">
                    <div className="text-xs text-slate-400 font-medium">Storage Host</div>
                    <div className="text-2xl font-bold text-slate-300 mt-1 truncate">
                        {storageHost}
                    </div>
                </div>
            </div>

            {/* Recent Workout History */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                        Recent Sessions
                    </h3>
                    <button
                        onClick={() => onNavigate( "history" )}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                    >
                        View all
                    </button>
                </div>

                {loadingRecent ? (
                    <div className="py-8 text-center text-slate-500 text-sm">
                        Loading recent workouts...
                    </div>
                ) : recentWorkouts.length === 0 ? (
                    <div className="p-8 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
                        <Dumbbell className="w-8 h-8 text-slate-600 mx-auto" />
                        <div>
                            <p className="text-sm font-medium text-slate-300">No workouts logged yet</p>
                            <p className="text-xs text-slate-500 mt-1">Start your first workout above or take the tour to learn the ropes</p>
                        </div>
                        {onOpenTour && (
                            <button
                                type="button"
                                onClick={onOpenTour}
                                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Take Quick Tour</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {recentWorkouts.map( ( entry ) => (
                            <div
                                key={entry.id}
                                onClick={() => onNavigate( "history" )}
                                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between cursor-pointer"
                            >
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <span className="font-bold text-slate-200 text-sm">{entry.name}</span>
                                        {entry.splitTag && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                {entry.splitTag}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
                                        <span>{new Date( entry.date ).toLocaleDateString( undefined, { month: "short", day: "numeric", year: "numeric" } )}</span>
                                        {entry.durationMinutes && (
                                            <span>• {entry.durationMinutes} mins</span>
                                        )}
                                        <span>• {entry.workoutExercises?.length || 0} exercises</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

