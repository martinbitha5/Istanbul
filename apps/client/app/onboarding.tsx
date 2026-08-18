import { useRef, useState } from 'react';
import { Dimensions, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ForkKnife, MapPinLine, Timer } from 'phosphor-react-native';
import { Button, Pressable, Screen, Text, useTheme } from '@istanbul/ui';
import { STORAGE_KEYS } from '@/lib/config';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: ForkKnife,
    title: 'Découvrez notre menu',
    description:
      'Shawarmas, burgers, grillades au charbon et desserts turcs. Tout est préparé à la commande.',
  },
  {
    icon: Timer,
    title: 'Commandez facilement',
    description:
      'Personnalisez votre plat, ajoutez vos suppléments et payez à la livraison. En trois minutes.',
  },
  {
    icon: MapPinLine,
    title: 'Faites-vous livrer',
    description:
      'Suivez votre livreur en temps réel, de la cuisine jusqu’à votre porte, partout à Kinshasa.',
  },
] as const;

export default function Onboarding() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.onboardingSeen, 'true');
    router.replace('/(tabs)');
  };

  const next = () => {
    if (isLast) {
      void finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Le passage est toujours accessible : imposer trois écrans à un
          utilisateur pressé est le meilleur moyen de le perdre. */}
      <View style={[styles.skipRow, { paddingHorizontal: theme.screenPadding }]}>
        <Pressable onPress={finish} hitSlop={12} noScale accessibilityLabel="Passer l’introduction">
          <Text variant="labelStrong" color="textMuted">
            Passer
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, slideIndex) => {
          const Icon = slide.icon;
          return (
            <View key={slide.title} style={[styles.slide, { width, padding: theme.spacing['2xl'] }]}>
              <Animated.View
                entering={FadeIn.delay(slideIndex === 0 ? 200 : 0)}
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.primarySoft, marginBottom: theme.spacing['3xl'] },
                ]}
              >
                <Icon size={56} color={theme.colors.primary} weight="duotone" />
              </Animated.View>

              <Text variant="display" align="center">
                {slide.title}
              </Text>

              <Text
                variant="body"
                color="textSecondary"
                align="center"
                style={{ marginTop: theme.spacing.base, maxWidth: 320 }}
              >
                {slide.description}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { padding: theme.screenPadding }]}>
        <View style={[styles.dots, { marginBottom: theme.spacing.xl }]}>
          {SLIDES.map((slide, dotIndex) => (
            <View
              key={slide.title}
              style={{
                width: dotIndex === index ? 22 : 7,
                height: 7,
                borderRadius: 4,
                marginHorizontal: 3,
                backgroundColor: dotIndex === index ? theme.colors.primary : theme.colors.border,
              }}
            />
          ))}
        </View>

        <Button label={isLast ? 'Commencer' : 'Suivant'} onPress={next} fullWidth size="lg" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { alignItems: 'flex-end', paddingVertical: 8 },
  slide: { alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center' },
});
