import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/syne";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brugali · Costos y precios",
  description: "Análisis, vigencias y simulación comercial",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

