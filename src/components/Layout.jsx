import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import AppChatbot from "@/components/AppChatbot";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard, Users, TreePine, FileText, Briefcase,
  Wrench, BarChart3, Menu, X, ChevronRight, ScanSearch, TrendingUp,
  HardHat, Settings, Receipt, Bell, CheckSquare, Building2, Shield, Plug,
  Palette, Globe, Key, Webhook as WebhookIcon, DollarSign, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// adminOnly: true = hidden from non-admin users in the sidebar
const navGroups = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard },
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Sales",
    items: [
      { path: "/field", label: "Field Mode 📱", icon: HardHat },
      { path: "/leads", label: "Leads", icon: Users },
      { path: "/customers", label: "Customers", icon: TreePine },
      { path: "/quotes", label: "Quotes", icon: FileText },
      { path: "/sales", label: "Sales Pipeline", icon: TrendingUp },
    ],
  },
  {
    label: "Operations",
    items: [
      { path: "/jobs", label: "Jobs", icon: Briefcase },
      { path: "/crew-mode", label: "Crew Mode", icon: HardHat },
      { path: "/equipment", label: "Equipment", icon: Wrench },
      { path: "/maintenance", label: "Maintenance", icon: CheckSquare },
      { path: "/invoices", label: "Invoices", icon: Receipt },
      { path: "/payroll", label: "Payroll", icon: DollarSign },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { path: "/tree-assessment", label: "AI Assessment", icon: ScanSearch },
      { path: "/ai-analysis", label: "AI Analysis", icon: ScanSearch },
      { path: "/ai-insights", label: "AI Insights", icon: TrendingUp },
      { path: "/tree-inventory", label: "Tree Inventory", icon: TreePine },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { path: "/employees", label: "Team", icon: Users },
      { path: "/integrations", label: "Integrations", icon: Plug },
      { path: "/settings", label: "Company Settings", icon: Building2 },
      { path: "/white-label", label: "White-Label", icon: Palette },
      { path: "/widget-settings", label: "Public Widget", icon: Globe },
      { path: "/api-keys", label: "API Keys", icon: Key },
      { path: "/webhooks", label: "Webhooks", icon: WebhookIcon },
      { path: "/audit-log", label: "Audit Log", icon: Shield },
      { path: "/production-readiness", label: "Go-Live Checklist", icon: CheckSquare },
    ],
  },
];

function NavLink({ item, collapsed, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NotificationBell() {
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications_unread"],
    queryFn: () => base44.entities.Notification.filter({ read: false }),
    refetchInterval: 30000,
  });
  const count = notifications.length;

  return (
    <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
      <Bell className="w-5 h-5 text-sidebar-foreground/70" />
      {count > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  const visibleNavGroups = navGroups.filter(g => !g.adminOnly || isAdmin);

  const SidebarContent = ({ onNavClick }) => (
    <>
      <div className={cn("p-4 border-b border-sidebar-border flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <img
          src="https://media.base44.com/images/public/6a15950f5b2c54c351adcf3c/28062c759_17594553825842.jpg"
          alt="TreePro AI"
          className="w-9 h-9 rounded-full shrink-0 object-cover ring-2 ring-sidebar-primary/40"
        />
        {!collapsed && (
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">TreePro AI</h1>
            <p className="text-[11px] text-sidebar-foreground/50">Tree Service Platform</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <p className="px-3 py-1 text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.path} item={item} collapsed={collapsed} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border">
          <Link
            to="/estimate"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <TreePine className="w-3.5 h-3.5" />
            Public Estimate Page ↗
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        <SidebarContent onNavClick={null} />
        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronRight className={cn("w-4 h-4 transition-transform", collapsed ? "" : "rotate-180")} />
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col">
            <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="https://media.base44.com/images/public/6a15950f5b2c54c351adcf3c/28062c759_17594553825842.jpg"
                  alt="TreePro AI"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-sidebar-primary/40"
                />
                <h1 className="text-base font-bold text-sidebar-foreground">TreePro AI</h1>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="p-3 space-y-0.5">
                {visibleNavGroups.map((group) => (
                  <div key={group.label} className="mb-3">
                    <p className="px-3 py-1 text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="w-5 h-5" />
          </Button>
          {!isHome && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="flex items-center gap-2 lg:hidden">
            <img
              src="https://media.base44.com/images/public/6a15950f5b2c54c351adcf3c/28062c759_17594553825842.jpg"
              alt="TreePro AI"
              className="w-7 h-7 rounded-full object-cover"
            />
            <span className="font-bold text-sm">TreePro AI</span>
          </div>
          <div className="flex-1" />
          <NotificationBell />
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end leading-none">
                <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{user.full_name || user.email}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${isAdmin ? "text-amber-600" : "text-muted-foreground"}`}>{user.role || "user"}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => logout(true)} className="text-xs text-muted-foreground hover:text-destructive h-8 px-2">
                Sign out
              </Button>
            </div>
          )}
          {isAdmin && (
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </Button>
            </Link>
          )}
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <AppChatbot user={user} />
    </div>
  );
}