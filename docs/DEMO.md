# Bella Cucina — demo guide

A complete restaurant ordering + CRM system built as a client showcase. Three
surfaces, one database, no configuration required to run it.

---

## 1. Run it locally

```bash
npm install
npm run setup   # pushes the schema, then seeds the demo restaurant
npm run dev
```

Open **http://localhost:3000/demo** — that's the launcher with three big buttons.

`npm run setup` is the only command you need. It runs `drizzle-kit push --force`
against `./.data/db.sqlite` and then the seed script. Re-run it any time to get
a clean demo (it wipes and rebuilds everything).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run setup` | Push schema + seed (the reset button) |
| `npm run db:push` | Push schema only |
| `npm run db:seed` | Re-seed only |
| `npm run db:studio` | Drizzle Studio, to browse the data |
| `npm run build` | Production build |

### URLs

| Surface | URL | Who |
| --- | --- | --- |
| Demo launcher | `/demo` | Start here |
| Storefront | `/` and `/menu` | Customers |
| Checkout | `/checkout` | Customers |
| Order tracker | `/order/<id>` | Customers |
| Customer account | `/account` | Signed-in customers |
| Kitchen display | `/kds` | kitchen, cashier, manager, owner |
| Point of sale | `/pos` | cashier, manager, owner |
| Table floor plan | `/pos/tables` | cashier, manager, owner |
| Admin dashboard | `/admin` | manager, owner |
| Settings & staff | `/admin/settings`, `/admin/staff` | owner only |
| Staff sign-in | `/staff/login` | All staff |

---

## 2. Credentials

### Staff — email + password

All seeded staff accounts use the password **`demo1234`**.

| Email | Role | Can reach |
| --- | --- | --- |
| `owner@bellacucina.demo` | owner | Everything, including settings and staff |
| `manager@bellacucina.demo` | manager | Orders, menu, CRM, marketing, analytics |
| `cashier@bellacucina.demo` | cashier | POS, tables, kitchen display |
| `kitchen@bellacucina.demo` | kitchen | Kitchen display only |

Roles are enforced **server-side** on every page and API route. Signing in as
`kitchen@` and visiting `/admin` redirects to `/staff/denied` — the UI hiding is
cosmetic on top of the real check.

### Customers — passwordless

Enter **any** email address at `/login`. A 6-digit code appears on screen and in
the customer's in-app Inbox. There is no password.

Useful seeded customers:

| Email | Why it's interesting |
| --- | --- |
| `amelia.hart@example.com` | VIP, Gold tier, ~6,000 points, 15 orders, has a personal voucher |
| `daniel.okafor@example.com` | VIP, Gold tier |
| `nadia.haddad@example.com` | Repeat customer, gluten allergy on file |
| `callum.reid@example.com` | Dormant — hasn't ordered in 95+ days |

---

## 3. The scripted five-minute demo

### Act 1 — the customer (2 min)

1. Open `/demo` on a phone, tap **Order food**.
2. Browse the menu. Tap **Margherita D.O.P.** — the modifier picker enforces a
   required size choice and optional toppings, with the price updating live.
3. Add it. The **upsell** sheet offers garlic bread or a drink.
4. Go to checkout. Walk the five steps: order type → details → voucher → tip →
   payment.
5. In step 3, type **`BELLA15`**. If the subtotal is under $30 it explains
   exactly how much more is needed — that's the rules engine talking, not a
   generic error.
6. Sign in with the client's own email (step 2 link). The code appears on
   screen; enter it. Points now accrue on this order.
7. Pay. Test card `4242 4242 4242 4242` is pre-filled. You land on the receipt
   and the live order tracker.

### Act 2 — the kitchen (1 min)

8. Open `/kds` in another tab (sign in as `kitchen@bellacucina.demo`).
9. The order is sitting in **Incoming**. Hit **Accept**, then **Bump** through
   Preparing → Ready. Watch the SLA timer go green → amber → red past 25 min.
10. Switch back to the customer tracker — it has already advanced. The tracker
    also self-advances on a timer, so it moves even if nobody touches the KDS.

### Act 3 — the owner (2 min) — this is the closer

11. Open `/admin` as `owner@bellacucina.demo`. Revenue trend, busiest hours, top
    items by units and revenue, payment mix, new vs returning, promotion ROI,
    campaign attribution — every chart populated from the seeded data.
12. Go to **Customers**, find the client's own email in the CRM.
13. On their profile, use **Issue a personal voucher** → `$5 off` → Send.
14. Ask the client to refresh **My offers** on their phone. The voucher is
    already there with a countdown, and it works at checkout.

That step 13 → 14 loop is the whole pitch: track customers, segment them, and
reward them individually, in under two minutes, on their own phone.

### Optional extras

- **Campaign recipes** (`/admin/campaigns`) — pick "We miss you", see exactly
  which dormant customers it reaches right now, and send. Every recipient gets a
  personal voucher and an inbox message.
- **Voucher builder** (`/admin/vouchers`) — build a code with a min spend and a
  date window, then show it being rejected at checkout for the right reason.
- **Split the bill** (`/pos`) — build a ticket, split evenly or by item.
- **Table floor plan** (`/pos/tables`) — tap tables to cycle their status.

---

## 4. How the money works

Totals are computed **only on the server** (`src/lib/pricing.ts`). The client
re-quotes on every change and never calculates a price itself.

```
subtotal        sum of (item price + modifier deltas) × quantity
− discounts     one manual voucher + tier discount, or the single best
                automatic promotion when no voucher is applied
+ delivery fee  by zone; waived by Gold tier or a free-delivery voucher
+ service       5% of post-discount food (configurable)
+ tax           8% of (food + service + delivery) (configurable)
+ tip           optional, earns no points
= total
```

**Voucher rules enforced at checkout:** active flag, start/end dates, minimum
spend, order-type restriction, total usage cap, per-customer cap, targeted
ownership, and item presence for free-item vouchers. Each failure returns a
specific human message.

**Stacking:** one manual voucher plus the tier discount. Automatic promotions
(first-order, happy hour, BOGO, bundle, birthday) apply only when no manual
voucher is in play, unless the voucher is marked stackable. Only the single best
automatic promotion applies.

**Loyalty:** earn 10/15/25 points per $1 for Bronze/Silver/Gold on post-discount
food only — never on fees, delivery or tips. The ledger is append-only:

```
earn  pending ──(order completed)──> active ──> expired | clawed_back
spend                                redeemed (negative rows)
```

Points expire 18 months after they're earned, with in-app warnings at 90 and 30
days. Tiers use a rolling 12-month earning window, so spending points never
demotes you. Refunding an order claws its points back.

---

## 5. Optional integrations

Everything works with an empty `.env.local`. Adding keys upgrades behaviour
without any code change.

| Variable | Without it | With it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Simulated payment, same state machine | Real Stripe test-mode Checkout |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | — | Pairs with the secret key |
| `RESEND_API_KEY` | Login codes on screen + Inbox | Codes and campaigns sent as real email |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Local `./.data/db.sqlite` | Remote database (required on Vercel) |
| `AUTH_SECRET` | Development fallback | Signs session cookies — **set this in production** |
| `ADMIN_SEED_TOKEN` | Seed endpoint disabled | Enables `POST /api/seed-protected` |

Copy `.env.example` to `.env.local` to see them all documented.

---

## 6. Deploying to Vercel

### Why not plain SQLite

Vercel functions get an ephemeral, effectively read-only filesystem, and Vercel
Blob is object storage rather than a mountable disk — a committed `.sqlite` file
would lose every write on redeploy (and between requests). **Turso** is libSQL,
which is SQLite over HTTP: the Drizzle schema, queries and dialect are all
unchanged, and local development still uses a plain file.

### Steps

1. **Create the database** (free tier is plenty):

   ```bash
   npm i -g @tursodatabase/cli
   turso auth signup
   turso db create bella-cucina
   turso db show bella-cucina --url
   turso db tokens create bella-cucina
   ```

2. **Push the schema to it** from your machine:

   ```bash
   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:push
   ```

3. **Push the code to GitHub**, then import the repo at
   [vercel.com/new](https://vercel.com/new).

4. **Set environment variables** in the Vercel project:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
   | `TURSO_AUTH_TOKEN` | token from step 1 |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | your deployment URL |
   | `ADMIN_SEED_TOKEN` | any long random string |
   | `STRIPE_SECRET_KEY` | optional |
   | `RESEND_API_KEY` | optional |

5. **Deploy**, then seed production once:

   ```bash
   curl -X POST https://<your-app>.vercel.app/api/seed-protected \
     -H "Authorization: Bearer $ADMIN_SEED_TOKEN"
   ```

   Check it worked (returns counts, or tells you the schema is missing):

   ```bash
   curl https://<your-app>.vercel.app/api/seed-protected?token=$ADMIN_SEED_TOKEN
   ```

   The endpoint refuses to run at all unless `ADMIN_SEED_TOKEN` is set, so an
   unconfigured deployment can't be wiped by a passer-by.

6. Text the client **`https://<your-app>.vercel.app/demo`**.

---

## 7. What's in the seed

- 6 categories, 27 dishes with allergens, prep times, Unsplash imagery and
  fallback colour cards when an image 404s
- 5 modifier templates (pizza size, extra toppings, pasta add-ons, steak
  doneness, drink size) with required/optional and min/max rules
- 3 delivery zones with fees, minimums and ETAs
- 5 vouchers including `LUNCH10`, deliberately expired so you can demo a
  rejection
- 7 promotions: banner, first-order, happy hour, bundle, BOGO, birthday,
  referral
- 3 loyalty tiers and a 5-item redemption catalogue
- 6 staff accounts across all four roles
- 20 customers with birthdays, allergies, preferences and varied spend, spread
  across every segment
- ~100 historical orders over the past 30 days plus 6 live kitchen tickets
- 15 reviews (some needing a reply), 3 sent campaigns with attribution, and a
  populated activity log

---

## 8. Project layout

```
src/
  db/
    schema.ts        24 tables — the whole data model
    seed.ts          demo data generator
    seed-data.ts     menu, customers, copy
  lib/
    pricing.ts       cart resolution, voucher validation, totals   ← the engine
    loyalty.ts       points ledger, tiers, redemptions, vouchers
    orders.ts        creation, status machine, refunds, claiming
    campaigns.ts     retention recipes and sending
    segments.ts      CRM auto-segmentation
    analytics.ts     every dashboard and report query
    auth.ts          roles + server-side guards
    session.ts       signed-cookie sessions (staff + customer)
  app/
    (store)/         customer storefront and account
    (staff)/         KDS, POS, tables
    admin/           back office
    api/             route handlers
```
