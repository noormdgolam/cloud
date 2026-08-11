import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "Bongshai Cloud — premium storage that stays out of your way",
    template: "%s · Bongshai Cloud",
  },
  description:
    "25GB free storage the moment you sign up, 2GB free with no account at all. Fast uploads, private by default.",
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
      <body className="min-h-full flex flex-col bg-bg-1 text-ink">{children}</body>
    </html>
  );
}
