import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFolderContents } from "@/lib/data/browser";
import { FileBrowser } from "@/components/dashboard/FileBrowser";

export const metadata: Metadata = { title: "Folder" };

export default async function FolderPage(props: PageProps<"/folder/[folderId]">) {
  const { folderId } = await props.params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const contents = await getFolderContents(userId, folderId);
  if (!contents) notFound();

  return (
    <FileBrowser
      parentId={folderId}
      breadcrumbs={contents.breadcrumbs}
      folders={contents.folders}
      files={contents.files}
    />
  );
}
