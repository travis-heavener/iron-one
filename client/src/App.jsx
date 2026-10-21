/******************************************************************************
 * App Root Component
 * Controls authentication routing, main layout switching, and global shell
 ******************************************************************************/

import { Dumbbell, Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Layout } from "./components/Layout.jsx";
import { OnboardingModal } from "./components/OnboardingModal.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ModalProvider } from "./context/ModalContext.jsx";
import { ActiveWorkoutPage } from "./pages/ActiveWorkoutPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ExercisesPage } from "./pages/ExercisesPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { RoutinesPage } from "./pages/RoutinesPage.jsx";

const VALID_TABS = new Set([
    "active",
    "dashboard",
    "exercises",
    "history",
    "profile",
    "routines"
]);

// Returns normalized tab identifier from browser URL pathname
const getTabFromLocation = () => {
    if ( typeof window === "undefined" ) return "dashboard";
    const segment = window.location.pathname.replace( /^\/+/, "" );
    return VALID_TABS.has( segment ) ? segment : "dashboard";
};

// Used to render authenticated workspace or login/register flows
const AppContent = () => {
    const { isAuthenticated, loading, refreshActiveWorkout, user } = useAuth();
    const [ authMode, setAuthMode ] = useState( "login" );
    const [ activeTab, setActiveTab ] = useState( getTabFromLocation );
    const [ isOnboardingOpen, setIsOnboardingOpen ] = useState( false );

    // Check if user hasn't seen the introduction walkthrough
    useEffect( () => {
        if ( isAuthenticated && user?.id ) {
            const hasSeen = localStorage.getItem( `ironone_onboarding_seen_${user.id}` );
            if ( !hasSeen ) {
                setIsOnboardingOpen( true );
            }
        }
    }, [ isAuthenticated, user?.id ] );

    const handleCloseOnboarding = () => {
        if ( user?.id ) {
            localStorage.setItem( `ironone_onboarding_seen_${user.id}`, "true" );
        }
        setIsOnboardingOpen( false );
    };

    const handleOpenOnboarding = () => {
        setIsOnboardingOpen( true );
    };

    // Synchronize active tab w/ browser history (supports Back/Forward buttons)
    const handleSelectTab = ( newTab, push = true ) => {
        if ( !VALID_TABS.has( newTab ) ) return;
        setActiveTab( newTab );

        // Opportunistically sync active gym session on navigation
        if ( isAuthenticated ) {
            refreshActiveWorkout();
        }

        const targetPath = newTab === "dashboard" ? "/" : `/${newTab}`;
        if ( push && window.location.pathname !== targetPath ) {
            window.history.pushState( { tab: newTab }, "", targetPath );
        }
    };

    // Listen to popstate event for browser back and mouse navigation
    useEffect( () => {
        const handlePopState = ( e ) => {
            const stateTab = e.state?.tab;
            if ( stateTab && VALID_TABS.has( stateTab ) ) {
                setActiveTab( stateTab );
            } else {
                setActiveTab( getTabFromLocation() );
            }
        };

        window.addEventListener( "popstate", handlePopState );

        // Normalize initial URL state
        const initialTab = getTabFromLocation();
        window.history.replaceState( { tab: initialTab }, "", initialTab === "dashboard" ? "/" : `/${initialTab}` );

        return () => window.removeEventListener( "popstate", handlePopState );
    }, [] );

    // Initial session verification loader
    if ( loading ) {
        return (
            <div className="h-full min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-pulse">
                    <Dumbbell className="w-8 h-8 text-slate-950 stroke-[2.5]" />
                </div>
                <div className="flex items-center space-x-2 text-slate-400 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Connecting to IronOne...</span>
                </div>
            </div>
        );
    }

    // Unauthenticated authentication gateway
    if ( !isAuthenticated ) {
        if ( authMode === "register" ) {
            return <RegisterPage onSwitchToLogin={() => setAuthMode( "login" )} />;
        }
        return <LoginPage onSwitchToRegister={() => setAuthMode( "register" )} />;
    }

    // Authenticated application layout
    return (
        <>
            <Layout activeTab={activeTab} onSelectTab={handleSelectTab}>
                {activeTab === "dashboard" && (
                    <DashboardPage onNavigate={handleSelectTab} onOpenTour={handleOpenOnboarding} />
                )}
                {activeTab === "routines" && <RoutinesPage onNavigate={handleSelectTab} />}
                {activeTab === "active" && <ActiveWorkoutPage onNavigate={handleSelectTab} />}
                {activeTab === "history" && <HistoryPage onNavigate={handleSelectTab} />}
                {activeTab === "exercises" && <ExercisesPage onNavigate={handleSelectTab} />}
                {activeTab === "profile" && (
                    <ProfilePage onNavigate={handleSelectTab} onOpenTour={handleOpenOnboarding} />
                )}
            </Layout>

            <OnboardingModal isOpen={isOnboardingOpen} onClose={handleCloseOnboarding} />
        </>
    );
};

// Root provider wrapper
export const App = () => {
    return (
        <AuthProvider>
            <ModalProvider>
                <AppContent />
            </ModalProvider>
        </AuthProvider>
    );
};

export default App;

