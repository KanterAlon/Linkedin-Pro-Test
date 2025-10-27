import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  getUserProfileByAuthUserId,
  updateProfileJson,
} from "@/lib/store";
import {
  augmentProfileWithInstructions,
  reformulateAsProfessionalReport,
  type ProfileData,
} from "@/lib/pollinations";

export const runtime = "nodejs";

function toProfileData(value: unknown): ProfileData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybe = value as { sections?: Array<{ header?: unknown; text?: unknown }> };
  if (!Array.isArray(maybe.sections)) {
    return null;
  }

  if (
    maybe.sections.some(
      (section) => typeof section?.header !== "string" || typeof section?.text !== "string"
    )
  ) {
    return null;
  }

  return { sections: maybe.sections as ProfileData["sections"] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const instructions = String(body.instructions ?? "").trim();
    const fallbackAuthId =
      typeof body.identityAuthId === "string" ? String(body.identityAuthId).trim() : "";

    const { userId } = auth();
    const resolvedAuthId = userId || (fallbackAuthId ? fallbackAuthId : null);

    if (!resolvedAuthId) {
      return NextResponse.json(
        {
          error:
            "Debes iniciar sesion para usar el agente. Verifica que CLERK_SECRET_KEY este configurada en el servidor.",
        },
        { status: 401 }
      );
    }

    if (!instructions) {
      return NextResponse.json({ error: "instructions es requerido" }, { status: 400 });
    }

    const baseProfile = await getUserProfileByAuthUserId(resolvedAuthId);

    if (!baseProfile) {
      return NextResponse.json(
        { error: "No existe perfil para este usuario" },
        { status: 404 }
      );
    }

    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;

    let currentProfile = toProfileData(baseProfile.profile_json);

    if (!currentProfile) {
      if (!baseProfile.pdf_raw) {
        return NextResponse.json(
          { error: "No hay datos base para reconstruir el perfil" },
          { status: 400 }
        );
      }

      currentProfile = await reformulateAsProfessionalReport(
        baseProfile.pdf_raw,
        pollinationsToken
      );
    }

    const updatedProfile = await augmentProfileWithInstructions(
      currentProfile,
      instructions,
      pollinationsToken
    );

    const savedProfile = await updateProfileJson({
      username: baseProfile.slug,
      profileJson: updatedProfile,
    });

    return NextResponse.json({
      ok: true,
      profile: updatedProfile,
      record: savedProfile,
      slug: savedProfile.slug,
      username: savedProfile.username,
      path: `/${savedProfile.slug}`,
    });
  } catch (err) {
    console.error("Error enriqueciendo perfil:", err);
    const message = err instanceof Error ? err.message : "Error enriqueciendo perfil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
