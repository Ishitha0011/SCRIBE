import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'; // Default theme is light
  });

  useEffect(() => {
    localStorage.setItem('theme', theme); // Save theme to localStorage

    // Add theme class to the root HTML element for global styling
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);

    // Apply global theme-specific CSS variables
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#1e1e1e'); // Dark sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#1e1e1e'); // Dark editor background
      document.documentElement.style.setProperty('--editor-bg-color-rgb', '30, 30, 30'); // RGB values for dark background
      document.documentElement.style.setProperty('--editor-text-color', '#e0e0e0'); // White text for dark theme
      document.documentElement.style.setProperty('--editor-text-color-rgb', '224, 224, 224'); // RGB values for white
      document.documentElement.style.setProperty('--textarea-bg-color', '#252525'); // Dark textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#e0e0e0'); // White text for textarea in dark theme
      document.documentElement.style.setProperty('--muted-text-color', '#aaaaaa'); // Muted text color for dark theme
      document.documentElement.style.setProperty('--success-color', '#2a6b2a'); // Success color for dark theme
      document.documentElement.style.setProperty('--success-border-color', '#3c8c3c'); // Success border color for dark theme
      document.documentElement.style.setProperty('--dark-sidebar-bg-color', '#1e1e1e'); // Dark sidebar background for dark theme
      document.documentElement.style.setProperty('--dark-sidebar-text-color', '#e0e0e0'); // Dark sidebar text for dark theme
      document.documentElement.style.setProperty('--dark-border-color', '#333'); // Dark border color for dark theme
      document.documentElement.style.setProperty('--dark-bg-color', '#1e1e1e'); // Global dark background color
      document.documentElement.style.setProperty('--primary-bg-color', '#fff'); // Global primary background color

      // Dark Theme Popup Dialog Colors
      document.documentElement.style.setProperty('--bg-color', '#1e1e1e');
      document.documentElement.style.setProperty('--text-color', '#e0e0e0');
      document.documentElement.style.setProperty('--border-color', '#444');
      document.documentElement.style.setProperty('--input-bg-color', '#252525');
      document.documentElement.style.setProperty('--primary-color', '#4e8fef');
      document.documentElement.style.setProperty('--primary-color-light', 'rgba(78, 143, 239, 0.2)');
      document.documentElement.style.setProperty('--primary-hover-color', '#5865f2');
      document.documentElement.style.setProperty('--cancel-bg-color', '#2a2a2a');
      document.documentElement.style.setProperty('--cancel-text-color', '#aaaaaa');
      document.documentElement.style.setProperty('--cancel-hover-bg-color', '#333333');
    } else {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#f9f9f9'); // Light sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#fff'); // Light editor background
      document.documentElement.style.setProperty('--editor-bg-color-rgb', '255, 255, 255'); // RGB values for light background
      document.documentElement.style.setProperty('--editor-text-color', '#333'); // Black text for light theme
      document.documentElement.style.setProperty('--editor-text-color-rgb', '51, 51, 51'); // RGB values for black
      document.documentElement.style.setProperty('--textarea-bg-color', '#fff'); // Light textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#333'); // Black text for textarea in light theme
      document.documentElement.style.setProperty('--muted-text-color', '#666666'); // Muted text color for light theme
      document.documentElement.style.setProperty('--success-color', '#4caf50'); // Success color for light theme
      document.documentElement.style.setProperty('--success-border-color', '#388e3c'); // Success border color for light theme
      document.documentElement.style.setProperty('--dark-sidebar-bg-color', '#f9f9f9'); // Dark sidebar background for light theme
      document.documentElement.style.setProperty('--dark-sidebar-text-color', '#333'); // Dark sidebar text for light theme
      document.documentElement.style.setProperty('--dark-border-color', '#e0e0e0'); // Dark border color for light theme
      document.documentElement.style.setProperty('--dark-bg-color', '#fff'); // Global dark background color for light theme
      document.documentElement.style.setProperty('--primary-bg-color', '#fff'); // Global primary background color

      // Light Theme Popup Dialog Colors
      document.documentElement.style.setProperty('--bg-color', '#ffffff');
      document.documentElement.style.setProperty('--text-color', '#333333');
      document.documentElement.style.setProperty('--border-color', '#e0e0e0');
      document.documentElement.style.setProperty('--input-bg-color', '#f9f9f9');
      document.documentElement.style.setProperty('--primary-color', '#007bff');
      document.documentElement.style.setProperty('--primary-color-light', 'rgba(0, 123, 255, 0.2)');
      document.documentElement.style.setProperty('--primary-hover-color', '#0056b3');
      document.documentElement.style.setProperty('--cancel-bg-color', '#f8f9fa');
      document.documentElement.style.setProperty('--cancel-text-color', '#6c757d');
      document.documentElement.style.setProperty('--cancel-hover-bg-color', '#e2e6ea');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light')); // Toggle theme
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
