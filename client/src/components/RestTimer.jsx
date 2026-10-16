/******************************************************************************
 * Rest Timer Component
 * Floating gym rest timer w/ presets, countdown, audio chime, and minimization
 ******************************************************************************/

import {
    Bell,
    ChevronDown,
    ChevronUp,
    Minus,
    Pause,
    Play,
    Plus,
    RotateCcw,
    Timer,
    X
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { playTimerCompleteTone, primeAudioContext } from "../utils/audio.js";

const PRESET_DURATIONS = [ 30, 60, 90, 120, 180 ];

// Format seconds into MM:SS
const formatTime = ( sec ) => {
    const s = Math.max( 0, sec );
    const mins = Math.floor( s / 60 );
    const remaining = s % 60;
    return `${String( mins ).padStart( 2, "0" )}:${String( remaining ).padStart( 2, "0" )}`;
};

export const RestTimer = ({
    initialSeconds = 90,
    isOpen,
    onClose,
    trigger = 0
}) => {
    const [ totalSeconds, setTotalSeconds ] = useState( initialSeconds );
    const [ secondsLeft, setSecondsLeft ] = useState( initialSeconds );
    const [ isRunning, setIsRunning ] = useState( true );
    const [ isMinimized, setIsMinimized ] = useState( false );
    const [ isFinished, setIsFinished ] = useState( false );

    const targetEndTimeRef = useRef( null );

    // Reset timer when opened or when trigger updates on new set completion
    useEffect( () => {
        if ( isOpen ) {
            const secs = totalSeconds || initialSeconds || 90;
            setSecondsLeft( secs );
            setIsRunning( true );
            setIsFinished( false );
            setIsMinimized( false );
            targetEndTimeRef.current = Date.now() + secs * 1000;
        }
    }, [ isOpen, trigger ] );

    // Real-time timestamp countdown interval w/ mobile background wake sync
    useEffect( () => {
        if ( !isOpen || !isRunning || isFinished ) return;

        const tick = () => {
            if ( !targetEndTimeRef.current ) return;
            const diffMs = targetEndTimeRef.current - Date.now();
            const remaining = Math.max( 0, Math.ceil( diffMs / 1000 ) );
            setSecondsLeft( remaining );

            if ( remaining <= 0 ) {
                targetEndTimeRef.current = null;
                setIsRunning( false );
                setIsFinished( true );
                playTimerCompleteTone();
            }
        };

        const interval = setInterval( tick, 500 );

        // Instantly resync remaining time when returning from background or unlocking phone
        const handleSync = () => tick();
        window.addEventListener( "focus", handleSync );
        document.addEventListener( "visibilitychange", handleSync );

        return () => {
            clearInterval( interval );
            window.removeEventListener( "focus", handleSync );
            document.removeEventListener( "visibilitychange", handleSync );
        };
    }, [ isOpen, isRunning, isFinished ] );

    if ( !isOpen ) return null;

    // Calculate percentage remaining for progress bar
    const progressPercent = totalSeconds > 0
        ? Math.max( 0, Math.min( 100, ( secondsLeft / totalSeconds ) * 100 ) )
        : 0;

    const handleAdjust = ( delta ) => {
        primeAudioContext();
        const next = Math.max( 5, secondsLeft + delta );
        if ( next > totalSeconds ) {
            setTotalSeconds( next );
        }
        setSecondsLeft( next );
        setIsFinished( false );
        setIsRunning( true );
        targetEndTimeRef.current = Date.now() + next * 1000;
    };

    const handleSelectPreset = ( secs ) => {
        primeAudioContext();
        setTotalSeconds( secs );
        setSecondsLeft( secs );
        setIsRunning( true );
        setIsFinished( false );
        targetEndTimeRef.current = Date.now() + secs * 1000;
    };

    const handleReset = () => {
        primeAudioContext();
        setSecondsLeft( totalSeconds );
        setIsRunning( true );
        setIsFinished( false );
        targetEndTimeRef.current = Date.now() + totalSeconds * 1000;
    };

    const handleToggleRun = () => {
        primeAudioContext();
        setIsRunning( ( prev ) => {
            const next = !prev;
            if ( next ) {
                targetEndTimeRef.current = Date.now() + secondsLeft * 1000;
            } else {
                targetEndTimeRef.current = null;
            }
            return next;
        } );
    };

    // Render using React Portal at z-[45] above navigation dock
    return createPortal(
        <div className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-[45] max-w-sm w-[calc(100vw-1.5rem)] sm:w-80 select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
            {isMinimized ? (
                // Minimized Pill
                <div
                    onClick={() => setIsMinimized( false )}
                    className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl backdrop-blur-md cursor-pointer hover:border-emerald-400 transition"
                >
                    <div className="flex items-center space-x-2">
                        <Timer className={`w-4 h-4 ${isFinished ? "text-amber-400 animate-bounce" : "text-emerald-400"}`} />
                        <span className="text-xs font-bold text-slate-300">Rest:</span>
                        <span className={`text-sm font-mono font-black ${isFinished ? "text-amber-400 animate-pulse" : "text-white"}`}>
                            {isFinished ? "Done!" : formatTime( secondsLeft )}
                        </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                        <button
                            type="button"
                            onClick={( e ) => {
                                e.stopPropagation();
                                setIsMinimized( false );
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-white"
                        >
                            <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={( e ) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                // Expanded Tactile Card
                <div className="rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl p-4 backdrop-blur-md space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                                <Timer className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                Rest Interval
                            </span>
                        </div>

                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={() => setIsMinimized( true )}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                title="Minimize"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                title="Close Timer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Timer Digital Display & Progress Bar */}
                    <div className="space-y-2 py-1 text-center">
                        <div className="text-4xl font-mono font-black tracking-tight text-white flex items-center justify-center space-x-2">
                            {isFinished ? (
                                <span className="text-2xl text-emerald-400 animate-pulse font-extrabold flex items-center space-x-1.5">
                                    <Bell className="w-6 h-6 animate-bounce" />
                                    <span>Time to Lift!</span>
                                </span>
                            ) : (
                                <span>{formatTime( secondsLeft )}</span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                    isFinished
                                        ? "bg-amber-400"
                                        : progressPercent < 20
                                            ? "bg-amber-500"
                                            : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Step Increments & Play/Pause Controls */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={() => handleAdjust( -15 )}
                                className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition cursor-pointer"
                            >
                                -15s
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAdjust( 15 )}
                                className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-300 transition cursor-pointer"
                            >
                                +15s
                            </button>
                        </div>

                        <div className="flex items-center space-x-1.5">
                            <button
                                type="button"
                                onClick={handleToggleRun}
                                className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                    isRunning
                                        ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                                        : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                                }`}
                                title={isRunning ? "Pause" : "Resume"}
                            >
                                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                            </button>

                            <button
                                type="button"
                                onClick={handleReset}
                                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                                title="Reset Timer"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Preset Duration Chips */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                        {PRESET_DURATIONS.map( ( sec ) => (
                            <button
                                key={sec}
                                type="button"
                                onClick={() => handleSelectPreset( sec )}
                                className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                    totalSeconds === sec && !isFinished
                                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                                        : "bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800"
                                }`}
                            >
                                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
                            </button>
                        ) )}
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
