/******************************************************************************
 * Workout History & Calendar Page Component
 * Interactive monthly calendar grid, multi-session daily badges, and journal feed
 ******************************************************************************/

import {
    Calendar as CalendarIcon,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Copy,
    Dumbbell,
    Flame,
    Layers,
    Loader2,
    Play,
    Plus,
    RotateCcw,
    Search,
    Trash2,
    X
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import { workoutApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";

const DAYS_OF_WEEK = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];

const SPLIT_FILTER_OPTIONS = [
    "ALL",
    "Push",
    "Pull",
    "Legs",
    "Upper",
    "Lower",
    "Full Body",
    "Cardio",
    "Arms",
    "Core"
];

// Format individual set metrics into compact label (e.g. "225lbs × 8 reps", "60s")
const formatSetSummary = ( s, weightUnit = "lbs" ) => {
    const parts = [];
    if ( s.weight !== null && s.weight !== undefined ) {
        parts.push( `${s.weight}${weightUnit}` );
    }
    if ( s.reps !== null && s.reps !== undefined ) {
        parts.push( `${s.reps} reps` );
    }
    if ( s.durationSeconds !== null && s.durationSeconds !== undefined ) {
        parts.push( `${s.durationSeconds}s` );
    }
    if ( s.distance !== null && s.distance !== undefined ) {
        parts.push( `${s.distance}${s.distanceUnit || "mi"}` );
    }
    if ( parts.length === 0 ) {
        return "Target set";
    }
    return parts.join( " × " );
};

// Returns set identifier badge (e.g. "W1", "D2", "F3", or "1")
const getSetLabel = ( s ) => {
    const prefix = s.setType === "WARMUP" ? "W" : s.setType === "DROP" ? "D" : s.setType === "FAILURE" ? "F" : "";
    return `${prefix}${s.setNumber}`;
};

// Used to render calendar workout view and journal timeline
export const HistoryPage = ({ onNavigate }) => {
    const { activeWorkout, refreshActiveWorkout, setActiveWorkout, user } = useAuth();
    const modal = useModal();
    const weightUnit = user?.unitPreference === "metric" ? "kg" : "lbs";

    // Primary view toggle: "calendar" | "journal"
    const [ activeView, setActiveView ] = useState( "calendar" );

    // Calendar state
    const [ currentMonthDate, setCurrentMonthDate ] = useState( () => new Date() );
    const [ calendarData, setCalendarData ] = useState( {} );
    const [ loadingCalendar, setLoadingCalendar ] = useState( false );
    const [ selectedDateStr, setSelectedDateStr ] = useState( () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String( now.getMonth() + 1 ).padStart( 2, "0" );
        const d = String( now.getDate() ).padStart( 2, "0" );
        return `${y}-${m}-${d}`;
    });
    const [ selectedDateWorkouts, setSelectedDateWorkouts ] = useState( [] );
    const [ loadingSelectedDate, setLoadingSelectedDate ] = useState( false );
    const [ expandedWorkoutId, setExpandedWorkoutId ] = useState( null );
    const [ detailedWorkouts, setDetailedWorkouts ] = useState( {} );

    // Journal feed state
    const [ journalEntries, setJournalEntries ] = useState( [] );
    const [ loadingJournal, setLoadingJournal ] = useState( false );
    const [ journalPage, setJournalPage ] = useState( 0 );
    const [ hasMoreJournal, setHasMoreJournal ] = useState( false );
    const [ totalJournalCount, setTotalJournalCount ] = useState( 0 );
    const [ searchQuery, setSearchQuery ] = useState( "" );
    const [ selectedSplit, setSelectedSplit ] = useState( "ALL" );
    const [ cloningWorkoutId, setCloningWorkoutId ] = useState( null );
    const [ deletingWorkoutId, setDeletingWorkoutId ] = useState( null );

    // Fetch calendar data when current month changes
    const fetchCalendarMonth = async ( dateObj ) => {
        setLoadingCalendar( true );
        try {
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const timezoneOffset = new Date().getTimezoneOffset();

            const data = await workoutApi.getCalendar({
                year,
                month,
                timezoneOffset
            });
            setCalendarData( data || {} );
        } catch ( err ) {
            console.error( "[History] Failed to fetch calendar workouts:", err );
        } finally {
            setLoadingCalendar( false );
        }
    };

    useEffect( () => {
        fetchCalendarMonth( currentMonthDate );
    }, [ currentMonthDate ] );

    // Fetch detailed workout entries for selected calendar date
    useEffect( () => {
        if ( !selectedDateStr ) {
            setSelectedDateWorkouts( [] );
            return;
        }

        const fetchDateDetails = async () => {
            setLoadingSelectedDate( true );
            try {
                const localStart = new Date( `${selectedDateStr}T00:00:00` );
                const localEnd = new Date( `${selectedDateStr}T23:59:59.999` );
                const data = await workoutApi.getWorkouts({
                    startDate: localStart.toISOString(),
                    endDate: localEnd.toISOString(),
                    limit: 20
                });
                setSelectedDateWorkouts( data.entries || [] );
            } catch ( err ) {
                console.error( "[History] Failed to fetch date workouts:", err );
                setSelectedDateWorkouts( [] );
            } finally {
                setLoadingSelectedDate( false );
            }
        };

        fetchDateDetails();
    }, [ selectedDateStr ] );

    // Fetch journal entries with pagination and filters
    const fetchJournal = async ( reset = false ) => {
        setLoadingJournal( true );
        try {
            const offset = reset ? 0 : journalPage * 15;
            const params = {
                limit: 15,
                offset
            };

            if ( searchQuery.trim() ) {
                params.search = searchQuery.trim();
            }

            if ( selectedSplit !== "ALL" ) {
                params.splitTag = selectedSplit;
            }

            const data = await workoutApi.getWorkouts( params );
            const entries = data.entries || [];

            if ( reset ) {
                setJournalEntries( entries );
                setJournalPage( 1 );
            } else {
                setJournalEntries( ( prev ) => [ ...prev, ...entries ] );
                setJournalPage( ( prev ) => prev + 1 );
            }

            setHasMoreJournal( data.pagination?.hasMore || false );
            setTotalJournalCount( data.pagination?.totalCount || 0 );
        } catch ( err ) {
            console.error( "[History] Failed to fetch journal entries:", err );
        } finally {
            setLoadingJournal( false );
        }
    };

    // Refetch journal on filter/search change
    useEffect( () => {
        if ( activeView === "journal" ) {
            const timer = setTimeout( () => {
                fetchJournal( true );
            }, 250 );
            return () => clearTimeout( timer );
        }
    }, [ activeView, selectedSplit, searchQuery ] );

    // Calendar grid calculations
    const calendarGrid = useMemo( () => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();

        // First day of current month and total days
        const firstDayIndex = new Date( year, month, 1 ).getDay();
        const daysInMonth = new Date( year, month + 1, 0 ).getDate();

        // Days in previous month for leading padding
        const prevMonthDays = new Date( year, month, 0 ).getDate();

        const cells = [];

        // Leading padding days from previous month
        for ( let i = firstDayIndex - 1; i >= 0; --i ) {
            const d = prevMonthDays - i;
            const prevMonthDate = new Date( year, month - 1, d );
            const y = prevMonthDate.getFullYear();
            const m = String( prevMonthDate.getMonth() + 1 ).padStart( 2, "0" );
            const dayStr = String( d ).padStart( 2, "0" );
            cells.push({
                dateStr: `${y}-${m}-${dayStr}`,
                dayNumber: d,
                isCurrentMonth: false,
                isToday: false
            });
        }

        // Current month days
        const todayStr = (() => {
            const now = new Date();
            const y = now.getFullYear();
            const m = String( now.getMonth() + 1 ).padStart( 2, "0" );
            const dayStr = String( now.getDate() ).padStart( 2, "0" );
            return `${y}-${m}-${dayStr}`;
        })();

        for ( let d = 1; d <= daysInMonth; ++d ) {
            const m = String( month + 1 ).padStart( 2, "0" );
            const dayStr = String( d ).padStart( 2, "0" );
            const dateStr = `${year}-${m}-${dayStr}`;
            cells.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: true,
                isToday: dateStr === todayStr
            });
        }

        // Trailing padding days to fill 7-column rows
        const remaining = 7 - ( cells.length % 7 );
        if ( remaining > 0 && remaining < 7 ) {
            for ( let d = 1; d <= remaining; ++d ) {
                const nextMonthDate = new Date( year, month + 1, d );
                const y = nextMonthDate.getFullYear();
                const m = String( nextMonthDate.getMonth() + 1 ).padStart( 2, "0" );
                const dayStr = String( d ).padStart( 2, "0" );
                cells.push({
                    dateStr: `${y}-${m}-${dayStr}`,
                    dayNumber: d,
                    isCurrentMonth: false,
                    isToday: false
                });
            }
        }

        return cells;
    }, [ currentMonthDate ] );

    // Monthly summary stats strictly filtered to current calendar month
    const monthStats = useMemo( () => {
        let totalSessions = 0;
        let totalMinutes = 0;
        const splitFreq = {};

        const targetMonthPrefix = `${currentMonthDate.getFullYear()}-${String( currentMonthDate.getMonth() + 1 ).padStart( 2, "0" )}`;

        for ( const [ dateStr, sessionList ] of Object.entries( calendarData ) ) {
            if ( !dateStr.startsWith( targetMonthPrefix ) ) continue;

            for ( let i = 0; i < sessionList.length; ++i ) {
                const item = sessionList[i];
                ++totalSessions;
                if ( item.durationMinutes ) {
                    totalMinutes += item.durationMinutes;
                }
                if ( item.splitTag ) {
                    splitFreq[item.splitTag] = ( splitFreq[item.splitTag] || 0 ) + 1;
                }
            }
        }

        let topSplit = "Varied";
        let maxCount = 0;
        for ( const [ split, count ] of Object.entries( splitFreq ) ) {
            if ( count > maxCount ) {
                maxCount = count;
                topSplit = split;
            }
        }

        return {
            totalSessions,
            totalMinutes,
            topSplit
        };
    }, [ calendarData, currentMonthDate ] );

    // Navigate month
    const handlePrevMonth = () => {
        setCurrentMonthDate( ( prev ) => new Date( prev.getFullYear(), prev.getMonth() - 1, 1 ) );
    };

    const handleNextMonth = () => {
        setCurrentMonthDate( ( prev ) => new Date( prev.getFullYear(), prev.getMonth() + 1, 1 ) );
    };

    const handleGoToday = () => {
        const now = new Date();
        setCurrentMonthDate( new Date( now.getFullYear(), now.getMonth(), 1 ) );
        const y = now.getFullYear();
        const m = String( now.getMonth() + 1 ).padStart( 2, "0" );
        const d = String( now.getDate() ).padStart( 2, "0" );
        setSelectedDateStr( `${y}-${m}-${d}` );
    };

    // Toggle workout expansion for full set breakdown
    const handleToggleExpandWorkout = async ( workoutId ) => {
        if ( expandedWorkoutId === workoutId ) {
            setExpandedWorkoutId( null );
            return;
        }

        setExpandedWorkoutId( workoutId );

        // Cache fetch full details if not already loaded
        if ( !detailedWorkouts[workoutId] ) {
            try {
                const details = await workoutApi.getWorkoutById( workoutId );
                setDetailedWorkouts( ( prev ) => ({ ...prev, [workoutId]: details }) );
            } catch ( err ) {
                console.error( "[History] Failed to fetch full workout details:", err );
            }
        }
    };

    // Clone workout for progressive overload session carryover
    const handleCloneWorkout = async ( workoutId ) => {
        if ( activeWorkout ) {
            const proceed = await modal.confirm({
                title: "Active Workout in Progress",
                message: "You already have an active workout in progress. Starting a new session will require completing or discarding your current workout. Resume active workout instead?",
                confirmText: "Resume Active",
                cancelText: "Cancel",
                variant: "warning"
            });
            if ( proceed ) {
                onNavigate( "active" );
            }
            return;
        }

        setCloningWorkoutId( workoutId );
        try {
            const cloned = await workoutApi.cloneWorkout( workoutId );
            setActiveWorkout( cloned );
            onNavigate( "active" );
        } catch ( err ) {
            console.error( "[History] Clone workout failed:", err );
            if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
                await refreshActiveWorkout();
                onNavigate( "active" );
            } else {
                await modal.alert({
                    title: "Clone Failed",
                    message: err.message || "Unable to clone past workout",
                    variant: "danger"
                });
            }
        } finally {
            setCloningWorkoutId( null );
        }
    };

    // Delete workout entry
    const handleDeleteWorkout = async ( workoutId, workoutName ) => {
        const confirmed = await modal.confirm({
            title: "Delete Workout Entry?",
            message: `Are you sure you want to delete "${workoutName || "Workout"}"? This action cannot be undone.`,
            confirmText: "Delete",
            cancelText: "Cancel",
            destructive: true
        });

        if ( !confirmed ) return;

        setDeletingWorkoutId( workoutId );
        try {
            await workoutApi.deleteWorkout( workoutId );

            // Refresh calendar and selected date list
            fetchCalendarMonth( currentMonthDate );
            setSelectedDateWorkouts( ( prev ) => prev.filter( ( w ) => w.id !== workoutId ) );
            setJournalEntries( ( prev ) => prev.filter( ( w ) => w.id !== workoutId ) );
            setTotalJournalCount( ( prev ) => Math.max( 0, prev - 1 ) );

            // Clear active workout reference if deleted session was active
            if ( activeWorkout?.id === workoutId ) {
                setActiveWorkout( null );
            }

            // Clear expanded details drawer if deleted session was expanded
            if ( expandedWorkoutId === workoutId ) {
                setExpandedWorkoutId( null );
            }
        } catch ( err ) {
            console.error( "[History] Delete workout failed:", err );
            await modal.alert({
                title: "Delete Failed",
                message: err.message || "Failed to delete workout entry",
                variant: "danger"
            });
        } finally {
            setDeletingWorkoutId( null );
        }
    };

    const monthTitle = currentMonthDate.toLocaleString( "default", { month: "long", year: "numeric" } );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Workout History
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Interactive calendar and chronological journal feed
                    </p>
                </div>

                {/* View Switcher Tabs */}
                <div className="inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800 self-start sm:self-auto">
                    <button
                        onClick={() => setActiveView( "calendar" )}
                        className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
                            activeView === "calendar"
                                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        <CalendarIcon className="w-4 h-4 stroke-[2.5]" />
                        <span>Calendar</span>
                    </button>
                    <button
                        onClick={() => setActiveView( "journal" )}
                        className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition ${
                            activeView === "journal"
                                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        <Layers className="w-4 h-4 stroke-[2.5]" />
                        <span>Journal</span>
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* CALENDAR VIEW */}
            {/* ========================================================================= */}
            {activeView === "calendar" && (
                <div className="space-y-6">
                    {/* Monthly Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Workouts
                            </span>
                            <div className="mt-2 flex items-baseline space-x-1">
                                <span className="text-2xl font-black text-white">
                                    {monthStats.totalSessions}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">sessions</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Active Time
                            </span>
                            <div className="mt-2 flex items-baseline space-x-1">
                                <span className="text-2xl font-black text-emerald-400">
                                    {Math.round( monthStats.totalMinutes / 60 * 10 ) / 10}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">hrs</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Primary Split
                            </span>
                            <div className="mt-2">
                                <span className="text-sm font-black text-amber-400 truncate block">
                                    {monthStats.topSplit}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Container */}
                    <div className="rounded-3xl bg-slate-900/70 border border-slate-800/80 p-4 sm:p-6 shadow-xl space-y-4">
                        {/* Month Navigation Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                                    {monthTitle}
                                </h2>
                                {loadingCalendar && (
                                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                                )}
                            </div>

                            <div className="flex items-center space-x-1.5">
                                <button
                                    onClick={handleGoToday}
                                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                                >
                                    Today
                                </button>
                                <button
                                    onClick={handlePrevMonth}
                                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    aria-label="Previous Month"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleNextMonth}
                                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    aria-label="Next Month"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Day of week headers */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
                            {DAYS_OF_WEEK.map( ( day ) => (
                                <div key={day} className="py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {day}
                                </div>
                            ) )}
                        </div>

                        {/* Calendar Grid Cells */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {calendarGrid.map( ( cell ) => {
                                const dayWorkouts = calendarData[cell.dateStr] || [];
                                const isSelected = selectedDateStr === cell.dateStr;
                                const hasWorkouts = dayWorkouts.length > 0;

                                return (
                                    <button
                                        key={cell.dateStr}
                                        onClick={() => setSelectedDateStr( cell.dateStr )}
                                        className={`min-h-[64px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-2xl text-left flex flex-col justify-between transition relative border ${
                                            isSelected
                                                ? "bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/50"
                                                : cell.isToday
                                                    ? "bg-slate-800/80 border-slate-700"
                                                    : cell.isCurrentMonth
                                                        ? "bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/50"
                                                        : "bg-slate-950/30 border-transparent opacity-35"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span
                                                className={`text-xs font-bold rounded-lg px-1.5 py-0.5 ${
                                                    cell.isToday
                                                        ? "bg-emerald-500 text-slate-950 font-black"
                                                        : cell.isCurrentMonth
                                                            ? isSelected
                                                                ? "text-emerald-400"
                                                                : "text-slate-300"
                                                            : "text-slate-600"
                                                }`}
                                            >
                                                {cell.dayNumber}
                                            </span>

                                            {hasWorkouts && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                                            )}
                                        </div>

                                        {/* Day Badges */}
                                        <div className="space-y-1 w-full mt-1 overflow-hidden">
                                            {dayWorkouts.slice( 0, 2 ).map( ( w, idx ) => (
                                                <div
                                                    key={w.id || idx}
                                                    className="truncate text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                                                    title={w.name}
                                                >
                                                    {w.splitTag || w.name}
                                                </div>
                                            ) )}
                                            {dayWorkouts.length > 2 && (
                                                <div className="text-[9px] font-bold text-slate-400 px-1">
                                                    +{dayWorkouts.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            } )}
                        </div>
                    </div>

                    {/* Selected Date Details Drawer */}
                    {selectedDateStr && (
                        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-5 sm:p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                                        Selected Date
                                    </span>
                                    <h3 className="text-lg font-extrabold text-white">
                                        {new Date( `${selectedDateStr}T12:00:00` ).toLocaleDateString( "default", {
                                            weekday: "long",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric"
                                        } )}
                                    </h3>
                                </div>

                                <span className="text-xs font-bold text-slate-400 px-3 py-1 rounded-full bg-slate-800">
                                    {selectedDateWorkouts.length} {selectedDateWorkouts.length === 1 ? "Workout" : "Workouts"}
                                </span>
                            </div>

                            {loadingSelectedDate ? (
                                <div className="py-10 flex items-center justify-center space-x-2 text-slate-400 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                    <span>Loading session details...</span>
                                </div>
                            ) : selectedDateWorkouts.length === 0 ? (
                                <div className="py-8 text-center space-y-2">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
                                        <Dumbbell className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-300">
                                        Rest Day / No Workouts Recorded
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        No training sessions logged for this calendar date
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedDateWorkouts.map( ( workout ) => {
                                        const isExpanded = expandedWorkoutId === workout.id;
                                        const detailed = detailedWorkouts[workout.id] || workout;

                                        return (
                                            <div
                                                key={workout.id}
                                                className="rounded-2xl bg-slate-950/70 border border-slate-800/90 p-4 space-y-3 transition hover:border-slate-700"
                                            >
                                                {/* Header row */}
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <h4 className="text-base font-bold text-white">
                                                                {workout.name}
                                                            </h4>
                                                            {workout.splitTag && (
                                                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                                                    {workout.splitTag}
                                                                </span>
                                                            )}
                                                            <span
                                                                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                                    workout.status === "COMPLETED"
                                                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                                                        : workout.status === "IN_PROGRESS"
                                                                            ? "bg-blue-500/15 border-blue-500/30 text-blue-400 animate-pulse"
                                                                            : "bg-slate-700/30 border-slate-600 text-slate-400"
                                                                }`}
                                                            >
                                                                {workout.status}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center space-x-4 text-xs text-slate-400">
                                                            <div className="flex items-center space-x-1">
                                                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                                <span>{workout.durationMinutes || 0} min</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <Dumbbell className="w-3.5 h-3.5 text-slate-500" />
                                                                <span>{workout.workoutExercises?.length || 0} exercises</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center space-x-2 self-start sm:self-auto">
                                                        {/* Clone to Today */}
                                                        <button
                                                            onClick={() => handleCloneWorkout( workout.id )}
                                                            disabled={cloningWorkoutId === workout.id}
                                                            className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition disabled:opacity-50"
                                                            title="Carry over targets into today's active session for progressive overload"
                                                        >
                                                            {cloningWorkoutId === workout.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                            <span>Clone to Today</span>
                                                        </button>

                                                        {/* Toggle Details Breakdown */}
                                                        <button
                                                            onClick={() => handleToggleExpandWorkout( workout.id )}
                                                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                                            title="Toggle Exercise Breakdown"
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4" />
                                                            )}
                                                        </button>

                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => handleDeleteWorkout( workout.id, workout.name )}
                                                            disabled={deletingWorkoutId === workout.id}
                                                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition disabled:opacity-50"
                                                            title="Delete Workout"
                                                        >
                                                            {deletingWorkoutId === workout.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expanded Exercise Breakdown */}
                                                {isExpanded && (
                                                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                                                        {detailed.workoutExercises?.length === 0 ? (
                                                            <p className="text-xs text-slate-500 italic">
                                                                No exercises logged in this workout session
                                                            </p>
                                                        ) : (
                                                            detailed.workoutExercises?.map( ( we, weIdx ) => (
                                                                <div
                                                                    key={we.id || weIdx}
                                                                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 space-y-2"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-white">
                                                                            {we.exercise?.name || "Exercise"}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            {we.sets?.length || 0} sets
                                                                        </span>
                                                                    </div>

                                                                    {/* Set chips */}
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {we.sets?.map( ( s, sIdx ) => (
                                                                            <span
                                                                                key={s.id || sIdx}
                                                                                className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                                                                                    s.isCompleted
                                                                                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                                                                                        : "bg-slate-800/60 border-slate-700 text-slate-400"
                                                                                }`}
                                                                            >
                                                                                #{getSetLabel( s )}: {formatSetSummary( s, weightUnit )}
                                                                            </span>
                                                                        ) )}
                                                                    </div>
                                                                </div>
                                                            ) )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* JOURNAL FEED VIEW */}
            {/* ========================================================================= */}
            {activeView === "journal" && (
                <div className="space-y-5">
                    {/* Search and Filters Bar */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={( e ) => setSearchQuery( e.target.value )}
                                placeholder="Search workouts by name..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery( "" )}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Split Filter Chips */}
                        <div
                            onWheel={( e ) => {
                                if ( e.deltaY !== 0 ) {
                                    e.currentTarget.scrollLeft += e.deltaY;
                                }
                            }}
                            className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
                        >
                            {SPLIT_FILTER_OPTIONS.map( ( split ) => (
                                <button
                                    key={split}
                                    onClick={() => setSelectedSplit( split )}
                                    className={`py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                                        selectedSplit === split
                                            ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                            : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {split}
                                </button>
                            ) )}
                        </div>
                    </div>

                    {/* Total Entries Count */}
                    <div className="text-xs text-slate-400 font-semibold px-1">
                        Showing {journalEntries.length} of {totalJournalCount} logged workouts
                    </div>

                    {/* Feed Stream */}
                    {loadingJournal && journalEntries.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                            <span className="text-sm font-medium">Loading workout journal...</span>
                        </div>
                    ) : journalEntries.length === 0 ? (
                        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                                <Layers className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-bold text-white">No Workouts Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                No logged workouts matched your search or split filter criteria
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {journalEntries.map( ( workout ) => {
                                const isExpanded = expandedWorkoutId === workout.id;
                                const detailed = detailedWorkouts[workout.id] || workout;

                                const workoutDateFormatted = new Date( workout.date ).toLocaleDateString( "default", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                });

                                return (
                                    <div
                                        key={workout.id}
                                        className="rounded-3xl bg-slate-900/70 border border-slate-800 p-5 space-y-3 shadow-lg transition hover:border-slate-700"
                                    >
                                        {/* Card Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h3 className="text-lg font-extrabold text-white">
                                                        {workout.name}
                                                    </h3>
                                                    {workout.splitTag && (
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                                            {workout.splitTag}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                            workout.status === "COMPLETED"
                                                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                                                : workout.status === "IN_PROGRESS"
                                                                    ? "bg-blue-500/15 border-blue-500/30 text-blue-400 animate-pulse"
                                                                    : "bg-slate-700/30 border-slate-600 text-slate-400"
                                                        }`}
                                                    >
                                                        {workout.status}
                                                    </span>
                                                </div>

                                                <div className="flex items-center space-x-4 text-xs text-slate-400">
                                                    <span>{workoutDateFormatted}</span>
                                                    <span>•</span>
                                                    <div className="flex items-center space-x-1">
                                                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{workout.durationMinutes || 0} min</span>
                                                    </div>
                                                    <span>•</span>
                                                    <div className="flex items-center space-x-1">
                                                        <Dumbbell className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{workout.workoutExercises?.length || 0} exercises</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center space-x-2 self-start sm:self-auto">
                                                {workout.status === "IN_PROGRESS" ? (
                                                    <button
                                                        onClick={() => onNavigate( "active" )}
                                                        className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-bold transition"
                                                    >
                                                        <Play className="w-3.5 h-3.5 fill-current" />
                                                        <span>Resume</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCloneWorkout( workout.id )}
                                                        disabled={cloningWorkoutId === workout.id}
                                                        className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition disabled:opacity-50"
                                                        title="Carry over targets into today's active session for progressive overload"
                                                    >
                                                        {cloningWorkoutId === workout.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                        <span>Clone to Today</span>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleToggleExpandWorkout( workout.id )}
                                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                                    title="Toggle Exercise Breakdown"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteWorkout( workout.id, workout.name )}
                                                    disabled={deletingWorkoutId === workout.id}
                                                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition disabled:opacity-50"
                                                    title="Delete Workout"
                                                >
                                                    {deletingWorkoutId === workout.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Notes if present */}
                                        {workout.notes && (
                                            <p className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 italic">
                                                "{workout.notes}"
                                            </p>
                                        )}

                                        {/* Expanded Exercise Breakdown */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                                                {detailed.workoutExercises?.length === 0 ? (
                                                    <p className="text-xs text-slate-500 italic">
                                                        No exercises logged in this workout session
                                                    </p>
                                                ) : (
                                                    detailed.workoutExercises?.map( ( we, weIdx ) => (
                                                        <div
                                                            key={we.id || weIdx}
                                                            className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/70 space-y-2.5"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs sm:text-sm font-bold text-white">
                                                                    {we.exercise?.name || "Exercise"}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400">
                                                                    {we.sets?.length || 0} sets
                                                                </span>
                                                            </div>

                                                            {/* Set metrics */}
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {we.sets?.map( ( s, sIdx ) => (
                                                                    <span
                                                                        key={s.id || sIdx}
                                                                        className={`text-[11px] font-mono px-2 py-1 rounded-lg border ${
                                                                            s.isCompleted
                                                                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                                                                                : "bg-slate-800/60 border-slate-700 text-slate-400"
                                                                        }`}
                                                                    >
                                                                        Set {getSetLabel( s )}: {formatSetSummary( s, weightUnit )}
                                                                    </span>
                                                                ) )}
                                                            </div>
                                                        </div>
                                                    ) )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            } )}

                            {/* Load More Button */}
                            {hasMoreJournal && (
                                <div className="pt-2 text-center">
                                    <button
                                        onClick={() => fetchJournal( false )}
                                        disabled={loadingJournal}
                                        className="py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition disabled:opacity-50"
                                    >
                                        {loadingJournal ? (
                                            <span className="flex items-center space-x-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                                <span>Loading more...</span>
                                            </span>
                                        ) : (
                                            <span>Load Older Workouts</span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistoryPage;
