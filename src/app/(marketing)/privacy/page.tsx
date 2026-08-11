import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = { title: "Privacy Policy" };

const UPDATED = "August 11, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-faint">Last updated {UPDATED}</p>

      <GlassCard className="mt-8 flex flex-col gap-6 p-6 text-sm leading-relaxed text-ink-muted sm:p-8">
        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">What we store</h2>
          <p>For registered accounts: your name, email address, and (if you sign up with a password)
            a securely hashed password — never the password itself. If you sign in with Google or GitHub,
            we receive your name, email, and profile image from them.</p>
          <p className="mt-2">
            For everyone: the files you upload, their names, sizes, and upload times, and how much of
            your storage quota you&apos;ve used. Anonymous uploads are tied to a random identifier stored in a
            browser cookie, not to any personal information.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">How we use it</h2>
          <p>
            Strictly to run the service: authenticating you, enforcing storage quotas, serving your files
            back to you, and generating share links when you ask us to. We don&apos;t sell your data or use it
            for advertising.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Who can see your files</h2>
          <p>
            Only you, unless you explicitly create a share link — anyone with that link can access the
            file until it&apos;s revoked or expires. Files are stored outside any public path and are never
            reachable by guessing a URL.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Retention and deletion</h2>
          <p>
            Deleting a file removes it immediately. Anonymous uploads that are never claimed by signing
            in are automatically deleted after 30 days. Deleting your account removes your files and
            account data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Cookies</h2>
          <p>
            We use cookies for session authentication (staying signed in) and, for visitors without an
            account, to identify your anonymous storage session. We don&apos;t use tracking or advertising
            cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Third parties</h2>
          <p>
            If you sign in with Google or GitHub, that authentication happens directly with them under
            their own privacy policies. We don&apos;t share your data with any other third party.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-ink">Your rights</h2>
          <p>
            You can review and delete your own files at any time from your dashboard. To request a full
            account deletion or a copy of your data, contact the account owner at cloud.bongshai.com.
          </p>
        </section>
      </GlassCard>
    </div>
  );
}
