import type { Metadata } from "next";
import Script from "next/script";
import "avatar-profile-kit/styles.css";
import "./globals.css";

export const metadata: Metadata = { title: { default: "CONNECT Nicaragua", template: "%s · CONNECT" }, description: "Un espacio para acompañar a quienes sirven en CONNECT Nicaragua.", robots: { index: false, follow: false }, manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "CONNECT Nicaragua", statusBarStyle: "default" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body><a href="#contenido" className="skip-link">Ir al contenido</a>{children}{process.env.NODE_ENV === "production" ? <Script id="pwa-service-worker" strategy="afterInteractive">{`if ("serviceWorker" in navigator) { window.addEventListener("load", function () { void navigator.serviceWorker.register("/sw.js"); }); }`}</Script> : null}</body></html>;
}
