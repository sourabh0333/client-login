import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata = {
  title: "Client Portal Demo",
  description: "An interactive client portal concept preview. No credentials are collected.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
