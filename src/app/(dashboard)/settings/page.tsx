import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageBreakdown } from "@/lib/data/storage-breakdown";
import { getOrCreateReferralCode } from "@/lib/referral";
import { siteUrl } from "@/lib/site-url";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { PasswordForm } from "@/components/dashboard/PasswordForm";
import { DeleteAccountDialog } from "@/components/dashboard/DeleteAccountDialog";
import { StorageBreakdown } from "@/components/dashboard/StorageBreakdown";
import { ReferralCard } from "@/components/dashboard/ReferralCard";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  const [breakdown, referralCode, referralCount, bonus] = await Promise.all([
    getStorageBreakdown(session.user.id),
    getOrCreateReferralCode(session.user.id),
    prisma.user.count({ where: { referredById: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { bonusBytes: true } }),
  ]);

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

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Storage breakdown</h2>
        <p className="mt-1 text-sm text-ink-muted">What&apos;s using your space.</p>
        <div className="mt-4">
          <StorageBreakdown rows={breakdown} />
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="text-sm font-semibold text-ink">Refer & earn</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Share your link — you and your friend each get free bonus storage when they join.
        </p>
        <div className="mt-4">
          <ReferralCard
            code={referralCode}
            referralCount={referralCount}
            bonusBytes={bonus?.bonusBytes ?? BigInt(0)}
            origin={siteUrl()}
          />
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        <a
          href="/settings/billing"
          className="flex items-center justify-between gap-3 p-5 hover:bg-[var(--glass-surface-hover)]"
        >
          <div>
            <h2 className="text-sm font-semibold text-ink">Storage plan</h2>
            <p className="mt-1 text-sm text-ink-muted">View or upgrade your storage.</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
        </a>
      </GlassCard>

      <GlassCard className="border-danger/30 p-5">
        <h2 className="text-sm font-semibold text-danger">Danger zone</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Permanently delete your account and every file you&apos;ve uploaded. This can&apos;t be undone.
        </p>
        <div className="mt-4">
          <DeleteAccountDialog email={user.email} />
        </div>
      </GlassCard>
    </div>
  );
}
