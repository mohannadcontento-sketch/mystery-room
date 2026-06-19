import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mystery Room — لعبة الغموض الاجتماعية",
  description:
    "غرف لعب جماعية تعتمد على الأسئلة والإجابات المجهولة والتفاعل بين اللاعبين.",
  keywords: [
    "Mystery Room",
    "لعبة اجتماعية",
    "أسئلة مجهولة",
    "Social Game",
    "Next.js",
    "Supabase",
  ],
  authors: [{ name: "Mystery Room" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Mystery Room",
    description: "لعبة الغموض الاجتماعية — أسئلة وإجابات مجهولة",
    siteName: "Mystery Room",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
