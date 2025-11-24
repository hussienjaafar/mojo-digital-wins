import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        ghost: "border-0 bg-transparent hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
        filled: "border-0 bg-muted/50 hover:bg-muted/70 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        outline: "border-2 border-input bg-transparent focus-visible:border-primary focus-visible:outline-none",
        smooth: "border border-input/50 bg-background/50 backdrop-blur-sm hover:border-input focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-md",
        glass: "backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 focus-visible:bg-white/15 dark:focus-visible:bg-white/10 focus-visible:border-white/30 focus-visible:outline-none",
      },
      inputSize: {
        default: "h-11 min-h-[44px]",
        sm: "h-9 min-h-[36px] text-sm",
        lg: "h-12 min-h-[48px]",
        xl: "h-14 min-h-[56px] text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
