import { Check, Sparkles, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

type FeatureRow = {
  feature: string;
  bongshai: string | boolean;
  google: string | boolean;
  dropbox: string | boolean;
  wetransfer: string | boolean;
  highlight?: boolean;
};

const COMPARISON_DATA: FeatureRow[] = [
  {
    feature: "Free Permanent Storage",
    bongshai: "25 GB Free",
    google: "15 GB",
    dropbox: "2 GB",
    wetransfer: "0 GB (Expires in 7 days)",
    highlight: true,
  },
  {
    feature: "Instant Zero-Signup Uploads",
    bongshai: "2 GB Instant",
    google: false,
    dropbox: false,
    wetransfer: "2 GB (Temporary)",
    highlight: true,
  },
  {
    feature: "Built-in PDF Tools (Merge, OCR, Compress)",
    bongshai: true,
    google: false,
    dropbox: "Paid Only",
    wetransfer: false,
  },
  {
    feature: "In-Browser Word (.docx) & Excel (.xlsx) Editor",
    bongshai: true,
    google: "Google Docs Only",
    dropbox: "Limited Preview",
    wetransfer: false,
  },
  {
    feature: "Creator Revenue Share (Earn from views)",
    bongshai: "100% Ad Revenue Share",
    google: false,
    dropbox: false,
    wetransfer: false,
    highlight: true,
  },
  {
    feature: "Privacy EXIF & GPS Metadata Stripping",
    bongshai: true,
    google: false,
    dropbox: false,
    wetransfer: false,
  },
  {
    feature: "Recipient Download Experience",
    bongshai: "Instant (No account required)",
    google: "Permission / Account nags",
    dropbox: "Sign-in prompts",
    wetransfer: "Ad banner walls",
  },
  {
    feature: "Real-time VirusTotal Malware Scanning",
    bongshai: true,
    google: "Internal Only",
    dropbox: "Basic",
    wetransfer: "Basic",
  },
];

function RenderValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-3.5 stroke-[2.5]" />
      </span>
    ) : (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink-faint/10 text-ink-faint">
        <X className="size-3.5" />
      </span>
    );
  }
  return <span className="font-medium text-xs sm:text-sm">{value}</span>;
}

export function StorageComparisonTable() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20" id="comparison">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge>Transparent Comparison</Badge>
          <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How does Bongshai Cloud compare to Google Drive, Dropbox, and WeTransfer?
          </h2>
          <p className="mt-3 text-sm text-ink-muted sm:text-base">
            See how our free tier quotas, zero-signup transfers, creator program, and privacy tools stack up against standard cloud services.
          </p>
        </div>

        <GlassCard className="overflow-hidden p-0 sm:p-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-4 font-medium text-ink-muted sm:p-5">Platform Feature</th>
                  <th className="bg-accent/10 p-4 font-semibold text-accent sm:p-5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-4 text-accent" />
                      <span>Bongshai Cloud</span>
                    </div>
                  </th>
                  <th className="p-4 font-medium text-ink-muted sm:p-5">Google Drive</th>
                  <th className="p-4 font-medium text-ink-muted sm:p-5">Dropbox</th>
                  <th className="p-4 font-medium text-ink-muted sm:p-5">WeTransfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {COMPARISON_DATA.map((row) => (
                  <tr
                    key={row.feature}
                    className={`transition-colors hover:bg-[var(--glass-surface-hover)] ${
                      row.highlight ? "bg-accent/[0.02]" : ""
                    }`}
                  >
                    <td className="p-4 font-medium text-ink sm:p-5">
                      {row.feature}
                    </td>
                    <td className="bg-accent/5 p-4 font-semibold text-accent sm:p-5">
                      <RenderValue value={row.bongshai} />
                    </td>
                    <td className="p-4 text-ink-muted sm:p-5">
                      <RenderValue value={row.google} />
                    </td>
                    <td className="p-4 text-ink-muted sm:p-5">
                      <RenderValue value={row.dropbox} />
                    </td>
                    <td className="p-4 text-ink-muted sm:p-5">
                      <RenderValue value={row.wetransfer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
