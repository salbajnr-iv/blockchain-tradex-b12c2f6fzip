import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, ArrowUpDown, Bell, CreditCard, History,
  ArrowUpRight, Menu, X, RefreshCw, LogOut, PlusCircle, LineChart, Search,
  ChevronDown, Wallet, TrendingUp, ShieldCheck, Settings, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import WithdrawalSidebar from "@/components/crypto/WithdrawalSidebar";
import DepositDialog from "@/components/crypto/DepositDialog";
import NotificationCenter from "@/components/crypto/NotificationCenter";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useQuery } from "@tanstack/react-query";
import { listAlerts } from "@/lib/api/alerts";

const NAV_SECTIONS = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard",    icon: LayoutDashboard, path: "/" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { label: "My Portfolio", icon: Wallet,      path: "/transactions" },
      { label: "Analytics",    icon: LineChart,   path: "/analytics" },
      { label: "Card",         icon: CreditCard,  path: "/card" },
    ],
  },
  {
    title: "Markets",
    items: [
      { label: "Markets",      icon: BarChart3,   path: "/markets" },
      { label: "Trade",        icon: ArrowUpDown, path: "/trade" },
      { label: "Alerts",       icon: Bell,        path: "/alerts" },
    ],
  },
  {
    title: "History",
    items: [
      { label: "Transactions", icon: History,     path: "/transactions" },
    ],
  },
];

function CoinSearch({ cryptoList }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const results = query.trim().length > 0
    ? cryptoList.filter((c) =>
        c.symbol.toUpperCase().includes(query.toUpperCase()) ||
        c.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (coin) => {
    setOpen(false);
    setQuery("");
    navigate(`/trade?coin=${coin.symbol}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); inputRef.current?.blur(); }
    if (e.key === "Enter" && results.length > 0) handleSelect(results[0]);
  };

  return (
    <div ref={containerRef} className="relative hidden lg:flex items-center w-72">
      <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 w-full border border-transparent focus-within:border-primary/30 transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search markets..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border/50 rounded-xl shadow-2xl z-50 overflow-hidden">
          {results.map((coin) => (
            <button
              key={coin.symbol}
              onClick={() => handleSelect(coin)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{coin.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                  <p className="text-xs text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground tabular-nums">
                  ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs font-medium ${coin.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                  {coin.change24h >= 0 ? "+" : ""}{coin.change24h?.toFixed(2)}%
                </p>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 border-t border-border/30 bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">Press Enter to trade {results[0]?.symbol} · Esc to close</p>
          </div>
        </div>
      )}

      {open && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border/50 rounded-xl shadow-2xl z-50 p-4 text-center">
          <p className="text-xs text-muted-foreground">No coins found for "{query}"</p>
        </div>
      )}
    </div>
  );
}

function SidebarSearch({ value, onChange }) {
  return (
    <div className="relative px-3 pb-3">
      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search features..."
        className="w-full bg-secondary/50 border border-border/50 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/40 transition-colors text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

function NavSection({ section, location, onNavigate, isOpen, onToggle, searchActive }) {
  const hasActiveItem = section.items.some(i => location.pathname === i.path);

  return (
    <div className="mb-1">
      {!searchActive && (
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${hasActiveItem ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"}`}
        >
          {section.title}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
        </button>
      )}
      {(isOpen || searchActive) && (
        <div className="px-2 space-y-0.5">
          {section.items.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={onNavigate}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  active ? "bg-primary/20" : "bg-secondary/60 group-hover:bg-secondary"
                }`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                </div>
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(NAV_SECTIONS.map(s => [s.title, true]))
  );

  const { portfolioTotal, isLoading, lastUpdated, refetch, cryptoList } = useLivePrices();
  const { cashBalance, portfolioId } = usePortfolio();
  const { user, signOut } = useAuth();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", portfolioId],
    queryFn: () => listAlerts(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
    refetchInterval: 30000,
  });

  const cryptoPrices = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.price; return acc; }, {});
  const cryptoChanges = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.change24h; return acc; }, {});

  const handleLogout = async () => {
    try { await signOut(); } catch (err) { console.error("Logout error:", err); }
  };

  const userInitial = user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";

  const isSearchActive = sidebarSearch.trim().length > 0;
  const filteredSections = isSearchActive
    ? NAV_SECTIONS.map(s => ({
        ...s,
        items: s.items.filter(i => i.label.toLowerCase().includes(sidebarSearch.toLowerCase())),
      })).filter(s => s.items.length > 0)
    : NAV_SECTIONS;

  const toggleSection = (title) => setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border/50 z-40 flex flex-col transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">BT</span>
            </div>
            <span className="text-base font-bold">
              Block<span className="text-primary">Trade</span>
            </span>
          </Link>
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User profile */}
        <div className="px-3 pt-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl bg-secondary/40">
            <div className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{userInitial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" title="Active" />
          </div>
        </div>

        {/* Search */}
        <div className="pt-3">
          <SidebarSearch value={sidebarSearch} onChange={setSidebarSearch} />
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto py-1 space-y-1 scrollbar-thin">
          {filteredSections.map((section) => (
            <NavSection
              key={section.title}
              section={section}
              location={location}
              onNavigate={() => setSidebarOpen(false)}
              isOpen={openSections[section.title] ?? true}
              onToggle={() => toggleSection(section.title)}
              searchActive={isSearchActive}
            />
          ))}
          {isSearchActive && filteredSections.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-4">No results for "{sidebarSearch}"</p>
          )}
        </nav>

        {/* Balance card + actions */}
        <div className="px-3 py-3 border-t border-border/50 space-y-3">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Portfolio Value</p>
                <p className="text-lg font-bold text-foreground">
                  {isLoading ? "—" : `$${portfolioTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary/60" />
            </div>
            <div className="border-t border-primary/10 pt-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Cash Balance</p>
                <p className={`text-sm font-semibold ${cashBalance === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                  ${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <ShieldCheck className="w-4 h-4 text-primary/40" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setDepositOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5 rounded-xl h-9"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Funds
            </Button>
            <Button
              onClick={() => setWithdrawOpen(true)}
              size="sm"
              className="bg-primary hover:bg-primary/90 gap-1.5 text-xs rounded-xl h-9"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw
            </Button>
          </div>
        </div>

        {/* Logout */}
        <div className="px-3 pb-4 pt-1 border-t border-border/30">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
          >
            <div className="w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <CoinSearch cryptoList={cryptoList} />
          <div className="flex items-center gap-3 ml-auto">
            {lastUpdated && (
              <span className="hidden lg:block text-xs text-muted-foreground">
                Live • {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={refetch} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <span className="hidden lg:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {displayName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <WithdrawalSidebar open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
      <NotificationCenter alerts={alerts} cryptoPrices={cryptoPrices} cryptoChanges={cryptoChanges} />
    </div>
  );
}
