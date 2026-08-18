import AppSidebar from "./SidebarNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <AppSidebar>{children}</AppSidebar>;
}
