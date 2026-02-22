/**
 * DataCart Component
 *
 * Cart drawer showing all items grouped by region, with remove/clear and checkout.
 */

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

import { useCartItems, useRemoveFromCart, useClearCart } from "@/queries/useDataProductQueries";
import { toast } from "sonner";

interface DataCartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DataCart({ open, onOpenChange }: DataCartProps) {
  const { data: cartItems = [] } = useCartItems();
  const removeItem = useRemoveFromCart();
  const clearCart = useClearCart();

  // Group by region
  const grouped = cartItems.reduce<Record<string, typeof cartItems>>((acc, item) => {
    const key = `${item.geo_type}:${item.geo_code}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const subtotal = cartItems.reduce((sum, item) => {
    return sum + item.record_count * (item.data_products?.price_per_record || 0);
  }, 0);

  const handleRemove = async (id: string) => {
    try {
      await removeItem.mutateAsync(id);
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const handleClear = async () => {
    try {
      await clearCart.mutateAsync();
      toast.success("Cart cleared");
    } catch {
      toast.error("Failed to clear cart");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] max-h-[85vh]">
        <DrawerHeader className="border-b border-[#1e2a45] pb-4">
          <DrawerTitle className="text-[#e2e8f0] text-lg">Your Data Cart</DrawerTitle>
          <DrawerDescription className="text-[#64748b]">
            {cartItems.length === 0
              ? "Your cart is empty"
              : `${cartItems.length} item(s) across ${Object.keys(grouped).length} region(s)`}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-4 space-y-4 overflow-y-auto flex-1">
          {cartItems.length === 0 ? (
            <div className="text-center py-8 text-[#64748b]">
              <p className="text-sm">Select a region on the map and click "Get This Data" to add items.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([key, items]) => {
              const regionName = items[0]?.geo_name || key;
              const regionType = items[0]?.geo_type || "";

              return (
                <div key={key} className="bg-[#0a0f1a] rounded-lg border border-[#1e2a45] p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1e2a45]">
                    <span className="text-xs uppercase tracking-wider text-[#64748b]">{regionType}</span>
                    <span className="text-sm font-medium text-[#e2e8f0]">{regionName}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const lineTotal = item.record_count * (item.data_products?.price_per_record || 0);
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[#e2e8f0]">{item.data_products?.name}</span>
                            <span className="text-xs text-[#64748b] ml-2">
                              {formatNumber(item.record_count)} records
                            </span>
                          </div>
                          <span className="text-sm font-medium text-[#e2e8f0] whitespace-nowrap">
                            {formatCurrency(lineTotal)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(item.id)}
                            disabled={removeItem.isPending}
                            className="h-6 w-6 p-0 text-[#64748b] hover:text-[#ef4444] hover:bg-transparent flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <DrawerFooter className="border-t border-[#1e2a45] pt-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm text-[#94a3b8]">Subtotal</span>
              <span className="text-lg font-bold text-[#e2e8f0]">{formatCurrency(subtotal)}</span>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled>
              Proceed to Checkout (Coming Soon)
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={clearCart.isPending}
              className="w-full border-[#1e2a45] text-[#94a3b8] hover:bg-[#1e2a45]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cart
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
