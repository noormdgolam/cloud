import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFolderContents } from "@/lib/data/browser";
import { hasClaimableFiles } from "@/lib/actions/claim-actions";
import { FileBrowser } from "@/components/dashboard/FileBrowser";
import { ClaimBanner } from "@/components/dashboard/ClaimBanner";

export const metadata: Metadata = { title: "My files" };

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [contents, claimable] = await Promise.all([
    getFolderContents(userId, null),
    hasClaimableFiles(),
  ]);
  if (!contents) redirect("/dashboard");

  return (
    <>
      {claimable && <ClaimBanner count={claimable.count} totalBytes={claimable.totalBytes} />}
      <FileBrowser
        parentId={null}
        breadcrumbs={contents.breadcrumbs}
        folders={contents.folders}
        files={contents.files}
      />
    </>
  );
}
