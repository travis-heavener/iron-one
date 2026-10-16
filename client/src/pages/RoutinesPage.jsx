/******************************************************************************
 * Routines Page Component
 * Placeholder view for routine split template management (Sub-Phase 6B)
 ******************************************************************************/

import { Layers } from "lucide-react";
import React from "react";

// Used to render routine templates list and editor
export const RoutinesPage = ({ onNavigate }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        Workout Routines
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Create, copy, and manage reusable workout blueprints
                    </p>
                </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
                    <Layers className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-lg font-bold text-white">Routine Blueprint Manager</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Full routine template manager and visual editor will be built in Sub-Phase 6B
                </p>
            </div>
        </div>
    );
};

