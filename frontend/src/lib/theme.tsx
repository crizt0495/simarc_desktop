/**
 * Theme — identik dengan aplikasi web referensi:
 * `data-theme="light|dark"` pada documentElement + localStorage('theme')
 * + CustomEvent 'themeChanged' untuk elemen yang ikut berubah warna.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const ThemeCtx = createContext<{ isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void }>({
  isDark: false,
  mode: 'light',
  setMode: () => undefined,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    (localStorage.getItem('theme') as ThemeMode) || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = mode === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('theme', m);
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: m } }));
  }, []);

  const toggle = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);

  // Ikon topbar referensi diperbarui lewat #themeIcon.
  const value = { isDark: mode === 'dark', mode, setMode: ((m: ThemeMode) => (m === mode ? toggle() : setMode(m))) as typeof setMode };
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
