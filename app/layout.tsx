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
  title: "OctoSage",
  description: "Know who owns your code",
  generator: 'OctoSage'
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
