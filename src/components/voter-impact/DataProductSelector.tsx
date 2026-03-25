/**
 * DataProductSelector Component
 *
 * Drawer showing available data products for a selected region.
 * Users can pick products, see record counts/pricing, and add to cart.
 */

import { useState, useMemo } from "react";
import { ShoppingCart, Mail, Phone, Tv, Monitor, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

import { useDataProducts, useAddToCart } from "@/queries/useDataProductQueries";
import type { VoterImpactState, VoterImpactDistrict } from "@/queries/useVoterImpactQueries";
import { toast } from "sonner";

// ── Types ──

interface DataProductSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: {
    type: "state" | "district";
    data: VoterImpactState | VoterImpactDistrict;
  };
}

// ── Helpers ──

function isDistrict(data: VoterImpactState | VoterImpactDistrict): data is VoterImpactDistrict {
  return "cd_code" in data;
}

function getRegionInfo(region: DataProductSelectorProps["region"]) {
  const { type, data } = region;
  if (type === "district" && isDistrict(data)) {
    return {
      geoType: "district" as const,
      geoCode: data.cd_code,
      geoName: data.cd_code,
      muslimVoters: data.muslim_voters,
      cellPhones: data.cell_phones,
      households: data.households,
    };
  }
  const state = data as VoterImpactState;
  return {
    geoType: "state" as const,
    geoCode: state.state_code,
    geoName: state.state_name,
    muslimVoters: state.muslim_voters,
    cellPhones: state.cell_phones,
    households: state.households,
  };
}

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  mailers: <Mail className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
  ctv: <Tv className="h-4 w-4" />,
  digital_ads: <Monitor className="h-4 w-4" />,
  phone_lists: <PhoneCall className="h-4 w-4" />,
};

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Component ──

export function DataProductSelector({ open, onOpenChange, region }: DataProductSelectorProps) {
  const { data: products = [] } = useDataProducts();
  const addToCart = useAddToCart();
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  const regionInfo = useMemo(() => getRegionInfo(region), [region]);

  // Map source_field to actual record count from the region
  function getRecordCount(sourceField: string): number {
    switch (sourceField) {
      case "households": return regionInfo.households;
      case "cell_phones": return regionInfo.cellPhones;
      case "muslim_voters": return regionInfo.muslimVoters;
      default: return 0;
    }
  }

  const toggleProduct = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectedProducts = products.filter((p) => selectedSlugs.has(p.slug));
  const subtotal = selectedProducts.reduce((sum, p) => {
    return sum + getRecordCount(p.source_field) * p.price_per_record;
  }, 0);

  const handleAddToCart = async () => {
    const items = selectedProducts.map((p) => ({
      product_id: p.id,
      geo_type: regionInfo.geoType,
      geo_code: regionInfo.geoCode,
      geo_name: regionInfo.geoName,
      record_count: getRecordCount(p.source_field),
    }));

    try {
      await addToCart.mutateAsync(items);
      toast.success(`${items.length} product(s) added to cart`);
      setSelectedSlugs(new Set());
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to add to cart. Please try again.");
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] max-h-[85vh]">
        <DrawerHeader className="border-b border-[#1e2a45] pb-4">
          <DrawerTitle className="text-[#e2e8f0] text-lg">
            Get Data for {regionInfo.geoName}
          </DrawerTitle>
          <DrawerDescription className="text-[#64748b]">
            Select the data products you'd like to purchase for this region.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 py-4 space-y-3 overflow-y-auto flex-1">
          {products.map((product) => {
            const count = getRecordCount(product.source_field);
            const isAvailable = count > 0;
            const isChecked = selectedSlugs.has(product.slug);
            const lineTotal = count * product.price_per_record;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => isAvailable && toggleProduct(product.slug)}
                disabled={!isAvailable}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  !isAvailable
                    ? "opacity-40 cursor-not-allowed border-[#1e2a45] bg-[#0a0f1a]/50"
                    : isChecked
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-[#1e2a45] bg-[#0a0f1a] hover:border-[#2d3b55]"
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={!isAvailable}
                  className="mt-0.5 pointer-events-none"
                  aria-label={`Select ${product.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#94a3b8]">
                      {PRODUCT_ICONS[product.slug] || <Monitor className="h-4 w-4" />}
                    </span>
                    <span className="font-medium text-sm text-[#e2e8f0]">{product.name}</span>
                  </div>
                  <p className="text-xs text-[#64748b] mb-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94a3b8]">
                      {isAvailable ? `${formatNumber(count)} records` : "No data available"}
                    </span>
                    {isAvailable && (
                      <span className="text-xs font-medium text-[#e2e8f0]">
                        {formatCurrency(lineTotal)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DrawerFooter className="border-t border-[#1e2a45] pt-4">
          {selectedProducts.length > 0 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm text-[#94a3b8]">
                {selectedProducts.length} product(s) selected
              </span>
              <span className="text-lg font-bold text-[#e2e8f0]">{formatCurrency(subtotal)}</span>
            </div>
          )}
          <Button
            onClick={handleAddToCart}
            disabled={selectedProducts.length === 0 || addToCart.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {addToCart.isPending ? "Adding..." : "Add to Cart"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full border-[#1e2a45] text-[#94a3b8] hover:bg-[#1e2a45]">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
