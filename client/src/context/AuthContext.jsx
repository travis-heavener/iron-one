/******************************************************************************
 * Authentication Context Provider
 * Manages user session state, token persistence, and active workout awareness
 ******************************************************************************/

import React, { createContext, useContext, useEffect, useState } from "react";

import { authApi, getToken, removeToken, setToken, userApi, workoutApi } from "../api/client.js";

const AuthContext = createContext( null );

// Used to provide global authentication and active session context
export const AuthProvider = ({ children }) => {
    const [ user, setUser ] = useState( null );
    const [ token, setTokenState ] = useState( getToken() );
    const [ loading, setLoading ] = useState( true );
    const [ activeWorkout, setActiveWorkout ] = useState( null );

    // Used to refresh active gym workout session state
    const refreshActiveWorkout = async () => {
        if ( !getToken() ) {
            setActiveWorkout( null );
            return null;
        }

        try {
            const active = await workoutApi.getActiveWorkout();
            setActiveWorkout( active );
            return active;
        } catch ( err ) {
            console.error( "[AuthContext] Failed to fetch active workout:", err );
            return null;
        }
    };

    // Used to refresh user profile data from backend
    const refreshProfile = async () => {
        if ( !getToken() ) {
            setUser( null );
            setLoading( false );
            return null;
        }

        try {
            const profile = await userApi.getProfile();
            setUser( profile );
            await refreshActiveWorkout();
            return profile;
        } catch ( err ) {
            console.warn( "[AuthContext] Stored session invalid or expired:", err.message );
            removeToken();
            setTokenState( null );
            setUser( null );
            setActiveWorkout( null );
            return null;
        } finally {
            setLoading( false );
        }
    };

    // Verify session on initial app mount and listen for token expiry / multi-device updates
    useEffect( () => {
        refreshProfile();

        const handleUnauthorized = () => {
            setUser( null );
            setTokenState( null );
            setActiveWorkout( null );
        };

        // Sync active workout when device unlocks or user switches back to tab
        const handleSync = () => {
            if ( document.visibilityState === "visible" && getToken() ) {
                refreshActiveWorkout();
            }
        };

        // Periodic heartbeat poll (every 10s while tab is visible) for multi-device sync
        const pollInterval = setInterval( () => {
            if ( document.visibilityState === "visible" && getToken() ) {
                refreshActiveWorkout();
            }
        }, 10000 );

        window.addEventListener( "ironone:unauthorized", handleUnauthorized );
        window.addEventListener( "focus", handleSync );
        document.addEventListener( "visibilitychange", handleSync );

        return () => {
            clearInterval( pollInterval );
            window.removeEventListener( "ironone:unauthorized", handleUnauthorized );
            window.removeEventListener( "focus", handleSync );
            document.removeEventListener( "visibilitychange", handleSync );
        };
    }, [] );

    // Used to log in user w/ credentials
    const login = async ( username, password ) => {
        const result = await authApi.login({ username, password });
        setToken( result.token );
        setTokenState( result.token );
        setUser( result.user );
        await refreshActiveWorkout();
        return result.user;
    };

    // Used to register new account
    const register = async ( username, password ) => {
        const result = await authApi.register({ username, password });
        setToken( result.token );
        setTokenState( result.token );
        setUser( result.user );
        await refreshActiveWorkout();
        return result.user;
    };

    // Used to end session and clear tokens
    const logout = () => {
        removeToken();
        setTokenState( null );
        setUser( null );
        setActiveWorkout( null );
    };

    const value = {
        activeWorkout,
        isAuthenticated: Boolean( token && user ),
        loading,
        login,
        logout,
        refreshActiveWorkout,
        refreshProfile,
        register,
        setActiveWorkout,
        token,
        user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Returns authentication context instance
export const useAuth = () => {
    const context = useContext( AuthContext );
    if ( !context ) {
        throw new Error( "useAuth must be used within an AuthProvider" );
    }
    return context;
};

export default AuthContext;

