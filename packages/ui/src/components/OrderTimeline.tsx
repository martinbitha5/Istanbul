import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { Check } from 'phosphor-react-native';
import {
  TRACKING_STEPS,
  trackingStepFor,
  trackingStepLabel,
  type OrderStatus,
  type TrackingStep,
} from '@istanbul/types';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface OrderProgressProps {
  status: OrderStatus;
  style?: ViewStyle;
}

/**
 * Progression segmentée — une barre par étape, remplie ou vide.
 *
 * C'est la forme que prend le suivi en tête de l'écran de livraison chez
 * Uber : cinq traits côte à côte, verts pour ce qui est fait, gris pour la
 * suite. Elle dit la même chose que la timeline verticale en une ligne au lieu
 * de cinq, ce qui laisse la place à la carte — et sur l'écran de suivi, la
 * carte est ce que le client regarde.
 *
 * La timeline détaillée reste juste en dessous ou dans l'historique : les deux
 * ne sont pas concurrentes, elles répondent à « où en est ma commande » et à
 * « qu'est-ce qui s'est passé quand ».
 */
export function OrderProgress({ status, style }: OrderProgressProps) {
  const theme = useTheme();
  const current = trackingStepFor(status);
  const currentIndex = TRACKING_STEPS.indexOf(current);
  const cancelled = status === 'CANCELLED';

  return (
    <View
      style={[styles.progress, { gap: theme.spacing.xs }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Étape ${Math.max(currentIndex + 1, 1)} sur ${TRACKING_STEPS.length} : ${trackingStepLabel[current]}`}
      accessibilityValue={{
        min: 0,
        max: TRACKING_STEPS.length,
        now: cancelled ? 0 : currentIndex + 1,
      }}
    >
      {TRACKING_STEPS.map((step, index) => (
        <View
          key={step}
          style={[
            styles.segment,
            {
              backgroundColor:
                !cancelled && index <= currentIndex ? theme.colors.success : theme.colors.skeleton,
            },
          ]}
        />
      ))}
    </View>
  );
}

export interface OrderTimelineProps {
  status: OrderStatus;
  /** Horodatage par étape, quand il est connu. */
  timestamps?: Partial<Record<TrackingStep, string | null>>;
  formatTime?: (iso: string) => string;
  style?: ViewStyle;
}

/**
 * Timeline de suivi.
 *
 * Trois états visuels distincts, chacun lisible sans couleur :
 *   passé   → pastille pleine + coche
 *   courant → pastille pleine + anneau qui pulse
 *   futur   → pastille en contour
 */
export function OrderTimeline({ status, timestamps, formatTime, style }: OrderTimelineProps) {
  const theme = useTheme();
  const current = trackingStepFor(status);
  const currentIndex = TRACKING_STEPS.indexOf(current);
  const cancelled = status === 'CANCELLED';

  return (
    <View
      style={style}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: TRACKING_STEPS.length - 1, now: Math.max(currentIndex, 0) }}
    >
      {TRACKING_STEPS.map((step, index) => {
        const isDone = !cancelled && index < currentIndex;
        const isCurrent = !cancelled && index === currentIndex;
        const isLast = index === TRACKING_STEPS.length - 1;
        const timestamp = timestamps?.[step];

        return (
          <View key={step} style={styles.row}>
            <View style={styles.gutter}>
              <StepDot
                done={isDone}
                current={isCurrent}
                cancelled={cancelled}
                // Vert et non noir : le suivi est le seul endroit où la
                // progression est une bonne nouvelle, et c'est exactement le
                // rôle qu'on donne au vert de marque.
                color={cancelled ? theme.colors.danger : theme.colors.success}
                idleColor={theme.colors.border}
                checkColor={theme.colors.textInverse}
              />
              {!isLast ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: isDone ? theme.colors.success : theme.colors.border,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.label, { paddingBottom: isLast ? 0 : theme.spacing.lg }]}>
              <Text
                variant={isCurrent ? 'bodyStrong' : 'body'}
                color={isDone || isCurrent ? 'text' : 'textMuted'}
              >
                {trackingStepLabel[step]}
              </Text>
              {timestamp && formatTime ? (
                <Text variant="caption" color="textMuted" tabular style={{ marginTop: 2 }}>
                  {formatTime(timestamp)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StepDot({
  done,
  current,
  cancelled,
  color,
  idleColor,
  checkColor,
}: {
  done: boolean;
  current: boolean;
  cancelled: boolean;
  color: string;
  idleColor: string;
  checkColor: string;
}) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!current || reducedMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [current, pulse, reducedMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: current ? 1 - pulse.value : 0,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  const filled = done || current;

  return (
    <View style={styles.dotWrap}>
      {current ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: color }, ring]}
        />
      ) : null}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: filled && !cancelled ? color : 'transparent',
            borderColor: cancelled ? color : filled ? color : idleColor,
          },
        ]}
      >
        {done ? <Check size={12} color={checkColor} weight="bold" /> : null}
      </View>
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  progress: { flexDirection: 'row' },
  // 4 pt de haut, angles francs : chez Uber ces segments ne sont pas arrondis.
  segment: { flex: 1, height: 4 },
  row: { flexDirection: 'row' },
  gutter: { alignItems: 'center', width: 32 },
  dotWrap: { alignItems: 'center', justifyContent: 'center', width: DOT, height: DOT },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
  connector: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  label: { flex: 1, paddingLeft: 4, paddingTop: 1 },
});
