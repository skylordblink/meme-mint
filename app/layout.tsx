import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const display = Fraunces({
  variable: "--nf-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

const body = Instrument_Sans({
  variable: "--nf-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--nf-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${APP_NAME} | Strike your own Solana coin`,
  description: "Create a Solana token in one transaction. Connect your wallet, fill in the details, sign once.",
};

export const viewport: Viewport = {
  themeColor: "#ece4cf",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
