import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Rangée horizontale « space-between ».
 *
 * Le style était redéfini à l'identique dans quatre écrans (dashboard,
 * détail de course, revenus, historique) : le centraliser garantit que le
 * même motif visuel reste identique partout et supprime la duplication.
 */
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
