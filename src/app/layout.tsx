// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { AuthProvider } from '@/context/AuthContext'; // <-- Import AuthProvider

const geistSans = Geist({
 variable: "--font-geist-sans",
 subsets: ["latin"],
});

const geistMono = Geist_Mono({
 variable: "--font-geist-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: "Roomies - Roommate Management App", //
 description: "Manage expenses, tasks, and communication with your roommates", //
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
   <html lang="en">
     <body
       className={`${geistSans.variable} ${geistMono.variable} antialiased`} //
     >
       {/* Wrap existing Providers and children with AuthProvider */}
       <AuthProvider>
         <Providers>{children}</Providers> {/* */}
       </AuthProvider>
     </body>
   </html>
 );
}