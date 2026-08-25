import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Heart, House, MagnifyingGlass, Receipt, User } from 'phosphor-react-native';
import { FloatingTabBar, OfflineBanner, type FloatingTabItem } from '@istanbul/ui';
import { useIsOffline } from '@/providers/AppProviders';

/**
 * Navigation principale — cinq onglets, pas un de plus (limite Material).
 * Le panier n'est pas un onglet : il vit dans la barre flottante, toujours
 * accessible sans consommer une place dans la barre.
 *
 * L'ordre place **Menu au centre**, sous la forme d'une pilule « Rechercher »
 * large. Ce n'est pas cosmétique : chercher un plat est l'action la plus
 * fréquente après ouvrir l'application, et la référence lui donne le milieu de
 * la barre — la seule position atteignable au pouce des deux mains. Accueil et
 * Profil gardent les extrémités, où ils étaient déjà.
 */
const TAB_ORDER = ['index', 'favorites', 'menu', 'orders', 'profile'] as const;

const TABS: Record<
  (typeof TAB_ORDER)[number],
  { label: string; wide?: boolean; icon: FloatingTabItem['icon'] }
> = {
  index: {
    label: 'Accueil',
    icon: ({ color, focused, size }) => (
      <House size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  favorites: {
    label: 'Favoris',
    icon: ({ color, focused, size }) => (
      <Heart size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  menu: {
    label: 'Rechercher un plat',
    wide: true,
    icon: ({ color, size }) => <MagnifyingGlass size={size} color={color} weight="bold" />,
  },
  orders: {
    label: 'Commandes',
    icon: ({ color, focused, size }) => (
      <Receipt size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  profile: {
    label: 'Profil',
    icon: ({ color, focused, size }) => (
      <User size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
};

export default function TabsLayout() {
  const offline = useIsOffline();

  return (
    <View style={{ flex: 1 }}>
      {/* Rendu hors de tout SafeAreaView : sans `safeAreaTop`, le bandeau
          passait sous la barre de statut. C'est LE point de rendu unique du
          bandeau pour les onglets — pas de doublon par écran. */}
      <OfflineBanner visible={offline} safeAreaTop />

      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state, navigation }) => (
          <FloatingTabBar
            items={TAB_ORDER.map((name): FloatingTabItem => {
              const index = state.routes.findIndex((route) => route.name === name);
              const route = state.routes[index];
              const config = TABS[name];

              return {
                key: name,
                label: config.label,
                icon: config.icon,
                wide: config.wide,
                focused: state.index === index,
                // `navigate` par nom plutôt que par clé : la barre affiche les
                // onglets dans son propre ordre, qui n'est plus celui du
                // navigateur, et une navigation par index se tromperait de
                // cible dès qu'un onglet est ajouté.
                onPress: () => navigation.navigate(route?.name ?? name),
              };
            })}
          />
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="menu" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="favorites" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </View>
  );
}
