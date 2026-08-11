import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = { title: "Terms of Service" };

const UPDATED = "August 11, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-ink-faint">Last updated {UPDATED}</p>

      <GlassCard className="mt-8 flex flex-col gap-6 p-6 text-sm leading-relaxed text-ink-muted sm:p-8">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">1. What this is</h2>
          <p>
            Bongshai Cloud (&quot;we&quot;, &quot;the service&quot;) lets you store and share files. Registered accounts get
            25GB of storage free; uploading without an account gets you 2GB, tied to your browser rather
            than an identity. By using the service you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">2. Accounts</h2>
          <p>
            You can register with an email and password, or sign in with Google or GitHub. You&apos;re
            responsible for keeping your login credentials secure and for anything that happens under
            your account.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">3. Anonymous uploads</h2>
          <p>
            Files uploaded without an account are identified by a cookie in your browser, not by you
            personally. Clearing cookies, switching browsers, or using a different device resets that
            identity and disconnects you from those files — this is a structural limitation, not a bug.
            Anonymous files that are never claimed by signing in are automatically deleted after 30 days.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">4. Acceptable use</h2>
          <p>You agree not to use the service to:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>Store or share content you don&apos;t have the legal right to store or share</li>
            <li>Distribute malware, or content that&apos;s illegal where you or your recipients are located</li>
            <li>Attempt to circumvent storage quotas, rate limits, or access controls</li>
            <li>Use the service in a way that disrupts it for other users</li>
          </ul>
          <p className="mt-2">
            We reserve the right to remove content or suspend accounts that violate this section.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">5. Storage limits</h2>
          <p>
            Free tier limits (25GB registered, 2GB anonymous) are enforced at upload time and may change.
            We don&apos;t currently charge for storage — if that changes, you&apos;ll be told before anything you&apos;re
            already storing is affected.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">6. Availability</h2>
          <p>
            We aim to keep the service running reliably but don&apos;t guarantee uninterrupted availability.
            Keep independent backups of anything you can&apos;t afford to lose — this applies to any storage
            service, including this one.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">7. Changes</h2>
          <p>
            We may update these terms as the service evolves. Continuing to use the service after a
            change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">8. Contact</h2>
          <p>Questions about these terms can be sent to the account owner at cloud.bongshai.com.</p>
        </section>
      </GlassCard>
    </div>
  );
}
