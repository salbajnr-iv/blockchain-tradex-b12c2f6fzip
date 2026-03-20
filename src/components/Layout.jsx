import React, { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, BarChart3, ArrowUpDown, Bell, CreditCard, History, ArrowUpRight, Menu, X, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import WithdrawalSidebar from "@/components/crypto/WithdrawalSidebar";
import { useLivePrices } from "@/hooks/useLivePrices";

const NAV_ITEMS = [
  { label: "Dashboard",    icon: LayoutDashboard, path: "/" },
  { label: "Trade",        icon: ArrowUpDown,     path: "/trade" },
  { label: "Markets",      icon: BarChart3,        path: "/markets" },
  { label: "Alerts",       icon: Bell,             path: "/alerts" },
  { label: "Card",         icon: CreditCard,       path: "/card" },
  { label: "Transactions", icon: History,          path: "/transactions" },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { portfolioTotal, isLoading, lastUpdated, refetch } = useLivePrices();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-60 bg-card border-r border-border/50 z-40 flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>
        
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">BT</span>
            </div>
            <span className="text-base font-bold">
              Blockchain <span className="text-primary">Tradex</span>
            </span>
          </Link>
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Portfolio summary */}
        <div className="px-4 py-4 border-t border-border/50 space-y-3">
          <div className="bg-secondary/40 rounded-xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">Portfolio Value</p>
            <p className="text-lg font-bold">
              {isLoading ? "..." : `$${portfolioTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <Button
            onClick={() => setWithdrawOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 gap-2 text-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            Withdraw
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-2 w-72">
            <span className="text-xs text-muted-foreground">Search markets...</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {lastUpdated && (
              <span className="hidden lg:block text-xs text-muted-foreground">
                Live • {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={refetch} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">U</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <WithdrawalSidebar open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}