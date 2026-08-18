"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, PanelLeft, UserPlus, Users, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

const NAV_ITEMS = [
  { heading: "All parents", href: "/", icon: <Users className="size-4" /> },
  { heading: "Add parent", href: "/parents/new", icon: <UserPlus className="size-4" /> },
];

function Brand() {
  return (
    <div className="flex min-h-11 items-center gap-3 overflow-hidden px-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-b from-[#54a2ff] to-[#155dfc] text-sm font-bold text-white shadow-sm">
        H
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold tracking-tight">
          HaalChaal
        </span>
        <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Wellness check-ins
        </span>
      </span>
      <AnimatedSidebarClose className="ml-auto text-muted-foreground hover:bg-muted md:hidden">
        <X className="size-4" />
      </AnimatedSidebarClose>
    </div>
  );
}

function SignOutItem() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AnimatedSidebarMenuButton
      icon={<LogOut className="size-4" />}
      onSelect={handleSignOut}
    >
      Sign out
    </AnimatedSidebarMenuButton>
  );
}

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <AnimatedSidebarProvider defaultOpen>
      <AnimatedSidebar
        ariaLabel="HaalChaal navigation"
        variant="floating"
        collapsible="none"
        panelClassName="m-3 h-[calc(100svh-1.5rem)] w-[calc(100%-1.5rem)] border-border shadow-md"
      >
        <AnimatedSidebarHeader className="p-4 pb-2">
          <Brand />
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent className="px-3 pt-1">
          <AnimatedSidebarGroup>
            <AnimatedSidebarGroupLabel>Navigate</AnimatedSidebarGroupLabel>
            <AnimatedSidebarMenu>
              {NAV_ITEMS.map((item) => (
                <AnimatedSidebarMenuItem key={item.href}>
                  <AnimatedSidebarMenuButton
                    href={item.href}
                    icon={item.icon}
                    isActive={isActive(item.href)}
                  >
                    {item.heading}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroup>
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter className="gap-3 border-none p-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SignOutItem />
            </div>
            <ThemeToggle />
          </div>
        </AnimatedSidebarFooter>
      </AnimatedSidebar>

      <AnimatedSidebarInset className="bg-background">
        <header className="flex h-14 shrink-0 items-center gap-3 border-border border-b px-4 md:hidden">
          <AnimatedSidebarTrigger className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <PanelLeft className="size-4" />
          </AnimatedSidebarTrigger>
          <p className="text-sm font-medium">HaalChaal</p>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          <div className="mx-auto max-w-4xl">{children}</div>
        </div>
      </AnimatedSidebarInset>
    </AnimatedSidebarProvider>
  );
}