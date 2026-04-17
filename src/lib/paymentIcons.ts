import {
  Banknote, Smartphone, CreditCard, Building2, Bike, Truck, Wallet,
  Globe, ShoppingBag, Store, Utensils, Hotel, Receipt, IndianRupee,
  Coins, Landmark, QrCode, Gift, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Available icons users can pick from when creating a custom payment method. */
export const PAYMENT_ICON_REGISTRY: Record<string, LucideIcon> = {
  Building2, Bike, Truck, Wallet, Globe, ShoppingBag, Store, Utensils,
  Hotel, Receipt, IndianRupee, Coins, Landmark, QrCode, Gift, Zap,
  Banknote, Smartphone, CreditCard,
};

export const PAYMENT_ICON_NAMES = Object.keys(PAYMENT_ICON_REGISTRY);

export const getPaymentIcon = (name?: string | null): LucideIcon => {
  if (name && PAYMENT_ICON_REGISTRY[name]) return PAYMENT_ICON_REGISTRY[name];
  return Building2;
};

/** Resolve icon for a payment method considering built-in codes first. */
export const resolvePaymentIcon = (code: string, iconName?: string | null): LucideIcon => {
  if (code === "cash") return Banknote;
  if (code === "upi") return Smartphone;
  if (code === "card") return CreditCard;
  return getPaymentIcon(iconName);
};
