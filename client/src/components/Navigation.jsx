/******************************************************************************
 * Navigation Component
 * Responsive mobile bottom navigation bar and desktop header
 ******************************************************************************/

import {
    Calendar,
    Dumbbell,
    Flame,
    Layers,
    Play
} from "lucide-react";
import React from "react";

import { useAuth } from "../context/AuthContext.jsx";

// Used to render responsive navigation for mobile and desktop
export const Navigation = ({ activeTab, onSelectTab }) => {
    const { activeWorkout, user } = useAuth();

    // Desktop navigation items (all 5 domain views)
    const desktopNavItems = [
        { id: "dashboard", label: "Dashboard", icon: Flame },
        { id: "routines", label: "Routines", icon: Layers },
        { id: "active", label: activeWorkout ? "Live Gym" : "Workout", icon: Play, isAction: true },
        { id: "history", label: "History", icon: Calendar },
        { id: "exercises", label: "Exercises", icon: Dumbbell }
    ];

    // Mobile bottom navigation items (symmetrical 5-slot dock w/ Live Gym dead-center)
    const mobileNavItems = [
        { id: "dashboard", label: "Home", icon: Flame },
        { id: "routines", label: "Routines", icon: Layers },
        { id: "active", label: activeWorkout ? "Live Gym" : "Workout", icon: Play, isAction: true },
        { id: "history", label: "History", icon: Calendar },
        { id: "exercises", label: "Catalog", icon: Dumbbell }
    ];

    return (
        <>
            {/* Desktop Top Navigation Bar */}
            <header className="hidden md:block sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab( "dashboard" )}>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Dumbbell className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                        </div>
                        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                            IronOne
                        </span>
                    </div>

                    <nav className="flex items-center space-x-1">
                        {desktopNavItems.map( ( item ) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            const isLive = item.id === "active" && activeWorkout;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectTab( item.id )}
                                    className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 flex items-center space-x-2 ${
                                        isActive
                                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                            : isLive
                                                ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/30 animate-pulse"
                                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                    {isLive && !isActive && (
                                        <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => onSelectTab( "profile" )}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border transition ${
                                activeTab === "profile"
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                    : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-300"
                            }`}
                        >
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                                    {user?.username?.[0]?.toUpperCase() || "U"}
                                </div>
                            )}
                            <span className="text-xs font-medium">{user?.username}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Top Header (Branding & User Avatar) */}
            <header className="md:hidden shrink-0 sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => onSelectTab( "dashboard" )}>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
                        <Dumbbell className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                    </div>
                    <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
                        IronOne
                    </span>
                </div>

                <button
                    onClick={() => onSelectTab( "profile" )}
                    className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-xl border transition ${
                        activeTab === "profile"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                            : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                    }`}
                >
                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center justify-center">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                        </div>
                    )}
                    <span className="text-xs font-semibold">{user?.username}</span>
                </button>
            </header>

            {/* Mobile Bottom Navigation Bar (Symmetrical 5-Item Dock w/ Live Gym Centered) */}
            <nav className="mobile-nav-dock md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/80 px-2 pb-[calc(var(--safe-area-bottom)+0.65rem)] pt-2 shadow-2xl select-none">
                <div className="grid grid-cols-5 items-center text-center">
                    {mobileNavItems.map( ( item ) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        const isLiveWorkout = item.id === "active" && activeWorkout;

                        if ( item.isAction ) {
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onSelectTab( item.id )}
                                    className="flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-95 w-full group"
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 shadow-md transition ${
                                        isLiveWorkout
                                            ? "bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400/40 animate-pulse"
                                            : isActive
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                                : "bg-slate-800/90 text-slate-300 border border-slate-700/60 group-hover:bg-slate-800"
                                    }`}>
                                        <Icon className="w-4 h-4 fill-current stroke-[2.5]" />
                                    </div>
                                    <span className={`text-[10px] tracking-tight font-semibold ${
                                        isLiveWorkout || isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"
                                    }`}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                onClick={() => onSelectTab( item.id )}
                                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-90 w-full ${
                                    isActive
                                        ? "text-emerald-400 font-semibold"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <div className="w-8 h-8 flex items-center justify-center mb-1">
                                    <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                                </div>
                                <span className="text-[10px] tracking-tight">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

