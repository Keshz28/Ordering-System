import type { Order } from "@/db/schema";

/**
 * Payment presentation constants.
 *
 * Kept in a module with no database or SDK imports so client components can
 * use them — importing lib/payments.ts from the browser drags in the Stripe
 * SDK and its fs/child_process dependencies.
 */

export const PAYMENT_METHOD_LABELS: Record<Order["paymentMethod"], string> = {
  card: "Card",
  fpx: "FPX online banking",
  duitnow_qr: "DuitNow QR",
  tng: "Touch 'n Go eWallet",
  grabpay: "GrabPay",
  boost: "Boost",
  shopeepay: "ShopeePay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  cash: "Cash",
  simulated: "Simulated card",
};

/**
 * The payment rails Malaysian diners actually reach for. Card-only checkout
 * loses sales here — FPX and DuitNow QR carry the majority of online payments,
 * so they lead the list.
 */
export type PaymentOption = {
  id: Order["paymentMethod"];
  label: string;
  blurb: string;
  /** Rendered as a coloured monogram; avoids shipping brand assets. */
  mark: string;
  tint: string;
  /** Staff-side only (POS). */
  staffOnly?: boolean;
};

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "fpx",
    label: "FPX online banking",
    blurb: "Maybank2u, CIMB Clicks, Public Bank and 15 more",
    mark: "FPX",
    tint: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    id: "duitnow_qr",
    label: "DuitNow QR",
    blurb: "Scan with any Malaysian banking or e-wallet app",
    mark: "QR",
    tint: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    id: "tng",
    label: "Touch 'n Go eWallet",
    blurb: "Pay from your TNG balance",
    mark: "TnG",
    tint: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "grabpay",
    label: "GrabPay",
    blurb: "Earn GrabRewards points",
    mark: "Grab",
    tint: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "boost",
    label: "Boost",
    blurb: "Boost wallet and BoostPay",
    mark: "Bst",
    tint: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    id: "shopeepay",
    label: "ShopeePay",
    blurb: "Pay from your Shopee wallet",
    mark: "SPay",
    tint: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    id: "card",
    label: "Credit or debit card",
    blurb: "Visa, Mastercard and American Express",
    mark: "Card",
    tint: "bg-stone-100 text-stone-800 border-stone-200",
  },
  {
    id: "cash",
    label: "Cash",
    blurb: "Collected at the counter",
    mark: "Cash",
    tint: "bg-lime-100 text-lime-800 border-lime-200",
    staffOnly: true,
  },
];

/** The FPX bank list shown when a customer picks online banking. */
export const FPX_BANKS = [
  "Maybank2u",
  "CIMB Clicks",
  "Public Bank",
  "RHB Now",
  "Hong Leong Connect",
  "AmOnline",
  "Bank Islam",
  "Affin Bank",
  "Alliance Bank",
  "Bank Rakyat",
  "BSN",
  "OCBC Bank",
  "Standard Chartered",
  "UOB Bank",
  "Agrobank",
  "HSBC Bank",
] as const;
