import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "../components/nav";
import { PwaRegister } from "../components/pwa-register";

export const metadata: Metadata = {
  title: "H2O PR",
  description: "Información oficial y comunitaria sobre agua en Puerto Rico",
  manifest: "./manifest.webmanifest",
  metadataBase: new URL("https://h20pr.com"),
};

export const viewport: Viewport = {
  themeColor: "#064e6b",
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
              <div className="brand">H2O PR</div>
              <div className="tagline">h20pr.com · información de agua en Puerto Rico</div>
            </div>
            <span className="pilot-badge">Datos oficiales + comunidad</span>
          </div>
        </header>
        <main id="contenido" className="container main-content">{children}</main>
        <Nav />
        <PwaRegister />
      </body>
    </html>
  );
}
