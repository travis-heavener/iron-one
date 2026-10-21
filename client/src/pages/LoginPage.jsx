/******************************************************************************
 * Login Page Component
 * Clean, lightweight authentication view w/ error alerts and password toggle
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

// Used to render login authentication screen
export const LoginPage = ({ onSwitchToRegister }) => {
    const { login } = useAuth();

    const [ username, setUsername ] = useState( "" );
    const [ password, setPassword ] = useState( "" );
    const [ showPassword, setShowPassword ] = useState( false );
    const [ loading, setLoading ] = useState( false );
    const [ error, setError ] = useState( "" );

    const handleSubmit = async ( e ) => {
        e.preventDefault();
        setError( "" );

        if ( !username.trim() || !password ) {
            setError( "Please enter both username and password" );
            return;
        }

        setLoading( true );
        try {
            await login( username.trim(), password );
        } catch ( err ) {
            setError( err.message || "Failed to log in" );
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
                    IronOne
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                    Frictionless workout tracking for progressive overload
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

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={( e ) => setUsername( e.target.value )}
                                placeholder="e.g. travis"
                                autoCapitalize="none"
                                autoComplete="username"
                                autoFocus
                                required
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-base"
                            />
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
                                    placeholder="••••••••"
                                    autoComplete="current-password"
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <span>Sign In</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
                        <p className="text-sm text-slate-400">
                            Don't have an account yet?{" "}
                            <button
                                type="button"
                                onClick={onSwitchToRegister}
                                className="font-semibold text-emerald-400 hover:text-emerald-300 transition ml-1 cursor-pointer"
                            >
                                Register now
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

