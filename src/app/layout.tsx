import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cloud.bongshai.com"),
  title: {
    default: "Bongshai Cloud — Fast, Private Cloud Storage & Sharing",
    template: "%s · Bongshai Cloud",
  },
  description:
    "Get 25GB permanent free cloud storage or 2GB instant zero-signup anonymous uploads. Private by default with streamed chunked uploads and VirusTotal malware verification.",
  keywords: [
    "cloud storage",
    "free cloud storage",
    "anonymous file upload",
    "fast file sharing",
    "private cloud drive",
    "creator monetization",
    "Bongshai Cloud",
  ],
  authors: [{ name: "Bongshai Infrastructure & Security Team" }],
  openGraph: {
    title: "Bongshai Cloud — Fast, Private Cloud Storage & Sharing",
    description:
      "Get 25GB permanent free cloud storage or 2GB instant zero-signup anonymous uploads. Streamed, private, and malware-scanned.",
    url: "https://cloud.bongshai.com",
    siteName: "Bongshai Cloud",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bongshai Cloud — Fast, Private Cloud Storage",
    description: "25GB permanent free storage & 2GB zero-signup anonymous uploads.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Runs before paint, before hydration — reads the saved theme and sets the
// attribute synchronously so there's no flash of the wrong theme. Only
// needs to handle "dark": light is the bare :root default already.
const themeInitScript = `
(function () {
  try {
    if (localStorage.getItem("theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg-1 text-ink">
        {children}
        <AssistantWidget />
      </body>
    </html>
  );
}
