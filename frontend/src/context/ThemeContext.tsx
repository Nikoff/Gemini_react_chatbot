import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'default' | 'nightworkshop' | 'living-canvas' | 'neural' | 'hologram' | 'blackhole' | 'aerogel' | 'neon';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { id: Theme; name: string; icon: string }[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'default',
  setTheme: () => {},
  themes: [],
});

export const useTheme = () => useContext(ThemeContext);

export const THEMES = [
  { id: 'default' as Theme, name: 'Classic', icon: '◆' },
  { id: 'nightworkshop' as Theme, name: 'Ночная Мастерская', icon: '🌙' },
  { id: 'living-canvas' as Theme, name: 'Живой Холст', icon: '🎨' },
  { id: 'neural' as Theme, name: 'Neural Core', icon: '⬡' },
  { id: 'hologram' as Theme, name: 'Hologram 3D', icon: '◇' },
  { id: 'blackhole' as Theme, name: 'Black Hole', icon: '◉' },
  { id: 'aerogel' as Theme, name: 'Aerogel', icon: '○' },
  { id: 'neon' as Theme, name: 'Neon', icon: '⚡' },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('chatbot-theme') as Theme) || 'default';
  });

  useEffect(() => {
    localStorage.setItem('chatbot-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
