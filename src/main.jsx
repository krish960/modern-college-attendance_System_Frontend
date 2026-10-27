/*
 * Entry point of the React app: the first file the browser runs.
 * It mounts <App /> inside the providers that every page needs.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./index.css";

// The wrappers go from the outside in:
// BrowserRouter gives routing, ToastProvider gives pop-up messages,
// AuthProvider gives the signed-in user (it uses toasts and the router state),
// and App holds the routes. StrictMode only adds extra checks in development.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
