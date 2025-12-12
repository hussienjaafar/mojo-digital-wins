import { ReactNode } from "react";
import { ClientShell, ClientShellProps } from "@/components/client/ClientShell";

/**
 * ClientLayout - Backward-compatible wrapper around ClientShell
 *
 * @deprecated Use ClientShell directly for new components.
 * This wrapper exists for backward compatibility with existing pages.
 *
 * @example
 * // Preferred (new code):
 * <ClientShell showDateControls={false}>
 *   <PageContent />
 * </ClientShell>
 *
 * // Legacy (still works):
 * <ClientLayout>
 *   <PageContent />
 * </ClientLayout>
 */

interface ClientLayoutProps extends Omit<ClientShellProps, "children"> {
  children: ReactNode;
}

export const ClientLayout = ({ children, ...props }: ClientLayoutProps) => {
  return <ClientShell {...props}>{children}</ClientShell>;
};
