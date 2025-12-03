import { Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

type Props = {
  organizations: Organization[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export const OrganizationSelector = ({
  organizations,
  selectedId,
  onSelect,
}: Props) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const selectedOrg = organizations.find((org) => org.id === selectedId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  const OrganizationList = () => (
    <div className="space-y-2">
      {organizations.map((org) => (
        <button
          key={org.id}
          onClick={() => handleSelect(org.id)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
            "hover:bg-accent",
            selectedId === org.id && "bg-accent"
          )}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={org.logo_url || undefined} />
            <AvatarFallback>
              {org.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left">
            <div className="font-medium">{org.name}</div>
            {org.role && (
              <div className="text-xs text-muted-foreground capitalize">
                {org.role}
              </div>
            )}
          </div>
          {selectedId === org.id && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </button>
      ))}
    </div>
  );

  if (organizations.length === 0) {
    return null;
  }

  if (organizations.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={organizations[0].logo_url || undefined} />
          <AvatarFallback>
            {organizations[0].name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {!isMobile && (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{organizations[0].name}</span>
            {organizations[0].role && (
              <span className="text-xs text-muted-foreground capitalize">
                {organizations[0].role}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Building2 className="h-4 w-4" />
            {selectedOrg ? selectedOrg.name : "Select Organization"}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Switch Organization</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <OrganizationList />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedOrg?.logo_url || undefined} />
            <AvatarFallback>
              {selectedOrg?.name.substring(0, 2).toUpperCase() || "OR"}
            </AvatarFallback>
          </Avatar>
          <span>{selectedOrg?.name || "Select Organization"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2">
          <OrganizationList />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
