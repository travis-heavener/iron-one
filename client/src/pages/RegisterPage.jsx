/******************************************************************************
 * Register Page Component
 * Clean onboarding view w/ client-side validation and password confirmation
 ******************************************************************************/

import {
    AlertCircle,
    Dumbbell,
    Eye,
    EyeOff,
    Loader2
} from "lucide-react";
import React, { useState } from "react";

import { useAuth } from "../context/AuthContext.jsx";

// Used to render registration screen
export const RegisterPage = ({ onSwitchToLogin }) => {
    const { register } = useAuth();

    const [ username, setUsername ] = useState( "" );
    const [ password, setPassword ] = useState( "" );
    const [ confirmPassword, setConfirmPassword ] = useState( "" );
    const [ showPassword, setShowPassword ] = useState( false );
    const [ loading, setLoading ] = useState( false );
    const [ error, setError ] = useState( "" );

    const handleSubmit = async ( e ) => {
        e.preventDefault();
        setError( "" );

        const cleanUsername = username.trim();

        if ( cleanUsername.length < 3 || cleanUsername.length > 30 ) {
            setError( "Username must be between 3 and 30 characters" );
            return;
        }

        if ( !/^[a-zA-Z0-9_]+$/.test( cleanUsername ) ) {
            setError( "Username can only contain alphanumeric characters and underscores" );
            return;
        }

        if ( password.length < 8 ) {
            setError( "Password must be at least 8 characters long" );
            return;
        }

        if ( password !== confirmPassword ) {
            setError( "Passwords do not match" );
            return;
        }

        setLoading( true );
        try {
            await register( cleanUsername, password );
        } catch ( err ) {
            setError( err.message || "Failed to register account" );
        } finally {
            setLoading( false );
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-950 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 shadow-xl shadow-emerald-500/20 mb-4">
                    <Dumbbell className="w-9 h-9 text-slate-950 stroke-[2.5]" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
                    Join IronOne
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                    Create your account to start tracking progressive overload
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                    {error && (
                        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-sm animate-shake">
                            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                            <span className="flex-1 font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={( e ) => setUsername( e.target.value )}
                                placeholder="Choose a username"
                                autoCapitalize="none"
                                autoComplete="username"
                                autoFocus
                                required
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-base"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">
                                3-30 characters, letters, numbers, and underscores only
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={( e ) => setPassword( e.target.value )}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    required
                                    className="w-full px-4 py-3.5 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-base"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword( !showPassword )}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={( e ) => setConfirmPassword( e.target.value )}
                                placeholder="Repeat your password"
                                autoComplete="new-password"
                                required
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-base"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
                        <p className="text-sm text-slate-400">
                            Already have an account?{" "}
                            <button
                                type="button"
                                onClick={onSwitchToLogin}
                                className="font-semibold text-emerald-400 hover:text-emerald-300 transition ml-1 cursor-pointer"
                            >
                                Sign in
                            </button>
                        </p>
                    </div>
                </div>

                {/* Application Version & Copyright Footer */}
                <div className="text-center text-[11px] text-slate-600 font-medium select-none">
                    <p>© 2026 IronOne • v0.4.0</p>
                </div>
            </div>
        </div>
    );
};

