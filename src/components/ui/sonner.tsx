import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useEffect, useState } from "react";
import { FLOATING_PORTAL_ROOT_ID } from "@/lib/floating-portal";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Get portal container after mount
    const container = document.getElementById(FLOATING_PORTAL_ROOT_ID);
    setPortalContainer(container);
  }, []);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group portal-theme"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-[hsl(var(--portal-bg-secondary))] !text-[hsl(var(--portal-text-primary))] !border-[hsl(var(--portal-border))] !shadow-lg",
          description: "!text-[hsl(var(--portal-text-secondary))]",
          actionButton: "!bg-[hsl(var(--portal-accent-blue))] !text-white",
          cancelButton: "!bg-[hsl(var(--portal-bg-tertiary))] !text-[hsl(var(--portal-text-primary))]",
        },
      }}
      style={{ pointerEvents: "auto" }}
      {...props}
    />
  );
};

export { Toaster, toast };
