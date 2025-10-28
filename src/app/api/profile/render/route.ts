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
import {
  getMediumUserIdByUsername,
  getMediumTopArticlesByUserId,
  buildMediumProfileText,
} from "@/lib/mediumapi";

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
    const mediumUsername =
      typeof body.mediumUsername === "string" ? String(body.mediumUsername).trim() : undefined;
    const preferredRenderModel =
      (body.renderModel === "openai" || body.renderModel === "gemini") ? body.renderModel as "openai" | "gemini" : undefined;

    const { userId } = await auth();
    const resolvedAuthId = userId || (fallbackAuthId ? fallbackAuthId : null);

    console.log("[RENDER] Solicitud recibida", {
      additionalInstructionsLength: additionalInstructions?.length ?? 0,
      hasAuthFromSession: Boolean(userId),
      hasFallbackAuth: Boolean(fallbackAuthId),
      mediumUsernameProvided: Boolean(mediumUsername),
      preferredRenderModel: preferredRenderModel ?? "default",
    });

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
      console.warn("[RENDER] No se encontro perfil para el usuario", {
        resolvedAuthId,
      });
      return NextResponse.json(
        { error: "No existe perfil para este usuario" },
        { status: 404 }
      );
    }

    console.log("[RENDER] Perfil encontrado", {
      slug: baseProfile.slug,
      hasJson: Boolean(baseProfile.profile_json),
      hasHtmlPrevio: Boolean(baseProfile.profile_html),
    });

    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;

    let profileData = toProfileData(baseProfile.profile_json);

    let mediumText: string | null = null;
    let mediumUserId: string | null = null;
    let mediumArticlesCount = 0;
    if (mediumUsername) {
      try {
        const uid = await getMediumUserIdByUsername(mediumUsername);
        mediumUserId = uid;
        if (uid) {
          const articles = await getMediumTopArticlesByUserId(uid, 5);
          mediumArticlesCount = Array.isArray(articles) ? articles.length : 0;
          mediumText = buildMediumProfileText(mediumUsername, articles);
        }
      } catch (e) {
        console.warn("[RENDER] Fallo al obtener datos de Medium", { mediumUsername, e });
      }
    }

    const shouldReformulate = !profileData || Boolean(mediumText);

    if (shouldReformulate) {
      const parts: string[] = [];
      if (baseProfile.pdf_raw) parts.push(baseProfile.pdf_raw);
      if (mediumText) parts.push(mediumText);

      if (parts.length === 0) {
        console.warn("[RENDER] No hay fuentes para reformular", { slug: baseProfile.slug });
        return NextResponse.json(
          { error: "No hay datos para generar el JSON estructurado" },
          { status: 400 }
        );
      }

      console.log("[RENDER] Reconstruyendo JSON a partir de fuentes disponibles", {
        slug: baseProfile.slug,
        hasPdf: Boolean(baseProfile.pdf_raw),
        hasMedium: Boolean(mediumText),
        mediumUsername,
        mediumUserId,
        mediumArticlesCount,
      });

      profileData = await reformulateAsProfessionalReport(
        parts.join("\n\n"),
        pollinationsToken
      );

      await updateProfileJson({
        username: baseProfile.slug,
        profileJson: profileData as any,
        pdfText: baseProfile.pdf_raw ?? null,
        resetHtml: false,
      });

      console.log("[RENDER] JSON reconstruido y actualizado en Supabase", {
        slug: baseProfile.slug,
        sections: profileData.sections.length,
      });
    }

    if (!profileData) {
      return NextResponse.json(
        { error: "No se pudo construir el JSON estructurado para renderizar" },
        { status: 500 }
      );
    }

    console.log("[RENDER] Enviando a AI para HTML", {
      slug: baseProfile.slug,
      sections: profileData.sections.length,
      tokenConfigured: Boolean(pollinationsToken),
      additionalInstructionsLength: additionalInstructions?.length ?? 0,
      preferredModel: preferredRenderModel ?? "auto",
    });

    const html = await renderProfileToHtml(
      profileData,
      {
        username: baseProfile.username,
        additionalInstructions,
        preferredModel: preferredRenderModel,
        previousHtml: baseProfile.profile_html ?? undefined,
      },
      pollinationsToken
    );

    console.log("[RENDER] Pollinations devolvio HTML", {
      slug: baseProfile.slug,
      htmlLength: html.length,
    });

    const savedProfile = await updateProfileHtml({
      username: baseProfile.slug,
      profileHtml: html,
    });

    console.log("[RENDER] HTML actualizado en Supabase", {
      slug: savedProfile.slug,
      renderedAt: savedProfile.last_rendered_at,
    });

    return NextResponse.json({
      ok: true,
      html,
      record: savedProfile,
      username: savedProfile.username,
      slug: savedProfile.slug,
      path: `/${savedProfile.slug}`,
      medium: {
        provided: Boolean(mediumUsername),
        username: mediumUsername ?? null,
        userId: mediumUserId,
        articlesCount: mediumArticlesCount,
      },
    });
  } catch (err) {
    console.error("Error renderizando perfil:", err);
    const message = err instanceof Error ? err.message : "Error renderizando perfil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
