/******************************************************************************
 * Active Workout Banner Component
 * Persistent top notification ribbon for in-progress gym workouts
 ******************************************************************************/

import { ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";

// Used to format elapsed time in MM:SS or HH:MM:SS
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

// Used to render persistent gym session reminder ribbon
export const ActiveWorkoutBanner = ({ activeTab, onResume }) => {
    const { activeWorkout } = useAuth();
    const [ elapsed, setElapsed ] = useState( () => formatElapsed( activeWorkout?.startedAt ) );

    useEffect( () => {
        if ( !activeWorkout ) return;

        setElapsed( formatElapsed( activeWorkout.startedAt ) );
        const interval = setInterval( () => {
            setElapsed( formatElapsed( activeWorkout.startedAt ) );
        }, 1000 );

        return () => clearInterval( interval );
    }, [ activeWorkout ] );

    if ( !activeWorkout ) return null;

    const isCurrentActiveTab = activeTab === "active";

    return (
        <div
            onClick={isCurrentActiveTab ? undefined : onResume}
            className={`w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-slate-950 px-4 py-2.5 shadow-lg shadow-emerald-950/40 flex items-center justify-between transition-all ${
                isCurrentActiveTab ? "cursor-default" : "cursor-pointer hover:brightness-105 active:scale-[0.99]"
            }`}
        >
            <div className="flex items-center space-x-2.5 overflow-hidden">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-60" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950" />
                </span>
                <div className="flex items-baseline space-x-2 truncate">
                    <span className="font-bold text-sm tracking-tight truncate">
                        {activeWorkout.name}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-950/20 text-slate-950 font-mono">
                        {elapsed}
                    </span>
                </div>
            </div>

            <div className="flex items-center space-x-1 text-xs font-bold shrink-0 pl-2">
                {isCurrentActiveTab ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-950/20 text-slate-950 font-bold uppercase tracking-wider text-[10px]">
                        In Progress
                    </span>
                ) : (
                    <>
                        <span>Resume</span>
                        <ChevronRight className="w-4 h-4 stroke-[3]" />
                    </>
                )}
            </div>
        </div>
    );
};

