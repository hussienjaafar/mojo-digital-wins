import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { ClientComingSoon } from "./ClientComingSoon";
import { V3LoadingState } from "@/components/v3";

interface ProductionGateProps {
  children: ReactNode;
  title: string;
  description: string;
  icon?: LucideIcon;
}

/**
 * ProductionGate - Conditionally renders content based on user role.
 * 
 * - Admins see the full page content (children)
 * - Regular organization users see a "Coming Soon" message
 * 
 * This allows admins to test pages in production while clients
 * see polished placeholder messages for non-production pages.
 */
export function ProductionGate({ children, title, description, icon }: ProductionGateProps) {
  const { isAdmin, isLoading } = useIsAdmin();

  // Show loading state while checking role
  if (isLoading) {
    return (
      <div className="p-6">
        <V3LoadingState variant="card" height={400} />
      </div>
    );
  }

  // Admins see the full page content
  if (isAdmin) {
    return <>{children}</>;
  }

  // Regular users see Coming Soon
  return (
    <ClientComingSoon
      title={title}
      description={description}
      icon={icon}
    />
  );
}
