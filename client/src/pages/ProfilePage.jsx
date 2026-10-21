/******************************************************************************
 * Profile Page Component
 * Handles user profile attributes, unit preferences, avatar upload, and logout
 ******************************************************************************/

import {
    Camera,
    Check,
    Loader2,
    LogOut,
    Shield,
    Sparkles
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { userApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

// Used to render profile management and settings
export const ProfilePage = ({ onOpenTour }) => {
    const { logout, refreshProfile, user } = useAuth();
    const fileInputRef = useRef( null );

    const [ height, setHeight ] = useState( user?.height ?? "" );
    const [ weight, setWeight ] = useState( user?.weight ?? "" );
    const [ unitPreference, setUnitPreference ] = useState( user?.unitPreference || "imperial" );
    const [ saving, setSaving ] = useState( false );
    const [ uploading, setUploading ] = useState( false );
    const [ successMsg, setSuccessMsg ] = useState( "" );
    const [ errorMsg, setErrorMsg ] = useState( "" );

    // Keep form fields synchronized w/ user context updates
    useEffect( () => {
        if ( user ) {
            setHeight( user.height ?? "" );
            setWeight( user.weight ?? "" );
            setUnitPreference( user.unitPreference || "imperial" );
        }
    }, [ user ] );

    // Format converted metric/imperial value rounded to 1 decimal place with zero truncated
    const formatConverted = ( val ) => {
        if ( val === "" || val === null || val === undefined ) return "";
        const num = Number( val );
        if ( isNaN( num ) ) return "";
        return String( Math.round( num * 10 ) / 10 );
    };

    // Handle unit toggle with automatic bodyweight and height numeric conversion
    const handleUnitSwitch = ( newUnit ) => {
        if ( newUnit === unitPreference ) return;

        if ( newUnit === "metric" ) {
            if ( weight !== "" && !isNaN( Number( weight ) ) ) {
                setWeight( formatConverted( Number( weight ) * 0.45359237 ) );
            }
            if ( height !== "" && !isNaN( Number( height ) ) ) {
                setHeight( formatConverted( Number( height ) * 2.54 ) );
            }
        } else {
            if ( weight !== "" && !isNaN( Number( weight ) ) ) {
                setWeight( formatConverted( Number( weight ) / 0.45359237 ) );
            }
            if ( height !== "" && !isNaN( Number( height ) ) ) {
                setHeight( formatConverted( Number( height ) / 2.54 ) );
            }
        }

        setUnitPreference( newUnit );
    };

    const handleSaveProfile = async ( e ) => {
        e.preventDefault();
        setSaving( true );
        setSuccessMsg( "" );
        setErrorMsg( "" );

        try {
            await userApi.updateProfile({
                height: height === "" ? null : Number( height ),
                weight: weight === "" ? null : Number( weight ),
                unitPreference
            });
            await refreshProfile();
            setSuccessMsg( "Profile updated successfully" );
            setTimeout( () => setSuccessMsg( "" ), 3000 );
        } catch ( err ) {
            setErrorMsg( err.message || "Failed to update profile" );
        } finally {
            setSaving( false );
        }
    };

    const handleAvatarSelect = async ( e ) => {
        const file = e.target.files?.[0];
        if ( !file ) return;

        setUploading( true );
        setErrorMsg( "" );
        setSuccessMsg( "" );

        const formData = new FormData();
        formData.append( "avatar", file );

        try {
            await userApi.uploadAvatar( formData );
            await refreshProfile();
            setSuccessMsg( "Avatar uploaded successfully" );
            setTimeout( () => setSuccessMsg( "" ), 3000 );
        } catch ( err ) {
            setErrorMsg( err.message || "Failed to upload avatar" );
        } finally {
            setUploading( false );
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    User Profile
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                    Manage your body metrics, display units, and avatar
                </p>
            </div>

            {successMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center space-x-2">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <span>{successMsg}</span>
                </div>
            )}

            {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center space-x-2">
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Avatar & Header Card */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center space-x-5">
                <div className="relative group">
                    {user?.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt="Profile"
                            className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-800 group-hover:ring-emerald-500/50 transition"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-400 text-2xl font-bold flex items-center justify-center ring-4 ring-slate-800">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-md transition active:scale-90"
                    >
                        {uploading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                        )}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarSelect}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{user?.username}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Member since {new Date( user?.createdAt || Date.now() ).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Shield className="w-3 h-3" />
                            <span>Argon2id Secured</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Metrics & Unit Preference Form */}
            <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                    Body Metrics & Preferences
                </h3>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                        Unit System Preference
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => handleUnitSwitch( "imperial" )}
                            className={`py-3 px-4 rounded-xl text-sm font-bold border transition ${
                                unitPreference === "imperial"
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                            }`}
                        >
                            Imperial (lbs, in)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleUnitSwitch( "metric" )}
                            className={`py-3 px-4 rounded-xl text-sm font-bold border transition ${
                                unitPreference === "metric"
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/50 shadow-md shadow-emerald-500/10"
                                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                            }`}
                        >
                            Metric (kg, cm)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                            Bodyweight ({unitPreference === "metric" ? "kg" : "lbs"})
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={weight}
                            onChange={( e ) => setWeight( e.target.value )}
                            placeholder={unitPreference === "metric" ? "e.g. 80.5" : "e.g. 175.5"}
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                            Height ({unitPreference === "metric" ? "cm" : "inches"})
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={height}
                            onChange={( e ) => setHeight( e.target.value )}
                            placeholder={unitPreference === "metric" ? "e.g. 180" : "e.g. 70"}
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving Changes...</span>
                        </>
                    ) : (
                        <span>Save Profile Changes</span>
                    )}
                </button>
            </form>

            {/* App Tour & Feature Walkthrough */}
            {onOpenTour && (
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span>Introduction & Feature Tour</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Review core features: progressive overload, tactile logging, routines, and offline resilience.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenTour}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition shrink-0 cursor-pointer"
                    >
                        Replay Tour
                    </button>
                </div>
            )}

            {/* Logout Action */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80">
                <button
                    type="button"
                    onClick={logout}
                    className="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-sm transition flex items-center justify-center space-x-2 active:scale-[0.98]"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of IronOne</span>
                </button>
            </div>
        </div>
    );
};

