import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Sistema Digital IEO®", description: "Acceso administrativo al Sistema Digital IEO®", robots: { index: false, follow: false } };
export const runtime = "nodejs";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
