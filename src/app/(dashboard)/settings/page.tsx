import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { PasswordForm } from "@/components/dashboard/PasswordForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-ink">Settings</h1>

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        <div className="mt-4">
          <ProfileForm defaultName={user.name ?? ""} />
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Password</h2>
        {user.passwordHash ? (
          <>
            <p className="mt-1 text-sm text-ink-muted">Change your password.</p>
            <div className="mt-4">
              <PasswordForm />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">
            This account signs in with Google or GitHub — there&apos;s no password to manage.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
