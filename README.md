# Bella Cucina

A complete restaurant **online ordering + CRM** system, built as a client
showcase for F&B businesses. Three surfaces on one database:

- **Customer storefront** — menu, modifiers, cart, five-step checkout, live
  order tracker, loyalty account
- **Kitchen display + POS** — ticket queue with SLA timers, walk-in order
  builder, split bill, table floor plan
- **Admin back office** — analytics, menu management, a rules-enforcing voucher
  engine, CRM segmentation and campaign recipes

## Quick start

```bash
npm install
npm run setup
npm run dev
```

Then open **http://localhost:3000/demo**.

No configuration is needed. With an empty `.env.local` the app runs on a local
SQLite file, settles payments through a simulated flow, and shows login codes on
screen instead of emailing them.

**Staff:** `owner@bellacucina.demo` / `demo1234`
**Customers:** any email — the 6-digit code appears on screen.

See **[docs/DEMO.md](docs/DEMO.md)** for the scripted five-minute walkthrough,
all credentials, the pricing rules, and Vercel deployment.

## Stack

| | |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4, Radix primitives, Lucide icons |
| Database | SQLite via Drizzle ORM — local file, or Turso (libSQL) in production |
| Charts | Recharts |
| Auth | Signed-cookie sessions (`jose`), role-gated server-side |
| Payments | Stripe test mode, with a simulated fallback |
| Email | Resend, with an in-app inbox fallback |

## Notable design decisions

**Pricing is server-only.** `src/lib/pricing.ts` is the single source of truth
for subtotals, voucher validation, promotion stacking, tier discounts, fees, tax
and points. The client re-quotes on every change and never computes a price.

**Roles are enforced, not hidden.** `requireStaff()` guards every staff page and
`staffGuard()` every staff API route. A kitchen login that visits `/admin` is
redirected server-side.

**The points ledger is append-only.** Balances are derived, not stored as the
truth: `pending → active → expired | clawed_back` for earns, negative `redeemed`
rows for spends. Refunds claw points back automatically.

**Turso instead of a committed SQLite file.** Vercel functions have an ephemeral
filesystem, so a checked-in `.sqlite` would lose every write. Turso is SQLite
over HTTP, so the schema and dialect are unchanged while production persists.

**Guest orders are claimable.** Checking out as a guest stores the email without
a customer record. Signing in with that email later attaches the orders and
retroactively credits the loyalty points.

## Layout

```
src/
  db/       schema (24 tables), seed data and generator
  lib/      pricing · loyalty · orders · campaigns · segments · analytics · auth
  app/
    (store)/  storefront and customer account
    (staff)/  kitchen display, POS, tables
    admin/    back office
    api/      route handlers
```
