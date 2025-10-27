"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  FileText,
  UploadCloud,
} from "lucide-react";
import { twMerge } from "tailwind-merge";

type UploadDropzoneProps = {
  onFileAccepted?: (file: File) => void;
  disabled?: boolean;
};

const ACCEPTED_MIME_TYPES = {
  "application/zip": [".zip"],
  "application/json": [".json"],
  "application/pdf": [".pdf"],
};

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export function UploadDropzone({ onFileAccepted, disabled = false }: UploadDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDropAccepted = useCallback(
    (files: File[]) => {
      const [file] = files;
      setSelectedFile(file ?? null);
      setError(null);
      onFileAccepted?.(file);
    },
    [onFileAccepted]
  );

  const onDropRejected = useCallback(() => {
    setSelectedFile(null);
    setError(
      "El archivo debe ser el .zip o .json exportado desde LinkedIn y pesar menos de 50 MB."
    );
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,
  } = useDropzone({
    accept: ACCEPTED_MIME_TYPES,
    multiple: false,
    maxSize: MAX_SIZE_BYTES,
    onDropAccepted,
    onDropRejected,
    disabled,
  });

  const rejectionMessage = useMemo(() => {
    if (!fileRejections.length) return null;

    const [{ errors }] = fileRejections;

    const messages = errors.map((item) => {
      if (item.code === "file-invalid-type") {
        return "Formato no valido. Usa el ZIP o JSON que entrega LinkedIn.";
      }

      if (item.code === "file-too-large") {
        return "El archivo supera el limite de 50 MB.";
      }

      return item.message;
    });

    return messages.join(" ");
  }, [fileRejections]);

  const activeClasses = isDragActive
    ? "border-blue-400/60 bg-blue-500/10 shadow-lg shadow-blue-500/10"
    : "border-white/10 bg-white/5";

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={twMerge(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed p-10 text-center transition-all duration-200 hover:border-blue-400/60 hover:bg-blue-500/10",
          disabled ? "cursor-not-allowed opacity-50" : activeClasses
        )}
      >
        <input {...getInputProps()} aria-label="Carga el archivo exportado desde LinkedIn" />
        <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 p-4 text-blue-300 transition-transform duration-200 group-hover:scale-110">
          <UploadCloud className="size-8" />
        </span>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-slate-100">
            Arrastra tu exportacion de LinkedIn
          </p>
          <p className="text-sm text-slate-300">
            Aceptamos el archivo .zip, .json o PDF con tus datos completos. Maximo 50 MB.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FileArchive className="size-4" /> Archivo ZIP
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FileText className="size-4" /> Archivo JSON
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <FileText className="size-4" /> Archivo PDF
          </span>
        </div>
      </div>

      {selectedFile && !error && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="size-5" /> {selectedFile.name}
        </p>
      )}

      {(error || rejectionMessage) && (
        <p className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <AlertCircle className="size-5" /> {error ?? rejectionMessage}
        </p>
      )}
    </div>
  );
}

