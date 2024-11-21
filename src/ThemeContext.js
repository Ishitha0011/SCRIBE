import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'; // Default theme is light
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);  // Save theme to localStorage

    // Apply theme-specific CSS variables
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#333');  // Dark sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#222');  // Dark editor background
      document.documentElement.style.setProperty('--editor-text-color', '#fff');  // White text for dark theme
      document.documentElement.style.setProperty('--textarea-bg-color', '#444');  // Dark textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#fff');  // White text for textarea in dark theme
    } else {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#f9f9f9');  // Light sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#fff');  // Light editor background
      document.documentElement.style.setProperty('--editor-text-color', '#000');  // Black text for light theme
      document.documentElement.style.setProperty('--textarea-bg-color', '#fff');  // Light textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#000');  // Black text for textarea in light theme
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));  // Toggle theme
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
