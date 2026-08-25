import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Divider } from './Surface';
import { Price, Text } from './Text';

export interface PriceBreakdownProps {
  subtotal: number;
  deliveryFee?: number;
  serviceFee?: number;
  discount?: number;
  total: number;
  currency?: string;
  formatMoney: (cents: number, currency?: string) => string;
  /** Libellé de la réduction : le code promo appliqué. */
  discountLabel?: string;
  /** Affiche « Offerte » à la place de 0,00 $ pour la livraison. */
  freeDelivery?: boolean;
  style?: ViewStyle;
}

/**
 * Récapitulatif de prix.
 *
 * Chiffres tabulaires partout, réduction en vert avec son signe. Le client
 * doit pouvoir vérifier son total d'un coup d'œil sans relire trois fois.
 *
 * Les lignes intermédiaires sont grises et de graisse normale ; seul le total
 * est noir et gras. C'est ce contraste — et non un filet ou un fond — qui fait
 * que l'œil tombe sur le montant à payer sans le chercher.
 */
export function PriceBreakdown({
  subtotal,
  deliveryFee = 0,
  serviceFee = 0,
  discount = 0,
  total,
  currency = 'USD',
  formatMoney,
  discountLabel,
  freeDelivery = false,
  style,
}: PriceBreakdownProps) {
  const theme = useTheme();

  return (
    <View style={style}>
      <Row label="Sous-total" value={formatMoney(subtotal, currency)} />

      {deliveryFee > 0 || freeDelivery ? (
        <Row
          label="Frais de livraison"
          value={freeDelivery || deliveryFee === 0 ? 'Offerte' : formatMoney(deliveryFee, currency)}
          valueColor={freeDelivery || deliveryFee === 0 ? 'success' : 'textSecondary'}
        />
      ) : null}

      {serviceFee > 0 ? (
        <Row label="Frais de service" value={formatMoney(serviceFee, currency)} />
      ) : null}

      {discount > 0 ? (
        <Row
          label={discountLabel ? `Réduction · ${discountLabel}` : 'Réduction'}
          value={`−${formatMoney(discount, currency)}`}
          valueColor="success"
          labelColor="success"
        />
      ) : null}

      <Divider spacing="md" />

      <View style={styles.row}>
        <Text variant="h2">Total</Text>
        <Price variant="priceLarge" color="text">
          {formatMoney(total, currency)}
        </Price>
      </View>

      <Text variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xs }}>
        Taxes incluses
      </Text>
    </View>
  );
}

function Row({
  label,
  value,
  labelColor = 'textSecondary',
  valueColor = 'textSecondary',
}: {
  label: string;
  value: string;
  labelColor?: 'textSecondary' | 'success';
  valueColor?: 'textSecondary' | 'success';
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { marginBottom: theme.spacing.sm }]}>
      <Text variant="body" color={labelColor} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="body" color={valueColor} tabular>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
