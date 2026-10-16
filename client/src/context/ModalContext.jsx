/******************************************************************************
 * Modal Context & Custom Dialog Provider
 * Replaces native window.confirm and alert with accessible dark-themed modals
 ******************************************************************************/

import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    Trash2,
    X
} from "lucide-react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ModalContext = createContext( null );

// Used to provide global custom confirmation and alert dialogs
export const ModalProvider = ({ children }) => {
    const [ modalState, setModalState ] = useState({
        isOpen: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        variant: "primary", // Options: "primary" | "danger" | "warning" | "info"
        resolve: null
    });

    // Lock body scroll while modal dialog is visible
    useEffect( () => {
        if ( modalState.isOpen ) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [ modalState.isOpen ] );

    // Close on Escape key
    useEffect( () => {
        const handleKeyDown = ( e ) => {
            if ( modalState.isOpen && e.key === "Escape" ) {
                handleCancel();
            }
        };

        window.addEventListener( "keydown", handleKeyDown );
        return () => window.removeEventListener( "keydown", handleKeyDown );
    }, [ modalState.isOpen ] );

    const handleConfirm = () => {
        if ( modalState.resolve ) {
            modalState.resolve( true );
        }
        setModalState( ( prev ) => ({ ...prev, isOpen: false }) );
    };

    const handleCancel = () => {
        if ( modalState.resolve ) {
            modalState.resolve( false );
        }
        setModalState( ( prev ) => ({ ...prev, isOpen: false }) );
    };

    // Imperative confirm dialog returning Promise<boolean>
    const confirm = ({
        title = "Are you sure?",
        message = "",
        confirmText = "Confirm",
        cancelText = "Cancel",
        variant = "primary",
        destructive = false
    }) => {
        const resolvedVariant = destructive ? "danger" : variant;
        return new Promise( ( resolve ) => {
            setModalState({
                isOpen: true,
                title,
                message,
                confirmText,
                cancelText,
                variant: resolvedVariant,
                resolve
            });
        });
    };

    // Imperative alert dialog returning Promise<void>
    const showAlert = ({
        title = "Notice",
        message = "",
        confirmText = "OK",
        variant = "primary"
    }) => {
        return new Promise( ( resolve ) => {
            setModalState({
                isOpen: true,
                title,
                message,
                confirmText,
                cancelText: null, // No cancel button in alert mode
                variant,
                resolve
            });
        });
    };

    return (
        <ModalContext.Provider value={{ confirm, alert: showAlert }}>
            {children}

            {modalState.isOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={( e ) => {
                        if ( e.target === e.currentTarget ) handleCancel();
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150"
                    >
                        {/* Status Icon */}
                        <div className="mx-auto flex items-center justify-center">
                            {modalState.variant === "danger" ? (
                                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 stroke-[2]" />
                                </div>
                            ) : modalState.variant === "warning" ? (
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 stroke-[2]" />
                                </div>
                            ) : modalState.variant === "info" ? (
                                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                                    <Info className="w-6 h-6 stroke-[2]" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 stroke-[2]" />
                                </div>
                            )}
                        </div>

                        {/* Text Content */}
                        <div className="space-y-1.5">
                            <h3 className="text-lg font-bold text-white tracking-tight">
                                {modalState.title}
                            </h3>
                            {modalState.message && (
                                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                                    {modalState.message}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className={`pt-2 flex items-center gap-3 ${modalState.cancelText ? "grid grid-cols-2" : ""}`}>
                            {modalState.cancelText && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer"
                                >
                                    {modalState.cancelText}
                                </button>
                            )}
                            <button
                                type="button"
                                autoFocus
                                onClick={handleConfirm}
                                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition active:scale-95 shadow-lg cursor-pointer ${
                                    modalState.variant === "danger"
                                        ? "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20"
                                        : modalState.variant === "warning"
                                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                                }`}
                            >
                                {modalState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </ModalContext.Provider>
    );
};

// Custom hook to access confirmation and alert dialogs
export const useModal = () => {
    const context = useContext( ModalContext );
    if ( !context ) {
        throw new Error( "useModal must be used within a ModalProvider" );
    }
    return context;
};
