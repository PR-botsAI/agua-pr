import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "../components/nav";
import { PwaRegister } from "../components/pwa-register";

export const metadata: Metadata = {
  title: "Agua PR",
  description: "Información de agua en Puerto Rico — piloto Arecibo",
  manifest: "./manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0066CC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-PR">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="site-header">
          <div className="container header-inner">
            <div>
              <div className="brand">AGUA PR</div>
              <div className="tagline">Información de agua en PR</div>
            </div>
            <span className="pilot-badge">Piloto Arecibo</span>
          </div>
        </header>
        <main id="contenido" className="container main-content">{children}</main>
        <Nav />
        <PwaRegister />
      </body>
    </html>
  );
}
