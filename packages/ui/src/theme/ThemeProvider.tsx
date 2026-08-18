import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';
import { createTheme, type Theme } from '@istanbul/tokens';

type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Préférence initiale, restaurée depuis le stockage par l'application. */
  initialPreference?: ThemePreference;
  onPreferenceChange?: (preference: ThemePreference) => void;
}

export function ThemeProvider({
  children,
  initialPreference = 'system',
  onPreferenceChange,
}: ThemeProviderProps) {
  const systemScheme: ColorSchemeName = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    setPreferenceState(initialPreference);
  }, [initialPreference]);

  const scheme = preference === 'system' ? (systemScheme ?? 'light') : preference;

  const value = useMemo<ThemeContextValue>(() => {
    const setPreference = (next: ThemePreference) => {
      setPreferenceState(next);
      onPreferenceChange?.(next);
    };

    return {
      theme: createTheme(scheme === 'dark' ? 'dark' : 'light'),
      preference,
      setPreference,
      isDark: scheme === 'dark',
    };
  }, [scheme, preference, onPreferenceChange]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé à l’intérieur d’un <ThemeProvider>.');
  }
  return context;
}

/** Accès au thème courant. Le point d'entrée de tout style dans l'application. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/**
 * Crée des styles dépendants du thème sans les recalculer à chaque rendu.
 *
 *   const styles = useThemedStyles((t) => ({
 *     card: { backgroundColor: t.colors.surface, borderRadius: t.radius.lg },
 *   }));
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // La factory est presque toujours une lambda inline : la mettre en
  // dépendance annulerait le mémo à chaque rendu. On ne dépend que du thème.
  const factoryRef = React.useRef(factory);
  factoryRef.current = factory;
  return useMemo(() => factoryRef.current(theme), [theme]);
}
