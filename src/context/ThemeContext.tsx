import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, setGlobalTheme } from '../constants/Colors';

type ThemeName = 'dark' | 'light';

interface ThemeContextType {
  themeName: ThemeName;
  theme: any;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'dark',
  theme: darkTheme,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  useEffect(() => {
    setGlobalTheme('dark');
    AsyncStorage.getItem('app_theme').then((savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setThemeName(savedTheme);
        setGlobalTheme(savedTheme);
      }
    });
  }, []);

  const toggleTheme = () => {
    const newTheme = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(newTheme);
    setGlobalTheme(newTheme);
    AsyncStorage.setItem('app_theme', newTheme);
  };

  const theme = themeName === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ themeName, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
