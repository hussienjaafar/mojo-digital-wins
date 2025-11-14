import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";

type Props = {
  userEmail: string;
  organizationName?: string;
  onLogout: () => void;
};

export const UserProfileMenu = ({
  userEmail,
  organizationName,
  onLogout,
}: Props) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const initials = userEmail.substring(0, 2).toUpperCase();

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  const MenuContent = () => (
    <div className="space-y-2">
      <div className="px-2 py-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{userEmail}</div>
            {organizationName && (
              <div className="text-sm text-muted-foreground truncate">
                {organizationName}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1 px-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[50vh]">
          <SheetHeader>
            <SheetTitle>Account</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <MenuContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <MenuContent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
