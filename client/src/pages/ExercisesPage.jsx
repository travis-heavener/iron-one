/******************************************************************************
 * Exercises Page Component
 * Placeholder view for master exercise catalog and custom creation (Sub-Phase 6B)
 ******************************************************************************/

import { Dumbbell } from "lucide-react";
import React from "react";

// Used to render exercise catalog browser
export const ExercisesPage = ({ onNavigate }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Exercise Catalog
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Browse 55+ master movements across muscle groups and modalities
                    </p>
                </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <Dumbbell className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-bold text-white">Exercise Library Browser</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Search, muscle category filters, and custom exercise creation modal will be built in Sub-Phase 6B
                </p>
            </div>
        </div>
    );
};

