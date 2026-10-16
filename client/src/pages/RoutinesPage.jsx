/******************************************************************************
 * Routines Page Component
 * Routine template blueprint manager, visual editor, and instant workout launcher
 ******************************************************************************/

import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Check,
    Copy,
    Dumbbell,
    Edit2,
    Layers,
    Loader2,
    Play,
    Plus,
    Search,
    Trash2,
    X
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { exerciseApi, routineApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";

// Standard split tag presets
const SPLIT_PRESETS = [
    "Push",
    "Pull",
    "Legs",
    "Upper",
    "Lower",
    "Full Body",
    "Arms & Shoulders",
    "Cardio & Core"
];

// Exercise category filters for the exercise picker
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

// Used to manage routine templates and launch workout sessions
export const RoutinesPage = ({ onNavigate }) => {
    const { activeWorkout, setActiveWorkout } = useAuth();
    const modal = useModal();

    const [ routines, setRoutines ] = useState( [] );
    const [ loading, setLoading ] = useState( true );
    const [ search, setSearch ] = useState( "" );
    const [ selectedSplit, setSelectedSplit ] = useState( "All" );

    // Action loaders
    const [ startingId, setStartingId ] = useState( null );
    const [ copyingId, setCopyingId ] = useState( null );
    const [ deletingId, setDeletingId ] = useState( null );

    // Editor State
    const [ isEditorOpen, setIsEditorOpen ] = useState( false );
    const [ editingRoutineId, setEditingRoutineId ] = useState( null ); // null = create new
    const [ formName, setFormName ] = useState( "" );
    const [ formSplitTag, setFormSplitTag ] = useState( "Push" );
    const [ formNotes, setFormNotes ] = useState( "" );
    const [ formExercises, setFormExercises ] = useState( [] );
    const [ saving, setSaving ] = useState( false );
    const [ editorError, setEditorError ] = useState( "" );

    // Exercise Picker Modal State (Inside Editor)
    const [ isPickerOpen, setIsPickerOpen ] = useState( false );
    const [ catalogExercises, setCatalogExercises ] = useState( [] );
    const [ loadingCatalog, setLoadingCatalog ] = useState( false );
    const [ pickerSearch, setPickerSearch ] = useState( "" );
    const [ pickerCategory, setPickerCategory ] = useState( "All" );

    // Fetch user's saved routines
    const loadRoutines = async () => {
        setLoading( true );
        try {
            const data = await routineApi.getRoutines();
            setRoutines( Array.isArray( data ) ? data : [] );
        } catch ( err ) {
            console.error( "[Routines] Failed to fetch routines:", err );
        } finally {
            setLoading( false );
        }
    };

    useEffect( () => {
        loadRoutines();
    }, [] );

    // Lock background scroll when either editor or picker modal is open
    useEffect( () => {
        if ( isEditorOpen || isPickerOpen ) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [ isEditorOpen, isPickerOpen ] );

    // Filter routines by search string and split tag
    const filteredRoutines = useMemo( () => {
        const query = search.trim().toLowerCase();

        return routines.filter( ( r ) => {
            if ( query ) {
                const matchName = r.name?.toLowerCase().includes( query );
                const matchSplit = r.splitTag?.toLowerCase().includes( query );
                if ( !matchName && !matchSplit ) return false;
            }

            if ( selectedSplit !== "All" ) {
                if ( r.splitTag?.toLowerCase() !== selectedSplit.toLowerCase() ) return false;
            }

            return true;
        } );
    }, [ routines, search, selectedSplit ] );

    // Used to 1-tap start a workout from a routine template
    const handleStartWorkout = async ( routine ) => {
        if ( activeWorkout ) {
            const resumeConfirmed = await modal.confirm({
                title: "Active Session In Progress",
                message: `An active workout session ("${activeWorkout.name}") is already in progress. Would you like to resume it now?`,
                confirmText: "Resume Session",
                cancelText: "Cancel"
            });
            if ( resumeConfirmed ) {
                onNavigate( "active" );
            }
            return;
        }

        setStartingId( routine.id );
        try {
            const newSession = await routineApi.startRoutine( routine.id );
            setActiveWorkout( newSession );
            onNavigate( "active" );
        } catch ( err ) {
            if ( err.code === "ERR_ACTIVE_WORKOUT_EXISTS" ) {
                const resumeConfirmed = await modal.confirm({
                    title: "Active Session In Progress",
                    message: `${err.message} Would you like to resume your active workout now?`,
                    confirmText: "Resume Session",
                    cancelText: "Cancel"
                });
                if ( resumeConfirmed ) {
                    onNavigate( "active" );
                }
            } else {
                await modal.alert({
                    title: "Failed to Start Routine",
                    message: err.message || "Failed to start workout routine"
                });
            }
        } finally {
            setStartingId( null );
        }
    };

    // Used to 1-tap duplicate/copy a routine template
    const handleCopyRoutine = async ( routine ) => {
        setCopyingId( routine.id );
        try {
            const duplicated = await routineApi.copyRoutine( routine.id );
            setRoutines( ( prev ) => [ duplicated, ...prev ] );
        } catch ( err ) {
            await modal.alert({
                title: "Duplicate Error",
                message: err.message || "Failed to duplicate routine"
            });
        } finally {
            setCopyingId( null );
        }
    };

    // Used to soft-delete/archive a routine template
    const handleDeleteRoutine = async ( routine ) => {
        const confirmed = await modal.confirm({
            title: "Delete Routine Blueprint",
            message: `Are you sure you want to delete the routine "${routine.name}"? Historical logged workouts will not be affected.`,
            confirmText: "Delete Routine",
            cancelText: "Cancel",
            destructive: true
        });
        if ( !confirmed ) return;

        setDeletingId( routine.id );
        try {
            await routineApi.deleteRoutine( routine.id );
            setRoutines( ( prev ) => prev.filter( ( r ) => r.id !== routine.id ) );
        } catch ( err ) {
            await modal.alert({
                title: "Delete Error",
                message: err.message || "Failed to delete routine"
            });
        } finally {
            setDeletingId( null );
        }
    };

    // Open Editor in Create Mode
    const handleOpenCreate = () => {
        setEditingRoutineId( null );
        setFormName( "" );
        setFormSplitTag( "Push" );
        setFormNotes( "" );
        setFormExercises( [] );
        setEditorError( "" );
        setIsEditorOpen( true );
    };

    // Open Editor in Edit Mode
    const handleOpenEdit = ( routine ) => {
        setEditingRoutineId( routine.id );
        setFormName( routine.name || "" );
        setFormSplitTag( routine.splitTag || "Push" );
        setFormNotes( routine.notes || "" );
        setFormExercises(
            ( routine.routineExercises || [] ).map( ( re ) => ({
                exerciseId: re.exerciseId,
                name: re.exercise?.name || "Exercise",
                category: re.exercise?.category || "General",
                modality: re.exercise?.modality || "WEIGHT_REPS",
                targetSets: re.targetSets ?? 3,
                targetValue: re.targetValue ?? "8-10",
                targetWeight: re.targetWeight ?? "",
                notes: re.notes ?? ""
            }) )
        );
        setEditorError( "" );
        setIsEditorOpen( true );
    };

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
                console.error( "[Routines] Failed to load exercise catalog for picker:", err );
            } finally {
                setLoadingCatalog( false );
            }
        }
    };

    // Add selected exercise from picker to the routine form
    const handleAddExerciseToRoutine = ( ex ) => {
        setFormExercises( ( prev ) => [
            ...prev,
            {
                exerciseId: ex.id,
                name: ex.name,
                category: ex.category,
                modality: ex.modality,
                targetSets: ex.modality === "DISTANCE_TIME" ? 1 : 3,
                targetValue: ex.modality === "TIME_DURATION" ? "60s" : ex.modality === "DISTANCE_TIME" ? "5 km" : "8-10",
                targetWeight: "",
                notes: ""
            }
        ] );
    };

    // Update specific target metric for an exercise item
    const handleUpdateFormExercise = ( index, field, value ) => {
        setFormExercises( ( prev ) => {
            const next = [ ...prev ];
            next[index] = { ...next[index], [field]: value };
            return next;
        } );
    };

    // Reorder exercise items
    const handleMoveExercise = ( index, direction ) => {
        setFormExercises( ( prev ) => {
            const next = [ ...prev ];
            const targetIndex = index + direction;
            if ( targetIndex < 0 || targetIndex >= next.length ) return prev;
            const temp = next[index];
            next[index] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        } );
    };

    // Remove exercise item
    const handleRemoveExercise = ( index ) => {
        setFormExercises( ( prev ) => prev.filter( ( _, i ) => i !== index ) );
    };

    // Submit Routine Form (Create or Update)
    const handleSaveRoutine = async ( e ) => {
        e.preventDefault();
        setEditorError( "" );

        const trimmedName = formName.trim();
        if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
            setEditorError( "Routine name must be between 2 and 50 characters" );
            return;
        }

        if ( formExercises.length === 0 ) {
            setEditorError( "Please add at least one exercise to this workout routine" );
            return;
        }

        setSaving( true );
        const payload = {
            name: trimmedName,
            splitTag: formSplitTag.trim() || null,
            notes: formNotes.trim() || null,
            exercises: formExercises.map( ( item, idx ) => ({
                exerciseId: item.exerciseId,
                orderIndex: idx,
                targetSets: parseInt( item.targetSets, 10 ) || 3,
                targetValue: item.targetValue ? String( item.targetValue ).trim() : null,
                targetWeight: item.targetWeight !== "" && !isNaN( Number( item.targetWeight ) ) ? Number( item.targetWeight ) : null,
                notes: item.notes ? String( item.notes ).trim() : null
            }) )
        };

        try {
            if ( editingRoutineId ) {
                const updated = await routineApi.updateRoutine( editingRoutineId, payload );
                setRoutines( ( prev ) => prev.map( ( r ) => ( r.id === editingRoutineId ? updated : r ) ) );
            } else {
                const created = await routineApi.createRoutine( payload );
                setRoutines( ( prev ) => [ created, ...prev ] );
            }
            setIsEditorOpen( false );
        } catch ( err ) {
            setEditorError( err.message || "Failed to save workout routine" );
        } finally {
            setSaving( false );
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

    return (
        <div className="space-y-6">
            {/* Header: Title, Subtitle & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Workout Routines
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Create, copy, and manage reusable workout blueprints
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>New Routine</span>
                </button>
            </div>

            {/* Search Bar & Split Tag Filter Chips */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={( e ) => setSearch( e.target.value )}
                        placeholder="Search routines by title or split tag..."
                        className="w-full pl-10 pr-10 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch( "" )}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Split Tag Filter Chips */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                    {[ "All", ...SPLIT_PRESETS ].map( ( tag ) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedSplit( tag )}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors duration-150 cursor-pointer ${
                                selectedSplit === tag
                                    ? "bg-slate-100 text-slate-950 border-slate-100 shadow-md"
                                    : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800"
                            }`}
                        >
                            {tag}
                        </button>
                    ) )}
                </div>
            </div>

            {/* Routine Templates Grid */}
            {loading ? (
                <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading workout routines...</span>
                </div>
            ) : filteredRoutines.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
                        <Layers className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-base font-bold text-white">No routines found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {search || selectedSplit !== "All"
                            ? "No routines match your current filters. Try resetting search."
                            : "You haven't created any workout routines yet. Start by creating your first split blueprint!"}
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                        Create Routine Blueprint
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredRoutines.map( ( routine ) => {
                        const exercises = routine.routineExercises || [];
                        const totalSets = exercises.reduce( ( sum, ex ) => sum + ( ex.targetSets || 0 ), 0 );

                        return (
                            <div
                                key={routine.id}
                                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col justify-between hover:border-slate-700/80 transition"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                {routine.splitTag && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                        {routine.splitTag}
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-semibold text-slate-400">
                                                    {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"} • {totalSets} sets
                                                </span>
                                            </div>
                                            <h2 className="text-lg font-bold text-white mt-1">
                                                {routine.name}
                                            </h2>
                                        </div>

                                        <div className="flex items-center space-x-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyRoutine( routine )}
                                                disabled={copyingId === routine.id}
                                                title="Duplicate Routine"
                                                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                                            >
                                                {copyingId === routine.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit( routine )}
                                                title="Edit Routine"
                                                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRoutine( routine )}
                                                disabled={deletingId === routine.id}
                                                title="Delete Routine"
                                                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
                                            >
                                                {deletingId === routine.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {routine.notes && (
                                        <p className="text-xs text-slate-400 line-clamp-2">
                                            {routine.notes}
                                        </p>
                                    )}

                                    {/* Exercise Preview Chips */}
                                    <div className="pt-1 flex flex-wrap gap-1.5 max-h-24 overflow-hidden">
                                        {exercises.map( ( re, idx ) => {
                                            const isCardio = re.exercise?.modality === "DISTANCE_TIME";
                                            const isDuration = re.exercise?.modality === "TIME_DURATION";
                                            const setsLabel = ( isCardio && re.targetSets === 1 )
                                                ? ( re.targetValue || "Cardio" )
                                                : `${re.targetSets}×${re.targetValue || ( isDuration ? "time" : "sets" )}`;

                                            return (
                                                <span
                                                    key={re.id || idx}
                                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-950/80 text-slate-300 border border-slate-800"
                                                >
                                                    <span>{re.exercise?.name || "Exercise"}</span>
                                                    <span className="text-slate-500 font-mono text-[10px]">
                                                        {setsLabel}
                                                    </span>
                                                </span>
                                            );
                                        } )}
                                    </div>
                                </div>

                                {/* 1-Tap Launch Button */}
                                <div className="mt-5 pt-3 border-t border-slate-800/70">
                                    <button
                                        type="button"
                                        onClick={() => handleStartWorkout( routine )}
                                        disabled={startingId === routine.id}
                                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                                    >
                                        {startingId === routine.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Starting Session...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 fill-slate-950 stroke-none" />
                                                <span>Start Workout</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    } )}
                </div>
            )}

            {/* Visual Routine Editor Modal / Overlay */}
            {isEditorOpen && createPortal(
                <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        {/* Editor Header */}
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-extrabold text-white">
                                    {editingRoutineId ? "Edit Routine Blueprint" : "Create Workout Routine"}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Configure movements, target sets, and volume targets
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditorOpen( false )}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {editorError && (
                            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold shrink-0">
                                {editorError}
                            </div>
                        )}

                        {/* Editor Form Body (Scrollable) */}
                        <form id="routine-editor-form" onSubmit={handleSaveRoutine} className="flex-1 overflow-y-auto space-y-5 pr-1">
                            {/* Routine Name & Split Tag */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Routine Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formName}
                                        onChange={( e ) => setFormName( e.target.value )}
                                        placeholder="e.g. Push Day A, Heavy Upper Split"
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Split Category Tag
                                    </label>
                                    <input
                                        type="text"
                                        value={formSplitTag}
                                        onChange={( e ) => setFormSplitTag( e.target.value )}
                                        placeholder="e.g. Push, Pull, Legs"
                                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                                    />
                                </div>
                            </div>

                            {/* Split Tag Presets */}
                            <div>
                                <span className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                                    Quick Split Presets
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {SPLIT_PRESETS.map( ( preset ) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setFormSplitTag( preset )}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                                                formSplitTag === preset
                                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                                            }`}
                                        >
                                            {preset}
                                        </button>
                                    ) )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Notes & Instructions (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={formNotes}
                                    onChange={( e ) => setFormNotes( e.target.value )}
                                    placeholder="e.g. Focus on deep stretch on bench press. 2 min rest between compounds."
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition resize-none"
                                />
                            </div>

                            {/* Planned Exercises Section */}
                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">
                                            Planned Exercises ({formExercises.length})
                                        </h4>
                                        <p className="text-[11px] text-slate-400">
                                            Ordered movement sequence with target sets and loads
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleOpenPicker}
                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Add Exercise</span>
                                    </button>
                                </div>

                                {formExercises.length === 0 ? (
                                    <div className="p-8 rounded-2xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-2">
                                        <Dumbbell className="w-6 h-6 text-slate-600 mx-auto" />
                                        <p className="text-xs font-semibold text-slate-400">
                                            No exercises in this routine yet
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleOpenPicker}
                                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                                        >
                                            Browse Exercise Catalog to Add
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formExercises.map( ( item, index ) => (
                                            <div
                                                key={`${item.exerciseId}-${index}`}
                                                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center justify-center">
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-sm font-bold text-white">
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                                            {item.category}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => handleMoveExercise( index, -1 )}
                                                            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                                        >
                                                            <ArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={index === formExercises.length - 1}
                                                            onClick={() => handleMoveExercise( index, 1 )}
                                                            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                                        >
                                                            <ArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveExercise( index )}
                                                            className="p-1 rounded bg-slate-900 text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Target Set Fields (Modality Adaptive) */}
                                                {item.modality === "WEIGHT_REPS" ? (
                                                    <div className="grid grid-cols-3 gap-2.5">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Sets
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={20}
                                                                value={item.targetSets}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetSets", e.target.value )}
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Reps
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.targetValue}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetValue", e.target.value )}
                                                                placeholder="e.g. 8-10"
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Weight
                                                            </label>
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                value={item.targetWeight}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetWeight", e.target.value )}
                                                                placeholder="Optional"
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : item.modality === "TIME_DURATION" ? (
                                                    <div className="grid grid-cols-2 gap-2.5">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Sets / Rounds
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={20}
                                                                value={item.targetSets}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetSets", e.target.value )}
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Duration
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.targetValue}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetValue", e.target.value )}
                                                                placeholder="e.g. 60s or 45s"
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-2.5">
                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Sets / Intervals
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={20}
                                                                value={item.targetSets}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetSets", e.target.value )}
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">
                                                                Target Distance or Time
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.targetValue}
                                                                onChange={( e ) => handleUpdateFormExercise( index, "targetValue", e.target.value )}
                                                                placeholder="e.g. 5 km, 3 mi, or 30 min"
                                                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) )}
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* Editor Footer Actions */}
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsEditorOpen( false )}
                                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="routine-editor-form"
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Saving Blueprint...</span>
                                    </>
                                ) : (
                                    <span>Save Blueprint</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Exercise Picker Modal */}
            {isPickerOpen && createPortal(
                <div className="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 my-auto max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-white">Add Exercise to Routine</h3>
                                <p className="text-xs text-slate-400">Select movements from your catalog</p>
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
                                    const alreadyAdded = formExercises.some( ( item ) => item.exerciseId === ex.id );

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
                                                onClick={() => handleAddExerciseToRoutine( ex )}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                                                    alreadyAdded
                                                        ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                                                        : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
                                                }`}
                                            >
                                                {alreadyAdded ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
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
