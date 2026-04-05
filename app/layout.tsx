import type { Metadata } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/src/components/navbar";
import { Footer } from "@/src/components/footer";
import { getCurrentUser } from "@/src/services/auth/service";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitSage | GitHub Code Ownership & Bus Factor Mapper",
  description: "Map GitHub code ownership and identify bus factor risks. GitSage analyzes commit history to help engineering teams find active owners and prevent knowledge silos.",
  generator: 'gitsage',
  keywords: ["github", "code ownership", "engineering management", "bus factor", "risk analysis", "code reviewers", "knowledge silos"],
  openGraph: {
    title: "GitSage | Know who owns your code",
    description: "Map GitHub code ownership and identify bus factor risks. GitSage analyzes commit history to help engineering teams find active owners.",
    // url: "",
    siteName: "gitSage",
    type: "website",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background text-foreground flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <Navbar isLoggedIn={isLoggedIn} />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}