/**
 * DataCartIcon Component
 *
 * Cart icon with badge showing item count. Opens the cart panel.
 */

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartItems } from "@/queries/useDataProductQueries";

interface DataCartIconProps {
  onClick: () => void;
}

export function DataCartIcon({ onClick }: DataCartIconProps) {
  const { data: cartItems = [] } = useCartItems();
  const count = cartItems.length;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="relative text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a45] rounded-lg"
      aria-label={`Cart with ${count} items`}
    >
      <ShoppingCart className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Button>
  );
}
