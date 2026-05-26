import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { 
  LayoutDashboard, Users, TreePine, FileText, Briefcase, 
  Wrench, BarChart3, Menu, X, ChevronRight, ScanSearch, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/leads", label: "Leads", icon: Users },
  { path: "/customers", label: "Customers", icon: TreePine },
  { path: "/quotes", label: "Quotes", icon: FileText },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/equipment", label: "Equipment", icon: Wrench },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/sales", label: "Sales", icon: TrendingUp },
  { path: "/tree-assessment", label: "AI Assessment", icon: ScanSearch },
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
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div className={cn("p-4 border-b border-sidebar-border flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
            <TreePine className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">TreePro AI</h1>
              <p className="text-[11px] text-sidebar-foreground/50">Tree Service Management</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.path} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
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

      {/* Mobile Header + Overlay */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-card border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <TreePine className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">TreePro AI</span>
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar">
              <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center">
                    <TreePine className="w-5 h-5 text-sidebar-primary-foreground" />
                  </div>
                  <h1 className="text-base font-bold text-sidebar-foreground">TreePro AI</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="p-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />
                ))}
              </nav>
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}