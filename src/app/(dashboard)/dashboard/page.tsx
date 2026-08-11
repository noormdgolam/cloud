import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFolderContents, searchFiles, type SortOption } from "@/lib/data/browser";
import { hasClaimableFiles } from "@/lib/actions/claim-actions";
import { FileBrowser } from "@/components/dashboard/FileBrowser";
import { ClaimBanner } from "@/components/dashboard/ClaimBanner";
import { SearchResults } from "@/components/dashboard/SearchResults";

export const metadata: Metadata = { title: "My files" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { q, sort } = await searchParams;
  const query = q?.trim();

  if (query) {
    const results = await searchFiles(userId, query);
    return <SearchResults query={query} results={results} />;
  }

  const sortOption: SortOption = sort === "name" || sort === "size" ? sort : "date";

  const [contents, claimable] = await Promise.all([
    getFolderContents(userId, null, sortOption),
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
        sort={sortOption}
      />
    </>
  );
}
