/******************************************************************************
 * Exercises Page Component
 * Master exercise catalog browser, multi-facet filtering, and custom creation
 ******************************************************************************/

import {
    Activity,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Dumbbell,
    Filter,
    Loader2,
    Plus,
    Search,
    Trash2,
    X
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { exerciseApi, workoutExerciseApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";

// Standard muscle categories for quick filtering
const CATEGORIES = [
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

// Tracking modality options
const MODALITIES = [
    { label: "All Modalities", value: "" },
    { label: "Weight & Reps", value: "WEIGHT_REPS" },
    { label: "Time Duration (Holds)", value: "TIME_DURATION" },
    { label: "Distance & Time (Cardio)", value: "DISTANCE_TIME" }
];

// Equipment presets for custom exercise creation
const EQUIPMENT_PRESETS = [
    "Barbell",
    "Dumbbell",
    "Cable",
    "Machine",
    "Bodyweight",
    "Kettlebell",
    "Smith Machine",
    "Resistance Band",
    "Cardio Machine",
    "Other"
];

// Used to render exercise catalog browser and custom movement management
export const ExercisesPage = ({ onNavigate }) => {
    const { activeWorkout, refreshActiveWorkout } = useAuth();
    const modal = useModal();

    const [ exercises, setExercises ] = useState( [] );
    const [ loading, setLoading ] = useState( true );
    const [ search, setSearch ] = useState( "" );
    const [ selectedCategory, setSelectedCategory ] = useState( "All" );
    const [ selectedModality, setSelectedModality ] = useState( "" );
    const [ sourceFilter, setSourceFilter ] = useState( "all" ); // Filter options: "all" | "master" | "custom"

    // Custom Exercise Modal State
    const [ isModalOpen, setIsModalOpen ] = useState( false );
    const [ customName, setCustomName ] = useState( "" );
    const [ customCategory, setCustomCategory ] = useState( "Chest" );
    const [ customEquipment, setCustomEquipment ] = useState( "Barbell" );
    const [ customModality, setCustomModality ] = useState( "WEIGHT_REPS" );
    const [ creating, setCreating ] = useState( false );
    const [ formError, setFormError ] = useState( "" );

    // Actions State
    const [ deletingId, setDeletingId ] = useState( null );
    const [ addingId, setAddingId ] = useState( null );
    const [ addedId, setAddedId ] = useState( null );

    const categoryScrollRef = useRef( null );
    const modalityScrollRef = useRef( null );

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

    // Lock body scroll while modal is open
    useEffect( () => {
        if ( isModalOpen ) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [ isModalOpen ] );

    // Fetch exercises from API
    const loadExercises = async () => {
        setLoading( true );
        try {
            const data = await exerciseApi.getExercises();
            setExercises( Array.isArray( data ) ? data : [] );
        } catch ( err ) {
            console.error( "[Exercises] Failed to load catalog:", err );
        } finally {
            setLoading( false );
        }
    };

    useEffect( () => {
        loadExercises();
    }, [] );

    // Client-side instant filtering across multiple facets
    const filteredExercises = useMemo( () => {
        const query = search.trim().toLowerCase();

        return exercises.filter( ( ex ) => {
            // Text search match
            if ( query ) {
                const matchName = ex.name?.toLowerCase().includes( query );
                const matchCategory = ex.category?.toLowerCase().includes( query );
                const matchEquipment = ex.equipment?.toLowerCase().includes( query );
                if ( !matchName && !matchCategory && !matchEquipment ) return false;
            }

            // Category filter match
            if ( selectedCategory !== "All" ) {
                if ( ex.category?.toLowerCase() !== selectedCategory.toLowerCase() ) return false;
            }

            // Modality filter match
            if ( selectedModality !== "" ) {
                if ( ex.modality !== selectedModality ) return false;
            }

            // Source filter match (Master Catalog vs Custom)
            if ( sourceFilter === "master" && ex.isCustom ) return false;
            if ( sourceFilter === "custom" && !ex.isCustom ) return false;

            return true;
        } );
    }, [ exercises, search, selectedCategory, selectedModality, sourceFilter ] );

    // Used to create new custom movement
    const handleCreateExercise = async ( e ) => {
        e.preventDefault();
        setFormError( "" );

        const trimmedName = customName.trim();
        if ( trimmedName.length < 2 || trimmedName.length > 50 ) {
            setFormError( "Exercise name must be between 2 and 50 characters" );
            return;
        }

        setCreating( true );
        try {
            await exerciseApi.createExercise({
                name: trimmedName,
                category: customCategory,
                equipment: customEquipment,
                modality: customModality
            });

            // Reset modal state and reload catalog
            setCustomName( "" );
            setIsModalOpen( false );
            await loadExercises();
        } catch ( err ) {
            setFormError( err.message || "Failed to create custom exercise" );
        } finally {
            setCreating( false );
        }
    };

    // Used to add an exercise directly into the active workout session
    const handleAddToWorkout = async ( ex ) => {
        if ( !activeWorkout?.id ) return;
        setAddingId( ex.id );
        try {
            await workoutExerciseApi.addExercise( activeWorkout.id, { exerciseId: ex.id } );
            await refreshActiveWorkout();
            setAddedId( ex.id );
            setTimeout( () => setAddedId( null ), 2000 );
        } catch ( err ) {
            await modal.alert({
                title: "Failed to Add Exercise",
                message: err.message || "Could not add exercise to active workout",
                variant: "danger"
            });
        } finally {
            setAddingId( null );
        }
    };

    // Used to archive/delete custom movement
    const handleDeleteExercise = async ( id, name ) => {
        const confirmed = await modal.confirm({
            title: "Delete Custom Exercise?",
            message: `Are you sure you want to remove "${name}" from your custom movements? Historical workout logs will not be affected.`,
            confirmText: "Delete Movement",
            variant: "danger"
        });
        if ( !confirmed ) return;

        setDeletingId( id );
        try {
            await exerciseApi.deleteExercise( id );
            setExercises( ( prev ) => prev.filter( ( item ) => item.id !== id ) );
        } catch ( err ) {
            await modal.alert({
                title: "Delete Failed",
                message: err.message || "Failed to delete exercise",
                variant: "danger"
            });
        } finally {
            setDeletingId( null );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header: Title, Description & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Exercise Catalog
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Browse master movements or log your own custom variations
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setIsModalOpen( true )}
                    className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>New Custom Exercise</span>
                </button>
            </div>

            {/* Search Bar & Source Selector */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={( e ) => setSearch( e.target.value )}
                        placeholder="Search exercises, categories, equipment..."
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

                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800 shrink-0 self-start">
                    <button
                        type="button"
                        onClick={() => setSourceFilter( "all" )}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 cursor-pointer ${
                            sourceFilter === "all"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "text-slate-400 hover:text-slate-200 border-transparent"
                        }`}
                    >
                        All ({exercises.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSourceFilter( "master" )}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 cursor-pointer ${
                            sourceFilter === "master"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "text-slate-400 hover:text-slate-200 border-transparent"
                        }`}
                    >
                        Master
                    </button>
                    <button
                        type="button"
                        onClick={() => setSourceFilter( "custom" )}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 cursor-pointer ${
                            sourceFilter === "custom"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                : "text-slate-400 hover:text-slate-200 border-transparent"
                        }`}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {/* Muscle Category Filter Chips (Desktop & Mobile Scrollable) */}
            <div className="space-y-2">
                <div className="flex items-center space-x-1.5 w-full">
                    <button
                        type="button"
                        onClick={() => handleScrollContainer( categoryScrollRef, -1 )}
                        className="hidden md:flex shrink-0 w-7 h-7 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                        aria-label="Scroll categories left"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <div
                        ref={categoryScrollRef}
                        onWheel={handleWheelHorizontal}
                        className="flex-1 min-w-0 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth px-0.5"
                    >
                        {CATEGORIES.map( ( cat ) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory( cat )}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors duration-150 cursor-pointer ${
                                    selectedCategory === cat
                                        ? "bg-slate-100 text-slate-950 border-slate-100 shadow-md"
                                        : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800"
                                }`}
                            >
                                {cat}
                            </button>
                        ) )}
                    </div>
                    <button
                        type="button"
                        onClick={() => handleScrollContainer( categoryScrollRef, 1 )}
                        className="hidden md:flex shrink-0 w-7 h-7 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                        aria-label="Scroll categories right"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Modality Chips */}
                <div className="flex items-center space-x-1 w-full">
                    <button
                        type="button"
                        onClick={() => handleScrollContainer( modalityScrollRef, -1 )}
                        className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                        aria-label="Scroll modalities left"
                    >
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    <div
                        ref={modalityScrollRef}
                        onWheel={handleWheelHorizontal}
                        className="flex-1 min-w-0 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none scroll-smooth px-0.5"
                    >
                        {MODALITIES.map( ( m ) => (
                            <button
                                key={m.label}
                                type="button"
                                onClick={() => setSelectedModality( m.value )}
                                className={`px-3 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                                    selectedModality === m.value
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                                        : "bg-slate-900/50 text-slate-400 hover:text-slate-300 border border-slate-800/80"
                                }`}
                            >
                                {m.label}
                            </button>
                        ) )}
                    </div>
                    <button
                        type="button"
                        onClick={() => handleScrollContainer( modalityScrollRef, 1 )}
                        className="hidden md:flex shrink-0 w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white items-center justify-center shadow-sm transition cursor-pointer"
                        aria-label="Scroll modalities right"
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Exercise Grid / Feed */}
            {loading ? (
                <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    <span>Loading catalog...</span>
                </div>
            ) : filteredExercises.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
                        <Dumbbell className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-base font-bold text-white">No exercises found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Try adjusting your search query, clearing filters, or create a new custom movement
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSearch( "" );
                            setSelectedCategory( "All" );
                            setSelectedModality( "" );
                            setSourceFilter( "all" );
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition cursor-pointer"
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredExercises.map( ( ex ) => (
                        <div
                            key={ex.id}
                            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md hover:border-slate-700/80 transition flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                                        {ex.name}
                                    </h3>
                                    {ex.isCustom && (
                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                            Custom
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300">
                                        {ex.category}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950 text-slate-400 border border-slate-800">
                                        {ex.equipment}
                                    </span>
                                    {ex.modality === "TIME_DURATION" ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 flex items-center space-x-1">
                                            <Clock className="w-3 h-3 text-sky-400" />
                                            <span>Time Duration (Hold)</span>
                                        </span>
                                    ) : ex.modality === "DISTANCE_TIME" ? (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center space-x-1">
                                            <Activity className="w-3 h-3 text-amber-400" />
                                            <span>Distance & Time (Cardio)</span>
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 flex items-center space-x-1">
                                            <Dumbbell className="w-3 h-3 text-emerald-400" />
                                            <span>Weight × Reps</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Card Actions Footer */}
                            {( activeWorkout || ex.isCustom ) && (
                                <div className="mt-3.5 pt-2.5 border-t border-slate-800/60 flex items-center justify-between gap-2">
                                    {activeWorkout ? (
                                        <button
                                            type="button"
                                            onClick={() => handleAddToWorkout( ex )}
                                            disabled={addingId === ex.id}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                                                addedId === ex.id
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                                    : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm"
                                            }`}
                                        >
                                            {addingId === ex.id ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Adding...</span>
                                                </>
                                            ) : addedId === ex.id ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Added to Workout</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Add to Workout</span>
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div />
                                    )}

                                    {ex.isCustom && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteExercise( ex.id, ex.name )}
                                            disabled={deletingId === ex.id}
                                            className="text-slate-500 hover:text-rose-400 text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ml-auto"
                                        >
                                            {deletingId === ex.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                            <span>Delete Custom</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) )}
                </div>
            )}

            {/* Create Custom Exercise Modal (Portal Mounted) */}
            {isModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
                    onClick={( e ) => {
                        if ( e.target === e.currentTarget ) setIsModalOpen( false );
                    }}
                >
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-6 space-y-5 my-auto max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <h3 className="text-lg font-extrabold text-white">Create Custom Exercise</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen( false )}
                                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {formError && (
                            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateExercise} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Exercise Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={customName}
                                    onChange={( e ) => setCustomName( e.target.value )}
                                    placeholder="e.g. Incline Smith Press, Cable Hammer Curl"
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Muscle Group *
                                    </label>
                                    <select
                                        value={customCategory}
                                        onChange={( e ) => setCustomCategory( e.target.value )}
                                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition cursor-pointer"
                                    >
                                        {CATEGORIES.filter( ( c ) => c !== "All" ).map( ( cat ) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ) )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                        Equipment *
                                    </label>
                                    <select
                                        value={customEquipment}
                                        onChange={( e ) => setCustomEquipment( e.target.value )}
                                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition cursor-pointer"
                                    >
                                        {EQUIPMENT_PRESETS.map( ( eq ) => (
                                            <option key={eq} value={eq}>
                                                {eq}
                                            </option>
                                        ) )}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                                    Tracking Modality *
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[
                                        {
                                            value: "WEIGHT_REPS",
                                            title: "Weight & Reps",
                                            desc: "Lifting, barbells, dumbbells & machines"
                                        },
                                        {
                                            value: "TIME_DURATION",
                                            title: "Time Duration (Holds)",
                                            desc: "Planks, wall sits & static timed rounds"
                                        },
                                        {
                                            value: "DISTANCE_TIME",
                                            title: "Distance & Time (Cardio)",
                                            desc: "Running, rowing, cycling & pace tracking"
                                        }
                                    ].map( ( m ) => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            onClick={() => setCustomModality( m.value )}
                                            className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                                                customModality === m.value
                                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                                            }`}
                                        >
                                            <span className="text-xs font-bold text-white block mb-0.5">{m.title}</span>
                                            <span className="text-[10px] text-slate-400 block">{m.desc}</span>
                                        </button>
                                    ) )}
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen( false )}
                                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        <span>Save Movement</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
