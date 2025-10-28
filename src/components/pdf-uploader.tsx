"use client";

import { useCallback, useMemo, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogIn } from "lucide-react";

import { deriveProfileIdentity } from "@/lib/profile-identity";
import { UploadDropzone } from "@/components/upload-dropzone";

type PdfResponse = {
  path: string;
  profile?: {
    username: string;
    slug: string;
  };
  error?: string;
};

export function PdfUploader({ mediumUsername }: { mediumUsername?: string }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const identity = useMemo(() => {
    if (!user) {
      return null;
    }

    const primaryEmail =
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;

    return deriveProfileIdentity({
      clerkId: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: primaryEmail,
    });
  }, [user]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isSignedIn || !user) {
        setError("Debes iniciar sesion con tu cuenta antes de subir el archivo.");
        if (clerk.openSignIn) {
          clerk.openSignIn();
        }
        return;
      }

      if (!identity) {
        setError(
          "No pudimos construir la identidad del perfil. Recarga la pagina o verifica tu sesion de Clerk."
        );
        return;
      }

      setError(null);
      setNotice(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("identity_username", identity.username);
        formData.append("identity_slug", identity.slug);
        if (identity.email) {
          formData.append("identity_email", identity.email);
        }
        formData.append("identity_auth_id", identity.authUserId ?? user.id);

        const response = await fetch("/api/pdf", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = (await response.json()) as PdfResponse;

        if (!response.ok) {
          throw new Error(data.error || "Error al procesar el PDF");
        }

        setNotice("PDF procesado. Preparando tu perfil...");
        try {
          const url = new URL(data.path, window.location.origin);
          if (mediumUsername) {
            url.searchParams.set("medium", mediumUsername);
          }
          window.location.assign(url.toString());
        } catch {
          // Fallback simple si URL() falla
          const sep = data.path.includes("?") ? "&" : "?";
          const target = mediumUsername ? `${data.path}${sep}medium=${encodeURIComponent(mediumUsername)}` : data.path;
          window.location.assign(target);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al subir o procesar el PDF";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [clerk, identity, isSignedIn, user]
  );

  return (
    <div className="space-y-4">
      <UploadDropzone onFileAccepted={handleFile} disabled={!isSignedIn || uploading} />

      {!isSignedIn && isLoaded && (
        <button
          type="button"
          onClick={() => clerk.openSignIn()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 text-sm font-medium text-white transition hover:border-white/30 hover:bg-slate-900/80"
        >
          <LogIn className="size-4" />
          Inicia sesion para continuar
        </button>
      )}

      {identity && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">Tu perfil se vinculara automaticamente.</p>
          <p className="mt-1 text-slate-300">
            Guardaremos la informacion con el nombre{" "}
            <span className="font-medium text-white">{identity.username}</span> y podras acceder a
            la URL <span className="font-mono text-blue-200">/{identity.slug}</span>.
          </p>
        </div>
      )}

      {uploading && <p className="text-xs text-slate-300">Procesando PDF...</p>}
      {notice && <p className="text-xs text-blue-200">{notice}</p>}
      {error && <p className="text-sm text-rose-200">{error}</p>}
    </div>
  );
}
