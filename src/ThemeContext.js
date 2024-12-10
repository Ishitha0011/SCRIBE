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
      document.documentElement.style.setProperty('--sidebar-bg-color', '#333'); // Dark sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#222'); // Dark editor background
      document.documentElement.style.setProperty('--editor-text-color', '#fff'); // White text for dark theme
      document.documentElement.style.setProperty('--textarea-bg-color', '#444'); // Dark textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#fff'); // White text for textarea in dark theme

      // Dark Theme Popup Dialog Colors
      document.documentElement.style.setProperty('--bg-color', '#2c2f33');
      document.documentElement.style.setProperty('--text-color', '#ffffff');
      document.documentElement.style.setProperty('--muted-text-color', '#b3b3b3');
      document.documentElement.style.setProperty('--border-color', '#444');
      document.documentElement.style.setProperty('--input-bg-color', '#23272a');
      document.documentElement.style.setProperty('--primary-color', '#7289da');
      document.documentElement.style.setProperty('--primary-color-light', 'rgba(114, 137, 218, 0.2)');
      document.documentElement.style.setProperty('--primary-hover-color', '#5865f2');
      document.documentElement.style.setProperty('--cancel-bg-color', '#3a3f44');
      document.documentElement.style.setProperty('--cancel-text-color', '#b3b3b3');
      document.documentElement.style.setProperty('--cancel-hover-bg-color', '#4e555b');
    } else {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#f9f9f9'); // Light sidebar background
      document.documentElement.style.setProperty('--editor-bg-color', '#fff'); // Light editor background
      document.documentElement.style.setProperty('--editor-text-color', '#000'); // Black text for light theme
      document.documentElement.style.setProperty('--textarea-bg-color', '#fff'); // Light textarea background
      document.documentElement.style.setProperty('--textarea-text-color', '#000'); // Black text for textarea in light theme

      // Light Theme Popup Dialog Colors
      document.documentElement.style.setProperty('--bg-color', '#ffffff');
      document.documentElement.style.setProperty('--text-color', '#333333');
      document.documentElement.style.setProperty('--muted-text-color', '#666666');
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
