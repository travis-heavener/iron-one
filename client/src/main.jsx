/******************************************************************************
 * Application Entry Point
 * Mounts React virtual DOM into root element w/ strict mode and styling
 ******************************************************************************/

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

const rootElement = document.getElementById( "root" );

if ( rootElement ) {
    ReactDOM.createRoot( rootElement ).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}

