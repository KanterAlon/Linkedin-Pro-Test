import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  getUserProfileByAuthUserId,
  updateProfileHtml,
  updateProfileJson,
} from "@/lib/store";
import {
  reformulateAsProfessionalReport,
  renderProfileToHtml,
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
    const additionalInstructions =
      typeof body.additionalInstructions === "string"
        ? String(body.additionalInstructions).trim()
        : undefined;
    const fallbackAuthId =
      typeof body.identityAuthId === "string" ? String(body.identityAuthId).trim() : "";

    const { userId } = auth();
    const resolvedAuthId = userId || (fallbackAuthId ? fallbackAuthId : null);

    if (!resolvedAuthId) {
      return NextResponse.json(
        {
          error:
            "Debes iniciar sesion para renderizar la pagina. Verifica que CLERK_SECRET_KEY este configurada en el servidor.",
        },
        { status: 401 }
      );
    }

    const baseProfile = await getUserProfileByAuthUserId(resolvedAuthId);

    if (!baseProfile) {
      return NextResponse.json(
        { error: "No existe perfil para este usuario" },
        { status: 404 }
      );
    }

    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;

    let profileData = toProfileData(baseProfile.profile_json);

    if (!profileData) {
      if (!baseProfile.pdf_raw) {
        return NextResponse.json(
          { error: "No hay datos estructurados para renderizar la pagina" },
          { status: 400 }
        );
      }

      profileData = await reformulateAsProfessionalReport(
        baseProfile.pdf_raw,
        pollinationsToken
      );

      await updateProfileJson({
        username: baseProfile.slug,
        profileJson: profileData,
        pdfText: baseProfile.pdf_raw,
        resetHtml: false,
      });
    }

    const html = await renderProfileToHtml(
      profileData,
      {
        username: baseProfile.username,
        additionalInstructions,
      },
      pollinationsToken
    );

    const savedProfile = await updateProfileHtml({
      username: baseProfile.slug,
      profileHtml: html,
    });

    return NextResponse.json({
      ok: true,
      html,
      record: savedProfile,
      username: savedProfile.username,
      slug: savedProfile.slug,
      path: `/${savedProfile.slug}`,
    });
  } catch (err) {
    console.error("Error renderizando perfil:", err);
    const message = err instanceof Error ? err.message : "Error renderizando perfil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
