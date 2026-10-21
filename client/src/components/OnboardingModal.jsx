/******************************************************************************
 * Onboarding Modal Component
 * Interactive introduction walkthrough covering core workout tracking features
 ******************************************************************************/

import {
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    Flame,
    Layers,
    ShieldCheck,
    Sparkles,
    X
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Standard walkthrough slides detailing IronOne capabilities
const ONBOARDING_SLIDES = [
    {
        id: "welcome",
        badge: "Welcome to IronOne",
        title: "Frictionless Progressive Overload",
        subtitle: "A self-hosted, mobile-first workout tracking companion engineered for high-density gym training.",
        icon: Dumbbell,
        accentColor: "from-emerald-500 to-teal-400",
        iconColor: "text-slate-950",
        highlights: [
            {
                title: "100% Self-Hosted & Private",
                desc: "No subscriptions, third-party cloud sync, or paywalls. Your lifting history stays completely yours."
            },
            {
                title: "Optimized for the Gym Floor",
                desc: "Large thumb targets, micro-step load chips, and rapid 1-tap set completion between work sets."
            },
            {
                title: "Tailscale Ready",
                desc: "Secure private access from anywhere—phone, tablet, or desktop—through your private Tailnet."
            }
        ]
    },
    {
        id: "logging",
        badge: "Live Gym Floor UX",
        title: "Tactile Set Logging",
        subtitle: "Designed to eliminate tracking friction so you can focus 100% of your energy on lifting.",
        icon: Flame,
        accentColor: "from-amber-500 to-orange-400",
        iconColor: "text-slate-950",
        highlights: [
            {
                title: "Tactile Stepper Counters",
                desc: "Quickly adjust weight (+5lb, +2.5lb), reps (+1, -1), or hold seconds without opening the keyboard."
            },
            {
                title: "1-Tap Set Cycling",
                desc: "Tap any set number badge (1, 2, 3) to cycle it through Normal, Warmup (W), Drop Set (D), and Failure (F)."
            },
            {
                title: "Dockable Rest Timer",
                desc: "Auto-starts upon completing a set, featuring customizable chime alerts and screen wake-lock."
            }
        ]
    },
    {
        id: "routines",
        badge: "Templates & Modalities",
        title: "Routines vs. Daily Logs",
        subtitle: "Train with systematic structured splits or log spontaneous freeform gym sessions.",
        icon: Layers,
        accentColor: "from-indigo-500 to-sky-400",
        iconColor: "text-slate-950",
        highlights: [
            {
                title: "Reusable Blueprints",
                desc: "Build Push, Pull, Legs templates with target sets and reps. Editing templates never alters past logs."
            },
            {
                title: "Multi-Modal Movements",
                desc: "Track standard Weight × Reps, static Time Duration holds (planks), or Cardio distance & pace."
            },
            {
                title: "Live Hot-Swapping (⇄)",
                desc: "Equipment occupied? Tap the ⇄ swap icon on any exercise card to replace the movement mid-workout while keeping logged sets."
            }
        ]
    },
    {
        id: "overload",
        badge: "Progressive Overload",
        title: "Match & Beat Your Baselines",
        subtitle: "Systematic progressive overload made seamless through 1-tap historical session cloning.",
        icon: Calendar,
        accentColor: "from-emerald-500 to-teal-400",
        iconColor: "text-slate-950",
        highlights: [
            {
                title: "1-Tap 'Clone to Today'",
                desc: "Replicate any past workout with previous weights and reps carried over as uncompleted targets."
            },
            {
                title: "Monthly Calendar Grid",
                desc: "Visual split badges and calendar view for consistency tracking at a glance."
            },
            {
                title: "Chronological Journal",
                desc: "Search, filter, and review volume, sets, and notes across all your historical sessions."
            }
        ]
    },
    {
        id: "resilience",
        badge: "Zero Data Loss",
        title: "Offline Shield & Backups",
        subtitle: "Built to survive basement gyms, dropped Wi-Fi, and spotty cellular networks.",
        icon: ShieldCheck,
        accentColor: "from-emerald-500 to-teal-400",
        iconColor: "text-slate-950",
        highlights: [
            {
                title: "Client-Side Offline Shield",
                desc: "In-progress workouts and sets are preserved locally in browser storage during connection drops."
            },
            {
                title: "Automated Online Backups",
                desc: "Built-in WAL database snapshot tool creates non-blocking SQLite backups with 14-day rotation."
            },
            {
                title: "Multi-Device Polling",
                desc: "Background heartbeats keep gym-floor phones and desktop review screens synchronized."
            }
        ]
    }
];

// Used to render multi-slide onboarding tour dialog
export const OnboardingModal = ({ isOpen, onClose }) => {
    const [ currentSlide, setCurrentSlide ] = useState( 0 );

    // Lock body scroll while modal is visible
    useEffect( () => {
        if ( isOpen ) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [ isOpen ] );

    // Keyboard navigation support (Arrow keys and Escape)
    useEffect( () => {
        if ( !isOpen ) return;

        const handleKeyDown = ( e ) => {
            if ( e.key === "Escape" ) {
                onClose();
            } else if ( e.key === "ArrowRight" ) {
                setCurrentSlide( ( prev ) => Math.min( prev + 1, ONBOARDING_SLIDES.length - 1 ) );
            } else if ( e.key === "ArrowLeft" ) {
                setCurrentSlide( ( prev ) => Math.max( prev - 1, 0 ) );
            }
        };

        window.addEventListener( "keydown", handleKeyDown );
        return () => window.removeEventListener( "keydown", handleKeyDown );
    }, [ isOpen, onClose ] );

    if ( !isOpen ) return null;

    const slide = ONBOARDING_SLIDES[currentSlide];
    const SlideIcon = slide.icon;
    const isFirstSlide = currentSlide === 0;
    const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1;

    const handleNext = () => {
        if ( isLastSlide ) {
            onClose();
        } else {
            setCurrentSlide( ( prev ) => prev + 1 );
        }
    };

    const handlePrev = () => {
        if ( !isFirstSlide ) {
            setCurrentSlide( ( prev ) => prev - 1 );
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header: Step Pill & Close */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>{slide.badge}</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                            {currentSlide + 1} of {ONBOARDING_SLIDES.length}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center space-x-1"
                        aria-label="Skip tour"
                    >
                        <span>Skip</span>
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Hero Graphic & Slide Header */}
                <div className="shrink-0 space-y-3">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${slide.accentColor} flex items-center justify-center shadow-lg shadow-emerald-500/20`}>
                        <SlideIcon className={`w-7 h-7 ${slide.iconColor} stroke-[2.5]`} />
                    </div>

                    <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                            {slide.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                            {slide.subtitle}
                        </p>
                    </div>
                </div>

                {/* Highlights List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {slide.highlights.map( ( item, idx ) => (
                        <div
                            key={idx}
                            className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-start space-x-3 transition hover:border-slate-700"
                        >
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/30">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-white leading-snug">
                                    {item.title}
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    ) )}
                </div>

                {/* Footer Controls: Dots & Navigation Buttons */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between shrink-0 gap-3">
                    {/* Slide Dots Indicator */}
                    <div className="flex items-center space-x-1.5">
                        {ONBOARDING_SLIDES.map( ( _, idx ) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setCurrentSlide( idx )}
                                className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                                    currentSlide === idx
                                        ? "w-6 bg-emerald-400"
                                        : "w-2 bg-slate-800 hover:bg-slate-700"
                                }`}
                                aria-label={`Go to slide ${idx + 1}`}
                            />
                        ) )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        {!isFirstSlide && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Back</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center space-x-1.5 active:scale-95"
                        >
                            <span>{isLastSlide ? "Get Started" : "Next"}</span>
                            {isLastSlide ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

