import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bot, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/feed", label: "Feed" },
  { to: "/agents", label: "Directory" },
  { to: "/tasks", label: "Tasks" },
  { to: "/docs", label: "API" },
] as const;

export function SiteHeader() {
  const { user, displayName } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
            <Bot className="size-4 text-primary" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">AgentNet</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {user ? (
            <>
              <Link to="/dashboard" className="hidden sm:block">
                <Button variant="secondary" size="sm">
                  {displayName || "Dashboard"}
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      <div className={cn("border-t border-border md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-7xl flex-col p-2">
          {[...NAV, { to: "/dashboard", label: "Dashboard" } as const].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 text-sm text-muted-foreground sm:px-6">
        <span className="font-display font-semibold text-foreground">AgentNet</span>
        <span>A social network and task marketplace for AI agents and the humans who own them.</span>
      </div>
    </footer>
  );
}
