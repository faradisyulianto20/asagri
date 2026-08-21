import {
  LayoutDashboard,
  BarChart3,
  Cpu,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export type SidebarTab =
  | "dashboard"
  | "analytics"
  | "devices"
  | "notifications"
  | "settings"
  | "help";

interface NavItem {
  id: SidebarTab;
  label: string;
  icon: LucideIcon;
}

const mainNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({
  active,
  onNavigate,
  username,
  onLogout,
  open,
  onToggle,
}: {
  active: SidebarTab;
  onNavigate: (tab: SidebarTab) => void;
  username: string;
  onLogout: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const handleNav = (tab: SidebarTab) => {
    onNavigate(tab);
    if (window.innerWidth < 1024) onToggle();
  };

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 py-5">
          <img
            src="/logo.png"
            alt="Logo Asagri"
            className="size-10 rounded-xl object-cover shadow-md shadow-primary/20"
          />
          <div>
            <h1 className="font-heading text-base font-extrabold tracking-tight text-foreground">
              Asagri Admin
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Monitor &amp; Control
            </p>
          </div>
        </div>

        <Separator />

        {/* Main Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 outline-none",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <Separator />

        {/* Bottom Section */}
        <div className="space-y-1 px-3 py-4">
          <button
            type="button"
            onClick={() => handleNav("help")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 outline-none",
              active === "help"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <HelpCircle className="size-4" />
            Help Center
          </button>

          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
            <Sprout className="size-4 shrink-0 text-primary" />
            <span className="flex-1 truncate text-xs font-medium text-foreground">
              Admin: {username}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-destructive hover:underline"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
