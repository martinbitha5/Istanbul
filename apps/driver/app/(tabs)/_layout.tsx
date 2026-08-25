import { Tabs } from 'expo-router';
import { ClockCounterClockwise, Money, Motorcycle, User } from 'phosphor-react-native';
import { FloatingTabBar, type FloatingTabItem } from '@istanbul/ui';

/**
 * Onglets du livreur — même barre flottante que l'application client.
 *
 * Pas de pilule de recherche ici : le livreur ne cherche rien, il exécute ce
 * qu'on lui assigne. Les quatre pastilles sont donc centrées plutôt
 * qu'étirées, ce que `FloatingTabBar` fait de lui-même en l'absence d'onglet
 * large.
 */
const TABS: { name: string; label: string; icon: FloatingTabItem['icon'] }[] = [
  {
    name: 'index',
    label: 'Courses',
    icon: ({ color, focused, size }) => (
      <Motorcycle size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  {
    name: 'history',
    label: 'Historique',
    icon: ({ color, focused, size }) => (
      <ClockCounterClockwise size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  {
    name: 'earnings',
    label: 'Revenus',
    icon: ({ color, focused, size }) => (
      <Money size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
  {
    name: 'profile',
    label: 'Profil',
    icon: ({ color, focused, size }) => (
      <User size={size} color={color} weight={focused ? 'fill' : 'regular'} />
    ),
  },
];

export default function DriverTabs() {
  // Le bandeau hors ligne vit dans le layout racine : il couvre aussi l'écran
  // de course, hors de cette pile d'onglets.
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <FloatingTabBar
          items={TABS.map((tab): FloatingTabItem => {
            const index = state.routes.findIndex((route) => route.name === tab.name);

            return {
              key: tab.name,
              label: tab.label,
              icon: tab.icon,
              focused: state.index === index,
              onPress: () => navigation.navigate(tab.name),
            };
          })}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
