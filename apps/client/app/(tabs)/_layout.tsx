import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForkKnife, Heart, House, Receipt, User } from 'phosphor-react-native';
import { OfflineBanner, useTheme } from '@istanbul/ui';
import { useIsOffline } from '@/providers/AppProviders';
import { TAB_BAR_HEIGHT } from '@/lib/layout';

/**
 * Navigation principale — cinq onglets, pas un de plus (limite Material).
 * Le panier n'est pas un onglet : il vit dans la barre flottante, toujours
 * accessible sans consommer une place dans la barre.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

  return (
    <View style={{ flex: 1 }}>
      {/* Rendu hors de tout SafeAreaView : sans `safeAreaTop`, le bandeau
          passait sous la barre de statut. C'est LE point de rendu unique du
          bandeau pour les onglets — pas de doublon par écran. */}
      <OfflineBanner visible={offline} safeAreaTop />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: theme.borderWidth.hairline,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
        },
        tabBarLabelStyle: {
          ...theme.text.overline,
          textTransform: 'none',
          marginTop: 2,
        },
        // Cible tactile confortable sur Android où la barre est plus basse.
        tabBarItemStyle: { paddingVertical: Platform.OS === 'android' ? 4 : 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <House size={theme.iconSize.md} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <ForkKnife
              size={theme.iconSize.md}
              color={color}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color, focused }) => (
            <Receipt size={theme.iconSize.md} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoris',
          tabBarIcon: ({ color, focused }) => (
            <Heart size={theme.iconSize.md} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <User size={theme.iconSize.md} color={color} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      </Tabs>
    </View>
  );
}
