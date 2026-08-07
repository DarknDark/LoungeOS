import type { MenuItem, OrderItem, OrderModifierSelection } from '@workspace/domain';

export type PricingInput = {
  clubId: string;
  items: Array<{
    menuItem: MenuItem;
    quantity: number;
    modifiers: OrderModifierSelection[];
    notes?: string;
  }>;
  taxPercentage: number;
  serviceChargePercentage: number;
  discountMinor?: number;
};

export type PricingResult = {
  items: OrderItem[];
  subtotalMinor: number;
  taxMinor: number;
  serviceChargeMinor: number;
  discountMinor: number;
  totalMinor: number;
};

export function calculateOrderPricing(input: PricingInput): PricingResult {
  const items = input.items.map((inputItem, index) => {
    const modifierDelta = inputItem.modifiers.reduce(
      (sum, modifier) => sum + modifier.priceDeltaMinor,
      0,
    );
    const unitPriceMinor = inputItem.menuItem.priceMinor + modifierDelta;
    const lineSubtotalMinor = unitPriceMinor * inputItem.quantity;
    return {
      id: `item-${index}`,
      clubId: input.clubId,
      orderId: '',
      menuItemId: inputItem.menuItem.id,
      nameSnapshot: inputItem.menuItem.name,
      unitPriceMinor,
      quantity: inputItem.quantity,
      preparationStationId: inputItem.menuItem.preparationStationId,
      ...(inputItem.menuItem.inventoryItemId
        ? { inventoryItemId: inputItem.menuItem.inventoryItemId }
        : {}),
      modifiers: inputItem.modifiers,
      ...(inputItem.notes ? { notes: inputItem.notes } : {}),
      lineSubtotalMinor,
    } satisfies OrderItem;
  });
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineSubtotalMinor, 0);
  const discountMinor = Math.max(
    0,
    Math.min(Math.round(input.discountMinor ?? 0), subtotalMinor),
  );
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = Math.round((taxableMinor * input.taxPercentage) / 100);
  const serviceChargeMinor = Math.round(
    (taxableMinor * input.serviceChargePercentage) / 100,
  );
  return {
    items,
    subtotalMinor,
    taxMinor,
    serviceChargeMinor,
    discountMinor,
    totalMinor: taxableMinor + taxMinor + serviceChargeMinor,
  };
}