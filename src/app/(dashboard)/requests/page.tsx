import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFileRequestsForUser } from "@/lib/data/file-requests";
import { FileRequestsPageClient } from "@/components/dashboard/FileRequestsPageClient";

export const metadata = { title: "File requests" };

export default async function FileRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const requests = await getFileRequestsForUser(session.user.id);

  return <FileRequestsPageClient requests={requests} />;
}
