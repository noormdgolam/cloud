import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-1">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
