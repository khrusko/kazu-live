import { AdminNav } from "@/components/admin-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminNav />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
