import React from "react";
import { Bell, Search, Wallet, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function TopBar({ portfolioTotal, isLoading, lastUpdated, onRefresh, onWithdraw }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">BT</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight">
            Blockchain <span className="text-primary">Tradex</span>
          </h1>
        </Link>
        <div className="hidden lg:flex items-center gap-4 ml-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
          <Link to="/transactions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Transactions</Link>
          <Link to="/analytics" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Analytics</Link>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-2 w-72">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search markets..."
          className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="hidden lg:block text-xs text-muted-foreground">
            Live • {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <div className="hidden sm:flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {isLoading ? "..." : `$${portfolioTotal?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <Button
          onClick={onWithdraw}
          variant="outline"
          className="hidden sm:flex border-primary/40 text-primary hover:bg-primary/10 gap-2"
        >
          <ArrowUpRight className="w-4 h-4" />
          Withdraw
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={onRefresh} title="Refresh prices">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">U</span>
        </div>
      </div>
    </div>
  );
}