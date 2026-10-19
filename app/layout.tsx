import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "xclip — A little space between devices",
  description: "Paste here. Pick it up anywhere. A simple shared text clipboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
