"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { PdfUploader } from "@/components/pdf-uploader";

export function UploaderWithMedium() {
  const [mediumUsername, setMediumUsername] = useState("");
  const [renderModel, setRenderModel] = useState<"openai" | "gemini">("openai");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="render-model" className="block text-sm font-medium text-slate-200">
          Modelo de IA para renderizado
        </label>
        <select
          id="render-model"
          value={renderModel}
          onChange={(e) => setRenderModel(e.target.value as "openai" | "gemini")}
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        >
          <option value="openai">ChatGPT (OpenAI)</option>
          <option value="gemini">Gemini (Google AI)</option>
        </select>
        <p className="text-xs text-slate-400">
          Elige el modelo de IA que generará el HTML de tu página.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="medium-username" className="block text-sm font-medium text-slate-200">
          (Opcional) Tu usuario de Medium
        </label>
        <input
          id="medium-username"
          type="text"
          value={mediumUsername}
          onChange={(e) => setMediumUsername(e.target.value.trim())}
          placeholder="@tuUsuarioMedium o solo tuUsuario"
          className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-white/30"
        />
        <p className="text-xs text-slate-400">
          Si agregas tu usuario de Medium, importaremos tus publicaciones destacadas y las incluiremos en el JSON.
        </p>
      </div>

      <PdfUploader mediumUsername={mediumUsername || undefined} renderModel={renderModel} />

      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
        <p className="flex items-center gap-2 text-slate-200">
          <FileText className="size-4 text-blue-300" /> Seguridad al primer lugar
        </p>
        <p className="mt-2">
          Procesamos tu información de manera temporal y cifrada. Puedes eliminarla en cualquier momento desde tu panel.
        </p>
      </div>
    </div>
  );
}
