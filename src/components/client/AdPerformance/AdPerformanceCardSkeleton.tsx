import React from 'react';
import { V3Card } from '../../../design-system/V3Card'; // Assuming path to V3Card

export const AdPerformanceCardSkeleton: React.FC = () => {
  return (
    <V3Card className="p-4 flex flex-col space-y-4 animate-pulse">
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-gray-300 rounded"></div> {/* Thumbnail placeholder */}
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div> {/* Ref code placeholder */}
          <div className="h-3 bg-gray-300 rounded w-1/2"></div> {/* Status placeholder */}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="h-8 bg-gray-200 rounded"></div> {/* Metric chip placeholder */}
        <div className="h-8 bg-gray-200 rounded"></div> {/* Metric chip placeholder */}
        <div className="h-8 bg-gray-200 rounded"></div> {/* Metric chip placeholder */}
      </div>
      <div className="h-4 bg-gray-200 rounded w-full"></div> {/* Message details header placeholder */}
    </V3Card>
  );
};