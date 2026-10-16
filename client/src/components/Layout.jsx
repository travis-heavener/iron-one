/******************************************************************************
 * App Layout Shell Component
 * Encapsulates global top header, banner notifications, and bottom mobile navigation
 ******************************************************************************/

import React from "react";

import { useAuth } from "../context/AuthContext.jsx";
import { ActiveWorkoutBanner } from "./ActiveWorkoutBanner.jsx";
import { Navigation } from "./Navigation.jsx";

// Used to wrap authenticated views w/ persistent headers and navbars
export const Layout = ({ activeTab, children, onSelectTab }) => {
    const { activeWorkout } = useAuth();

    return (
        <div className="h-full h-[100dvh] bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
            <Navigation activeTab={activeTab} onSelectTab={onSelectTab} />

            {/* Persistent session banner across all screens while workout is in progress */}
            {activeWorkout && (
                <div className="shrink-0 z-30">
                    <ActiveWorkoutBanner activeTab={activeTab} onResume={() => onSelectTab( "active" )} />
                </div>
            )}

            {/* Main view container w/ isolated smooth scrolling */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-28 md:pb-12 overflow-y-auto overscroll-contain">
                {children}
            </main>
        </div>
    );
};

