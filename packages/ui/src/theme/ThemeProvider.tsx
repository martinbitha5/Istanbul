import React, { createContext, useContext, useMemo } from 'react';
import { createTheme, type Theme } from '@istanbul/tokens';

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Fournit le thème — il n'y en a qu'un.
 *
 * Le provider ne lit plus `useColorScheme` et n'expose plus de préférence :
 * l'application est claire, comme sa référence. Il subsiste malgré tout,
 * plutôt qu'un simple import du thème dans chaque composant, parce que c'est
 * le point où l'on rebranchera une variation le jour où il en faudra une
 * (contraste élevé, par exemple) sans toucher aux 19 composants.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const value = useMemo<ThemeContextValue>(() => ({ theme: createTheme() }), []);

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
