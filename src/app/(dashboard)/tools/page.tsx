import { ToolsGrid } from "@/components/dashboard/ToolsGrid";

export const metadata = { title: "Tools" };

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Tools</h1>
        <p className="mt-1 text-sm text-ink-muted">Pick a file from your storage — or upload one on the spot.</p>
      </div>
      <ToolsGrid />
    </div>
  );
}
