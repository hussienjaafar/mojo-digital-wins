

# Voter Impact Map -- Data Purchase System

## Overview

Transform the Voter Impact Map from a read-only visualization into a data commerce platform where authenticated users can select geographic regions, choose data products (Mailers, SMS, CTV, Digital Ads, Phone Lists), and purchase targeted audience data. The system must be designed to scale from states/districts to zip codes in the future.

## Data Products

The five purchasable data products, each tied to the contact data already tracked in the map:

| Product | Description | Source Fields |
|---------|-------------|---------------|
| **Mailers** | Physical mailing addresses for direct mail campaigns | `households` |
| **SMS Fundraising** | Cell phone numbers for text-based outreach | `cell_phones` |
| **CTV Targeting** | Household-level audience segments for Connected TV ads | `households` |
| **Digital Ads** | Audience targeting lists for programmatic display/social | `muslim_voters` (full universe) |
| **Phone Call Lists** | Phone numbers formatted for call-time / phone banking | `cell_phones` |

## User Experience Flow

```text
1. Browse Map --> Select region(s) (state, district, or future zip)
2. Click "Get This Data" in the sidebar
3. Data Product Selector opens:
   - Pick one or more products (Mailers, SMS, CTV, etc.)
   - See record counts and estimated pricing per product
   - Review geographic selections
4. Add to Cart (multi-region, multi-product cart)
5. Checkout --> Stripe payment
6. Order confirmation --> Data fulfillment (admin delivers files)
```

## Database Schema

### New Tables

**`data_products`** -- Catalog of purchasable data types

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| slug | varchar UNIQUE | e.g. `mailers`, `sms`, `ctv`, `digital_ads`, `phone_lists` |
| name | varchar | Display name |
| description | text | What the buyer gets |
| price_per_record | numeric | Base price per record (e.g. $0.05) |
| min_order_amount | numeric | Minimum order total (e.g. $500) |
| is_active | boolean | Whether currently available for purchase |
| source_field | varchar | Which field drives record count (`households`, `cell_phones`, etc.) |
| created_at | timestamptz | |

**`data_orders`** -- Purchase orders

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK auth.users | Buyer |
| status | varchar | `draft`, `pending_payment`, `paid`, `processing`, `delivered`, `cancelled` |
| total_amount | numeric | Final charged amount |
| stripe_payment_intent_id | varchar | Stripe reference |
| stripe_checkout_session_id | varchar | Stripe checkout reference |
| notes | text | Internal notes |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`data_order_items`** -- Line items (one per product + geography combo)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| order_id | uuid FK data_orders | |
| product_id | uuid FK data_products | |
| geo_type | varchar | `state`, `district`, or future `zip` |
| geo_code | varchar | e.g. `MI`, `MI-011`, or `48201` |
| geo_name | varchar | Display name for the region |
| record_count | integer | Number of records at time of order |
| unit_price | numeric | Price per record at time of order |
| line_total | numeric | record_count * unit_price |
| created_at | timestamptz | |

**`data_cart_items`** -- Temporary cart (persisted server-side so it survives refreshes)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK auth.users | |
| product_id | uuid FK data_products | |
| geo_type | varchar | `state`, `district`, `zip` |
| geo_code | varchar | |
| geo_name | varchar | |
| record_count | integer | Snapshot at time of add |
| created_at | timestamptz | |
| UNIQUE(user_id, product_id, geo_type, geo_code) | | Prevent duplicates |

### Why This Schema Scales to Zip Codes

The `geo_type` + `geo_code` pattern is geography-agnostic. When zip-level data arrives:
- Add a `voter_impact_zipcodes` table with the same contact fields
- No changes needed to `data_order_items` or `data_cart_items` -- just pass `geo_type: 'zip'`
- The product selector and cart logic all work unchanged

## UI Components

### 1. "Get This Data" Button (RegionSidebar)

Add a prominent CTA button at the bottom of both `StateDetails` and `DistrictDetails` in the sidebar. This opens the product selector drawer.

### 2. DataProductSelector (New Component)

A slide-out drawer or modal showing:
- The selected region name and key stats
- Checkboxes for each active product with record counts and price estimates
- Running subtotal
- "Add to Cart" button
- Visual indicators for which products have data available (e.g., if a region has 0 cell_phones, SMS and Phone products show as "unavailable")

### 3. DataCart (New Component)

A cart icon in the map header with item count badge. Clicking opens a cart panel:
- Grouped by region, showing products under each
- Remove individual items or clear all
- Subtotal with minimum order check
- "Proceed to Checkout" button

### 4. Checkout Flow

Uses Stripe Checkout (redirect-based) via an edge function:
- Edge function creates a Stripe Checkout Session with all line items
- User is redirected to Stripe's hosted checkout
- On success, webhook updates `data_orders.status` to `paid`
- On return, user sees an order confirmation page

### 5. Order History Page

Simple page accessible from the map header or user menu showing past orders with status tracking.

## Edge Functions

### `create-data-checkout` (POST)

- Reads the user's cart items from `data_cart_items`
- Validates record counts against current data (prevents stale pricing)
- Creates a `data_orders` + `data_order_items` records with status `pending_payment`
- Creates a Stripe Checkout Session with line items
- Returns the Stripe checkout URL

### `stripe-data-webhook` (POST)

- Handles `checkout.session.completed` events
- Updates `data_orders.status` to `paid`
- Sends notification to admin (email or internal alert) for fulfillment

## RLS Policies

- **`data_products`**: Public SELECT for all authenticated users (catalog is visible). Admin-only INSERT/UPDATE/DELETE.
- **`data_cart_items`**: Users can only CRUD their own items (`user_id = auth.uid()`).
- **`data_orders`**: Users can SELECT their own orders. Admins can SELECT/UPDATE all. Only the edge function inserts (via service role).
- **`data_order_items`**: Users can SELECT items for their own orders. Admins can SELECT all.

## Implementation Sequence

### Phase 1: Database and Product Catalog
1. Create all four new tables with RLS policies
2. Seed the five data products
3. Create query hooks for products, cart, and orders

### Phase 2: Cart and Product Selection UI
4. Add "Get This Data" CTA to RegionSidebar
5. Build DataProductSelector drawer component
6. Build DataCart component with header icon
7. Wire cart operations (add/remove/clear) to database

### Phase 3: Checkout and Payment
8. Enable Stripe integration
9. Create `create-data-checkout` edge function
10. Create `stripe-data-webhook` edge function
11. Build order confirmation page
12. Build order history page

### Phase 4: Admin Fulfillment
13. Add "Data Orders" tab to Admin panel for order management
14. Admin can update order status and attach delivery notes

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create 4 tables, RLS, seed products |
| `src/queries/useDataProductQueries.ts` | New -- hooks for products, cart, orders |
| `src/components/voter-impact/DataProductSelector.tsx` | New -- product selection drawer |
| `src/components/voter-impact/DataCart.tsx` | New -- cart panel |
| `src/components/voter-impact/DataCartIcon.tsx` | New -- header cart icon with badge |
| `src/components/voter-impact/OrderConfirmation.tsx` | New -- post-checkout confirmation |
| `src/components/voter-impact/RegionSidebar.tsx` | Modify -- add "Get This Data" CTA |
| `src/pages/admin/VoterImpactMap.tsx` | Modify -- add cart icon to header |
| `src/pages/admin/DataOrderHistory.tsx` | New -- order history page |
| `supabase/functions/create-data-checkout/index.ts` | New -- Stripe checkout session |
| `supabase/functions/stripe-data-webhook/index.ts` | New -- payment webhook handler |
| Route configuration | Add routes for order history and confirmation |

## Stripe Integration

Stripe must be enabled on the project before Phase 3 can begin. The integration uses Stripe Checkout (hosted payment page) for PCI compliance -- no credit card fields are built into the app. Products are created as Stripe line items dynamically based on cart contents.

## Pricing Model

Prices are stored in `data_products.price_per_record` and can be adjusted by admins. At checkout, the edge function locks in the current price and record count, storing both in `data_order_items` so historical orders remain accurate even if prices change later.

