import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface V3PageContainerProps {
  /** Page icon */
  icon?: LucideIcon;
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Actions to render in header (date picker, export, sync buttons) */
  actions?: React.ReactNode;
  /** Breadcrumbs component */
  breadcrumbs?: React.ReactNode;
  /** Main content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Whether to animate content on mount */
  animate?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

export const V3PageContainer: React.FC<V3PageContainerProps> = ({
  icon: Icon,
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className,
  animate = true,
}) => {
  const Wrapper = animate ? motion.div : "div";
  const HeaderWrapper = animate ? motion.div : "div";
  const ContentWrapper = animate ? motion.div : "div";

  return (
    <Wrapper
      className={cn(
        "min-h-screen bg-[hsl(var(--portal-bg-base))]",
        "px-4 py-6 sm:px-6 lg:px-8",
        className
      )}
      {...(animate && {
        variants: containerVariants,
        initial: "hidden",
        animate: "visible",
      })}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && (
        <div className="mb-4 text-sm text-[hsl(var(--portal-text-muted))]">
          {breadcrumbs}
        </div>
      )}

      {/* Page Header */}
      <HeaderWrapper
        className="mb-8"
        {...(animate && { variants: itemVariants })}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--portal-accent-blue)/0.1)]">
                <Icon className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))] sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-1 text-sm text-[hsl(var(--portal-text-secondary))]">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex flex-wrap items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      </HeaderWrapper>

      {/* Main Content */}
      <ContentWrapper
        className="space-y-8"
        {...(animate && { variants: itemVariants })}
      >
        {children}
      </ContentWrapper>
    </Wrapper>
  );
};

V3PageContainer.displayName = "V3PageContainer";

// Sub-component for page sections with consistent spacing
interface V3PageSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const V3PageSection: React.FC<V3PageSectionProps> = ({
  children,
  className,
}) => {
  return (
    <motion.section
      className={cn("space-y-4", className)}
      variants={itemVariants}
    >
      {children}
    </motion.section>
  );
};

V3PageSection.displayName = "V3PageSection";
