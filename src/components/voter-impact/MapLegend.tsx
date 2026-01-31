import React from 'react';

/**
 * MapLegend Component
 *
 * Displays the color scale legend for the voter impact map.
 * Shows impact potential levels: Low (red), Medium (yellow), High (green), None (gray).
 */

export const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-[#141b2d]/90 backdrop-blur-sm rounded-lg border border-[#1e2a45] p-3">
      <div className="text-xs text-[#64748b] uppercase tracking-wide mb-2">
        Impact Potential
      </div>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded-sm bg-[#ef4444]" />
          <span className="text-xs text-[#64748b]">Low</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#eab308]" />
          <span className="text-xs text-[#64748b]">Medium</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#22c55e]" />
          <span className="text-xs text-[#64748b]">High</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#374151]" />
          <span className="text-xs text-[#64748b]">None</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;
