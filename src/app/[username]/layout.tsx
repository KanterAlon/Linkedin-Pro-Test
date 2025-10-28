import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Falta definir NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY en el entorno. Añade la llave en el archivo .env o .env.secrets.",
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Perfil Profesional",
  description: "Portafolio profesional generado con LinkedIn Pro",
};

export default function UsernameLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
