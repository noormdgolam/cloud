import { Nav } from "@/components/marketing/Nav";

export default function UploadLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-1">
      <Nav />
      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
