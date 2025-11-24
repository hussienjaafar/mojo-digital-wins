import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const skeletonVariants = cva(
  "relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "animate-pulse rounded-md bg-muted",
        shimmer: "rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer",
        wave: "rounded-md bg-muted before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-100%] before:animate-wave",
        pulse: "animate-pulse rounded-md bg-muted/80",
      },
      shape: {
        default: "",
        circle: "rounded-full aspect-square",
        text: "h-4 rounded",
        heading: "h-8 rounded",
        button: "h-10 rounded-md",
        card: "h-32 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "shimmer",
      shape: "default",
    },
  },
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {}

function Skeleton({ className, variant, shape, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ variant, shape, className }))}
      {...props}
    />
  );
}

export { Skeleton, skeletonVariants };
