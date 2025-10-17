import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Falta definir NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY en el entorno. Añade la llave en el archivo .env o .env.secrets.",
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "LinkedIn Pro Portfolio",
  description:
    "Convierte tu exportación de LinkedIn en un portafolio profesional moderno en cuestión de segundos.",
  openGraph: {
    title: "LinkedIn Pro Portfolio",
    description:
      "Crea un portafolio atractivo arrastrando y soltando tu archivo de datos de LinkedIn.",
    url: appUrl,
    siteName: "LinkedIn Pro Portfolio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        layout: {
          socialButtonsVariant: "iconButton",
        },
        variables: {
          colorPrimary: "#2563eb",
          colorBackground: "#ffffff",
        },
      }}
    >
      <html lang="es">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
