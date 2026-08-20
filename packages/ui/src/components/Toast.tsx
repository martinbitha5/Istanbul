import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { CheckCircle, Info, Warning, WarningOctagon } from 'phosphor-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Toast.
 *
 * La brique de feedback qui manquait : sans elle, chaque mutation réussie ou
 * échouée reste muette et l'utilisateur ne sait jamais si son action a abouti.
 * Un seul toast à la fois — le suivant remplace le précédent, une pile de
 * toasts est un journal de logs, pas du feedback.
 */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  tone?: ToastTone;
  /** Durée d'affichage en ms. 0 = persistant jusqu'au tap. */
  duration?: number;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: () => void;
}

interface ActiveToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur d’un <ToastProvider>.');
  }
  return context;
}

const DEFAULT_DURATION = 3500;
/** Une erreur mérite plus de temps de lecture qu'une confirmation. */
const ERROR_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      const tone = options?.tone ?? 'info';
      counter.current += 1;
      setToast({ id: counter.current, message, tone });

      const duration = options?.duration ?? (tone === 'error' ? ERROR_DURATION : DEFAULT_DURATION);
      if (duration > 0) {
        timer.current = setTimeout(() => setToast(null), duration);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, { tone: 'success' }),
      error: (message) => show(message, { tone: 'error' }),
      info: (message) => show(message, { tone: 'info' }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toast, onDismiss }: { toast: ActiveToast | null; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  const icons: Record<ToastTone, React.ReactNode> = {
    success: (
      <CheckCircle size={theme.iconSize.sm} color={theme.colors.success} weight="fill" />
    ),
    error: (
      <WarningOctagon size={theme.iconSize.sm} color={theme.colors.danger} weight="fill" />
    ),
    warning: <Warning size={theme.iconSize.sm} color={theme.colors.warning} weight="fill" />,
    info: <Info size={theme.iconSize.sm} color={theme.colors.info} weight="fill" />,
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        styles.host,
        { paddingTop: insets.top + theme.spacing.sm, zIndex: theme.zIndex.toast },
      ]}
    >
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(theme.duration.base)}
        exiting={FadeOutUp.duration(theme.duration.exit)}
        style={{ maxWidth: 560, width: '100%', paddingHorizontal: theme.screenPadding }}
      >
        <Pressable
          noScale
          onPress={onDismiss}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={toast.message}
          accessibilityHint="Appuyez pour masquer"
          style={[
            styles.toast,
            theme.elevation[3],
            {
              backgroundColor: theme.colors.surfaceInverse,
              borderRadius: theme.radius.lg,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.base,
              gap: theme.spacing.sm,
            },
          ]}
        >
          {icons[toast.tone]}
          <Text variant="label" color="textInverse" style={styles.message} numberOfLines={3}>
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center' },
  message: { flex: 1 },
});
