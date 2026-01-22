/**
 * Supabase Proxy Utility
 * 
 * Routes database queries through Edge Functions on custom domains
 * where REST API CORS is not configured (e.g., portal.molitico.com).
 * 
 * On other domains (preview, localhost, molitico.com), uses direct queries.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Check if we're on a domain that needs the Edge Function proxy
 */
const getIsProxyDomain = (): boolean => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  // portal.molitico.com needs proxy because REST API CORS isn't configured
  return hostname === "portal.molitico.com";
};

interface ProxyQueryOptions {
  table: string;
  select?: string;
  filters?: Record<string, any>;
  single?: boolean;
}

interface ProxyRpcOptions {
  rpc: string;
  rpcParams?: Record<string, any>;
}

type ProxyOptions = ProxyQueryOptions | ProxyRpcOptions;

/**
 * Execute a database query, routing through Edge Function if on portal domain
 */
export async function proxyQuery<T = any>(
  options: ProxyOptions
): Promise<{ data: T | null; error: any }> {
  const isProxyDomain = getIsProxyDomain();

  // On portal domain, route through Edge Function
  if (isProxyDomain) {
    try {
      const { data, error } = await supabase.functions.invoke("db-proxy", {
        body: options,
      });

      if (error) {
        console.error("db-proxy invoke error:", error);
        return { data: null, error };
      }

      // Edge function returns { data, error } in body
      return { 
        data: data?.data ?? null, 
        error: data?.error ?? null 
      };
    } catch (err: any) {
      console.error("db-proxy exception:", err);
      return { data: null, error: err };
    }
  }

  // On other domains, use direct query
  if ("rpc" in options && options.rpc) {
    const { data, error } = await supabase.rpc(options.rpc as any, options.rpcParams);
    return { data: data as T, error };
  }

  const queryOptions = options as ProxyQueryOptions;
  let query = supabase
    .from(queryOptions.table as any)
    .select(queryOptions.select || "*");

  if (queryOptions.filters) {
    for (const [column, value] of Object.entries(queryOptions.filters)) {
      query = query.eq(column, value);
    }
  }

  if (queryOptions.single) {
    const { data, error } = await query.maybeSingle();
    return { data: data as T, error };
  }

  const { data, error } = await query;
  return { data: data as T, error };
}

/**
 * Execute an RPC call, routing through Edge Function if on portal domain
 */
export async function proxyRpc<T = any>(
  rpcName: string,
  params?: Record<string, any>
): Promise<{ data: T | null; error: any }> {
  return proxyQuery<T>({
    rpc: rpcName,
    rpcParams: params,
  });
}
