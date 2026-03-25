import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DataProduct = Database['public']['Tables']['data_products']['Row'];
type DataCartItem = Database['public']['Tables']['data_cart_items']['Row'];
type DataCartInsert = Database['public']['Tables']['data_cart_items']['Insert'];
type DataOrder = Database['public']['Tables']['data_orders']['Row'];
type DataOrderItem = Database['public']['Tables']['data_order_items']['Row'];

// ── Products ──

export function useDataProducts() {
  return useQuery({
    queryKey: ['data-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as DataProduct[];
    },
  });
}

// ── Cart ──

export function useCartItems() {
  return useQuery({
    queryKey: ['data-cart-items'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('data_cart_items')
        .select('*, data_products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (DataCartItem & { data_products: DataProduct })[];
    },
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Omit<DataCartInsert, 'user_id'>[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const rows = items.map(item => ({ ...item, user_id: user.id }));
      const { error } = await supabase
        .from('data_cart_items')
        .upsert(rows, { onConflict: 'user_id,product_id,geo_type,geo_code' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data-cart-items'] }),
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('data_cart_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data-cart-items'] }),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('data_cart_items').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data-cart-items'] }),
  });
}

// ── Orders ──

export function useDataOrders() {
  return useQuery({
    queryKey: ['data-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DataOrder[];
    },
  });
}

export function useDataOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ['data-order-items', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_order_items')
        .select('*, data_products(*)')
        .eq('order_id', orderId!)
        .order('created_at');
      if (error) throw error;
      return data as (DataOrderItem & { data_products: DataProduct })[];
    },
  });
}
