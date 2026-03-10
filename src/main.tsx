import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first render to avoid flash
const savedPrefs = localStorage.getItem("user_preferences");
if (savedPrefs) {
  const prefs = JSON.parse(savedPrefs);
  if (prefs.darkMode === false) {
    document.documentElement.classList.add("light-mode");
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);