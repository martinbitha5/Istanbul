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
    <View style={style} accessibilityRole="progressbar">
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
                color={cancelled ? theme.colors.danger : theme.colors.primary}
                idleColor={theme.colors.border}
                checkColor={theme.colors.textOnPrimary}
              />
              {!isLast ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: isDone ? theme.colors.primary : theme.colors.border,
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
