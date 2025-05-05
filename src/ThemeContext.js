import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Get theme from localStorage or default to 'light'
    return localStorage.getItem('theme') || 'light'; 
  });

  useEffect(() => {
    // Save theme choice to localStorage
    localStorage.setItem('theme', theme);

    const root = document.documentElement;
    
    // Remove previous theme class and add the current one
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    // Centralized theme variable definitions
    const themeVariables = {
      light: {
        '--background-primary': '#ffffff',
        '--background-secondary': '#f7f7f7',
        '--background-hover': '#eeeeee',
        '--text-primary': '#222222',
        '--text-secondary': '#555555',
        '--border-color': '#e0e0e0',
        '--accent-color': '#7952b3',      // Base Purple
        '--accent-color-light': '#e8dff5', // Light Purple Tint
        '--accent-color-hover': '#6841a0', // Darker Purple on Hover
        '--accent-text-color': '#ffffff',  // White Text for Accent Bg
        '--success-color': '#28a745',     // Green
        '--warning-color': '#fd7e14',     // Orange
        '--error-color': '#dc3545',      // Red
        // -- You can add back other specific variables if needed --
        // '--sidebar-bg-color': '#f9f9f9',
        // '--editor-bg-color': '#ffffff',
        // '--input-bg-color': '#f9f9f9', 
      },
      dark: {
        '--background-primary': '#2d2d2d', // Dark Grey
        '--background-secondary': '#383838', // Slightly Lighter Dark Grey
        '--background-hover': '#4a4a4a',    // Hover Grey
        '--text-primary': '#e0e0e0',       // Light Grey Text
        '--text-secondary': '#aaaaaa',      // Medium Grey Text
        '--border-color': '#555555',       // Dark Border
        '--accent-color': '#9775ca',      // Lighter Purple
        '--accent-color-light': '#4a3f5a', // Dark Purple Tint
        '--accent-color-hover': '#ab8fd9', // Lighter Purple on Hover
        '--accent-text-color': '#ffffff',
        '--success-color': '#51cf66',     // Brighter Green
        '--warning-color': '#ffc078',     // Lighter Orange
        '--error-color': '#ff6b6b',      // Lighter Red
        // -- You can add back other specific variables if needed --
        // '--sidebar-bg-color': '#1e1e1e',
        // '--editor-bg-color': '#1e1e1e',
        // '--input-bg-color': '#2a2a2a',
      }
    };

    // Get variables for the current theme
    const currentThemeVars = themeVariables[theme];
    
    // Apply variables to the root element
    for (const [key, value] of Object.entries(currentThemeVars)) {
      root.style.setProperty(key, value);
    }

    // Cleanup function (optional, might remove variables on unmount)
    // return () => {
    //   for (const key of Object.keys(currentThemeVars)) {
    //     root.style.removeProperty(key);
    //   }
    // };

  }, [theme]); // Rerun effect when theme changes

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Provide theme and toggle function to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use the theme context
export const useTheme = () => useContext(ThemeContext);
