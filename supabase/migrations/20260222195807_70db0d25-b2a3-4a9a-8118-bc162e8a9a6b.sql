
-- ============================================
-- Data Products Catalog
-- ============================================
CREATE TABLE public.data_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  description text,
  price_per_record numeric NOT NULL DEFAULT 0.05,
  min_order_amount numeric NOT NULL DEFAULT 500,
  is_active boolean NOT NULL DEFAULT true,
  source_field varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_products ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse the catalog
CREATE POLICY "Authenticated users can view active products"
  ON public.data_products FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage products
CREATE POLICY "Admins can manage products"
  ON public.data_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Data Orders
-- ============================================
CREATE TABLE public.data_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status varchar NOT NULL DEFAULT 'draft',
  total_amount numeric NOT NULL DEFAULT 0,
  stripe_payment_intent_id varchar,
  stripe_checkout_session_id varchar,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.data_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Users can insert their own orders
CREATE POLICY "Users can create own orders"
  ON public.data_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any order
CREATE POLICY "Admins can update orders"
  ON public.data_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_data_orders_updated_at
  BEFORE UPDATE ON public.data_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Data Order Items
-- ============================================
CREATE TABLE public.data_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.data_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.data_products(id),
  geo_type varchar NOT NULL,
  geo_code varchar NOT NULL,
  geo_name varchar NOT NULL,
  record_count integer NOT NULL,
  unit_price numeric NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_order_items ENABLE ROW LEVEL SECURITY;

-- Users can view items for their own orders, admins can see all
CREATE POLICY "Users can view own order items"
  ON public.data_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.data_orders
      WHERE id = order_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Insert via service role or user creating their own order
CREATE POLICY "Users can insert own order items"
  ON public.data_order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.data_orders
      WHERE id = order_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- Data Cart Items
-- ============================================
CREATE TABLE public.data_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.data_products(id),
  geo_type varchar NOT NULL,
  geo_code varchar NOT NULL,
  geo_name varchar NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, geo_type, geo_code)
);

ALTER TABLE public.data_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart"
  ON public.data_cart_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to own cart"
  ON public.data_cart_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart"
  ON public.data_cart_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from own cart"
  ON public.data_cart_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Seed the five data products
-- ============================================
INSERT INTO public.data_products (slug, name, description, price_per_record, min_order_amount, source_field) VALUES
  ('mailers', 'Mailers', 'Physical mailing addresses for direct mail campaigns targeting households in the selected region.', 0.05, 500, 'households'),
  ('sms', 'SMS Fundraising', 'Cell phone numbers for text-based fundraising and outreach campaigns.', 0.03, 500, 'cell_phones'),
  ('ctv', 'CTV Targeting', 'Household-level audience segments for Connected TV advertising campaigns.', 0.08, 500, 'households'),
  ('digital_ads', 'Digital Ads', 'Audience targeting lists for programmatic display and social media advertising.', 0.04, 500, 'muslim_voters'),
  ('phone_lists', 'Phone Call Lists', 'Phone numbers formatted for call-time and phone banking operations.', 0.03, 500, 'cell_phones');
