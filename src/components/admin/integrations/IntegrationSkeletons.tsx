import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Shimmer({ className }: SkeletonProps) {
  return (
    <motion.div
      className={cn(
        "bg-[hsl(var(--portal-bg-elevated))] rounded",
        className
      )}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export function SystemHealthSkeleton() {
  return (
    <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] p-6">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Health Score Ring */}
        <div className="flex items-center gap-6">
          <Shimmer className="w-[120px] h-[120px] rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-6 w-32" />
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-4 w-36" />
          </div>
        </div>

        {/* Distribution Bars */}
        <div className="flex-1 space-y-4 min-w-[200px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Shimmer className="h-4 w-20" />
                <Shimmer className="h-4 w-8" />
              </div>
              <Shimmer className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-col gap-2 lg:border-l lg:border-[hsl(var(--portal-border))] lg:pl-6">
          <Shimmer className="h-3 w-20 mb-2" />
          <Shimmer className="h-9 w-40 rounded-md" />
          <Shimmer className="h-9 w-40 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function DiscoveryBarSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <Shimmer className="h-10 flex-1 rounded-md" />
        <Shimmer className="h-10 w-[180px] rounded-md" />
        <Shimmer className="h-10 w-[140px] rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function OrgRowSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]"
    >
      {/* Health dot */}
      <Shimmer className="w-6 h-6 rounded-full" />
      
      {/* Org info */}
      <div className="flex-1 min-w-0 space-y-2">
        <Shimmer className="h-5 w-48" />
        <Shimmer className="h-3 w-32" />
      </div>

      {/* Platform icons */}
      <div className="flex items-center gap-1">
        <Shimmer className="w-5 h-5 rounded" />
        <Shimmer className="w-5 h-5 rounded" />
      </div>

      {/* Count badge */}
      <Shimmer className="h-6 w-8 rounded-full" />

      {/* Chevron */}
      <Shimmer className="h-5 w-5 rounded" />
    </motion.div>
  );
}

export function OrgListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <OrgRowSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

export function DetailCardSkeleton() {
  return (
    <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] border-l-4 border-l-[hsl(var(--portal-border))] p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Shimmer className="w-8 h-8 rounded" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-8 w-20 rounded-md" />
        <Shimmer className="h-8 w-24 rounded-md" />
        <div className="ml-auto">
          <Shimmer className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <DetailCardSkeleton key={i} />
      ))}
    </div>
  );
}
