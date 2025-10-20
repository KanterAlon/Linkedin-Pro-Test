"use client";

import { useState, useCallback } from "react";
import { UploadDropzone } from "@/components/upload-dropzone";

export function PdfUploader() {
  const [username, setUsername] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!username.trim()) {
        setError("Ingresa un nombre de usuario antes de subir el archivo.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("username", username.trim());

        const res = await fetch("/api/pdf", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Error al procesar el PDF");
        window.location.assign(data.path);
      } catch (e: any) {
        setError(e?.message || "Error al subir/parsear el PDF");
      } finally {
        setUploading(false);
      }
    },
    [username]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label htmlFor="username" className="text-sm text-slate-200 min-w-24">
          Usuario
        </label>
        <input
          id="username"
          type="text"
          placeholder="tu-usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>
      <UploadDropzone onFileAccepted={handleFile} />
      {uploading && (
        <p className="text-xs text-slate-300">Procesando PDF…</p>
      )}
      {error && (
        <p className="text-sm text-rose-200">{error}</p>
      )}
    </div>
  );
}
