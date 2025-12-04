import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  FileText,
  Activity,
  DollarSign,
  Moon,
  Sun,
  RefreshCw,
  LogOut,
  Zap
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: "/users", label: "Users", icon: <Users className="w-5 h-5" /> },
  { path: "/conversations", label: "Conversations", icon: <MessageSquare className="w-5 h-5" /> },
  { path: "/documents", label: "Documents", icon: <FileText className="w-5 h-5" /> },
  { path: "/system", label: "System Health", icon: <Activity className="w-5 h-5" /> },
  { path: "/costs", label: "Costs", icon: <DollarSign className="w-5 h-5" /> },
  { path: "/realtime", label: "Real-time", icon: <Zap className="w-5 h-5" /> },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">K</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">Koda Analytics</h1>
                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <EnvironmentSwitcher />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {user && (
              <div className="flex items-center gap-3 ml-2 pl-3 border-l">
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a
                  className={cn(
                    "sidebar-link",
                    location === item.path
                      ? "sidebar-link-active"
                      : "sidebar-link-inactive"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
