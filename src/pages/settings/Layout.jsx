import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { User, Shield, Bell, Palette, CreditCard, ChevronRight } from "lucide-react";

const SETTINGS_NAV = [
  { label: "Profile",       icon: User,       path: "/settings" },
  { label: "Security",      icon: Shield,     path: "/settings/security" },
  { label: "Notifications", icon: Bell,       path: "/settings/notifications" },
  { label: "Appearance",    icon: Palette,    path: "/settings/appearance" },
  { label: "Payment Methods", icon: CreditCard, path: "/settings/payments" },
];

export default function SettingsLayout() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences and configuration</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings sidebar */}
        <aside className="w-full md:w-56 shrink-0">
          <nav className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {SETTINGS_NAV.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/settings"}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-border/30 last:border-0 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Settings content */}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
