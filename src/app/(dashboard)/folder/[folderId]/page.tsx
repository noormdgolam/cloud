import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFolderContents, type SortOption } from "@/lib/data/browser";
import { FileBrowser } from "@/components/dashboard/FileBrowser";

export const metadata: Metadata = { title: "Folder" };

export default async function FolderPage(
  props: PageProps<"/folder/[folderId]"> & { searchParams: Promise<{ sort?: string }> }
) {
  const { folderId } = await props.params;
  const { sort } = await props.searchParams;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const sortOption: SortOption = sort === "name" || sort === "size" ? sort : "date";

  const contents = await getFolderContents(userId, folderId, sortOption);
  if (!contents) notFound();

  return (
    <FileBrowser
      parentId={folderId}
      breadcrumbs={contents.breadcrumbs}
      folders={contents.folders}
      files={contents.files}
      sort={sortOption}
      googleImportEligible
    />
  );
}
