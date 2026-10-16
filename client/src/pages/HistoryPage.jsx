/******************************************************************************
 * History & Calendar Page Component
 * Placeholder view for calendar grid and journal feed (Sub-Phase 6D)
 ******************************************************************************/

import { Calendar } from "lucide-react";
import React from "react";

// Used to render calendar workout view and journal timeline
export const HistoryPage = ({ onNavigate }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Workout History
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Interactive calendar and chronological journal feed
                    </p>
                </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <Calendar className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-bold text-white">Calendar & Journal Feed</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Visual monthly calendar grid, multi-entry daily badges, and progressive overload cloning will be built in Sub-Phase 6D
                </p>
            </div>
        </div>
    );
};

