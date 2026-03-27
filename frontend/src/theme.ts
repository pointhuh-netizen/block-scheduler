import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: 'light' | 'dark';
  bg: string;
  bg2: string;
  bg3: string;
  accent: string;
  accentLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  red: string;
  green: string;
  amber: string;
  sleepBg: string;
  modalOverlay: string;
  scrollbarThumb: string;
}

export const darkTheme: Theme = {
  mode: 'dark',
  bg: '#1E1E2E',
  bg2: '#2A2A3E',
  bg3: '#16213E',
  accent: '#7C7FF5',
  accentLight: 'rgba(124,127,245,0.15)',
  textPrimary: '#E0E0E0',
  textSecondary: '#9090A0',
  textMuted: '#555568',
  border: '#3A3A4E',
  red: '#F87171',
  green: '#34D399',
  amber: '#FBBF24',
  sleepBg: 'rgba(10,10,25,0.65)',
  modalOverlay: 'rgba(0,0,0,0.72)',
  scrollbarThumb: '#3A3A4E',
};

export const lightTheme: Theme = {
  mode: 'light',
  bg: '#FAFAF8',
  bg2: '#F5F5F0',
  bg3: '#EBEBE3',
  accent: '#5558C8',
  accentLight: 'rgba(85,88,200,0.12)',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#AAAAAA',
  border: '#D8D8D0',
  red: '#DC2626',
  green: '#059669',
  amber: '#D97706',
  sleepBg: 'rgba(200,200,185,0.45)',
  modalOverlay: 'rgba(0,0,0,0.40)',
  scrollbarThumb: '#C8C8C0',
};

export function resolveTheme(pref: ThemeMode): Theme {
  if (pref === 'dark') return darkTheme;
  if (pref === 'light') return lightTheme;
  // 'system'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? darkTheme : lightTheme;
}

export const ThemeContext = createContext<Theme>(darkTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
