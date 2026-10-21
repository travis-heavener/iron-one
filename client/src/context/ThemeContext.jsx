/******************************************************************************
 * Theme Context & Global Palette Manager
 * Provides global gym theme selection, AMOLED OLED modes, and persistent storage
 ******************************************************************************/

import React, { createContext, useContext, useEffect, useState } from "react";

export const AVAILABLE_THEMES = [
    {
        id: "emerald",
        name: "Iron Emerald",
        description: "Deep slate & gym emerald",
        backgroundHex: "#090d16",
        accentHex: "#10b981",
        badge: "Default"
    },
    {
        id: "oled",
        name: "OLED Stealth",
        description: "Pitch black & gym emerald",
        backgroundHex: "#000000",
        accentHex: "#10b981",
        badge: "AMOLED"
    },
    {
        id: "crimson",
        name: "Crimson Forge",
        description: "Deep slate & crimson red",
        backgroundHex: "#090d16",
        accentHex: "#f43f5e"
    },
    {
        id: "oled-crimson",
        name: "OLED Crimson",
        description: "Pitch black & crimson red",
        backgroundHex: "#000000",
        accentHex: "#f43f5e",
        badge: "AMOLED"
    },
    {
        id: "cobalt",
        name: "Electric Cobalt",
        description: "Deep slate & oceanic blue",
        backgroundHex: "#090d16",
        accentHex: "#0ea5e9"
    },
    {
        id: "oled-cobalt",
        name: "OLED Cobalt",
        description: "Pitch black & oceanic blue",
        backgroundHex: "#000000",
        accentHex: "#0ea5e9",
        badge: "AMOLED"
    },
    {
        id: "violet",
        name: "Cyber Violet",
        description: "Deep slate & synth purple",
        backgroundHex: "#090d16",
        accentHex: "#a855f7"
    },
    {
        id: "amber",
        name: "Amber Volt",
        description: "Deep slate & gold volt",
        backgroundHex: "#090d16",
        accentHex: "#f59e0b"
    }
];

const THEME_STORAGE_KEY = "ironone_theme";
const DEFAULT_THEME = "emerald";

const ThemeContext = createContext( null );

// Used to apply theme attribute to root document element and mobile meta status bar
const applyThemeToDOM = ( themeId ) => {
    if ( typeof document === "undefined" ) return;

    if ( themeId === DEFAULT_THEME ) {
        document.documentElement.removeAttribute( "data-theme" );
    } else {
        document.documentElement.setAttribute( "data-theme", themeId );
    }

    const isOled = themeId.startsWith( "oled" );
    const metaThemeColor = document.querySelector( "meta[name=\"theme-color\"]" );
    if ( metaThemeColor ) {
        metaThemeColor.setAttribute( "content", isOled ? "#000000" : "#090d16" );
    }
};

// Used to wrap application w/ global theme selection and persistence
export const ThemeProvider = ({ children }) => {
    const [ theme, setThemeState ] = useState( () => {
        if ( typeof window === "undefined" ) return DEFAULT_THEME;
        try {
            const saved = localStorage.getItem( THEME_STORAGE_KEY );
            const isValid = AVAILABLE_THEMES.some( ( t ) => t.id === saved );
            return isValid ? saved : DEFAULT_THEME;
        } catch {
            return DEFAULT_THEME;
        }
    });

    useEffect( () => {
        applyThemeToDOM( theme );
    }, [ theme ] );

    const setTheme = ( newThemeId ) => {
        const isValid = AVAILABLE_THEMES.some( ( t ) => t.id === newThemeId );
        const effectiveTheme = isValid ? newThemeId : DEFAULT_THEME;

        try {
            localStorage.setItem( THEME_STORAGE_KEY, effectiveTheme );
        } catch ( err ) {
            console.warn( "[Theme] Failed to persist theme to localStorage:", err.message );
        }

        setThemeState( effectiveTheme );
        applyThemeToDOM( effectiveTheme );
    };

    return (
        <ThemeContext.Provider
            value={{
                availableThemes: AVAILABLE_THEMES,
                setTheme,
                theme
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};

// Returns global theme context hook
export const useTheme = () => {
    const context = useContext( ThemeContext );
    if ( !context ) {
        throw new Error( "useTheme must be used within a ThemeProvider" );
    }
    return context;
};

