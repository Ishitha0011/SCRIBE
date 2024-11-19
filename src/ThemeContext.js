import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    // Apply theme-specific CSS variables
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#333');
      document.documentElement.style.setProperty('--editor-bg-color', '#222');
      document.documentElement.style.setProperty('--editor-text-color', '#fff');
      document.documentElement.style.setProperty('--textarea-bg-color', '#444');
      document.documentElement.style.setProperty('--textarea-text-color', '#fff');
      // Add more variables for dark theme
    } else {
      document.documentElement.style.setProperty('--sidebar-bg-color', '#f0f0f0');
      document.documentElement.style.setProperty('--editor-bg-color', '#fff');
      document.documentElement.style.setProperty('--editor-text-color', '#000');
      document.documentElement.style.setProperty('--textarea-bg-color', '#fff');
      document.documentElement.style.setProperty('--textarea-text-color', '#000');
      // Reset other variables for light theme
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);