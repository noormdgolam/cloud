import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, usedBytes: true, quotaBytes: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-4 px-4 py-4 sm:px-6">
      <Sidebar
        userName={user.name}
        userEmail={user.email}
        usedBytes={user.usedBytes}
        quotaBytes={user.quotaBytes}
      />
      <main className="min-w-0 flex-1 py-2">{children}</main>
    </div>
  );
}
