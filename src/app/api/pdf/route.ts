import { NextRequest, NextResponse } from "next/server";
import PDFParser from "pdf2json";

import { auth, currentUser } from "@clerk/nextjs/server";

import { deriveProfileIdentity } from "@/lib/profile-identity";
import {
  getUserProfileByAuthUserId,
  saveProfileFromPdf,
  sanitizeUsername,
} from "@/lib/store";
import { reformulateAsProfessionalReport, type ProfileData } from "@/lib/pollinations";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const fallbackUsername = String(formData.get("identity_username") ?? "").trim();
    const fallbackSlugRaw = String(formData.get("identity_slug") ?? "").trim();
    const fallbackEmail = String(formData.get("identity_email") ?? "").trim() || null;
    const fallbackSlug = sanitizeUsername(fallbackSlugRaw);
    const fallbackAuthId = String(formData.get("identity_auth_id") ?? "").trim();

    const { userId: clerkUserId } = auth();
    const resolvedAuthUserId = clerkUserId || (fallbackAuthId ? fallbackAuthId : null);

    console.log("[PDF] Nueva solicitud recibida", {
      hasFile: file instanceof File,
      fallbackUsername,
      fallbackSlug,
      fallbackEmail: Boolean(fallbackEmail),
      clerkSession: Boolean(clerkUserId),
      fallbackAuthProvided: Boolean(fallbackAuthId),
    });

    if (!resolvedAuthUserId) {
      console.warn("[PDF] Rechazado: no se pudo resolver auth_user_id");
      return NextResponse.json(
        {
          error:
            "Debes iniciar sesion para subir un PDF. Verifica que tu sesion de Clerk este activa y que CLERK_SECRET_KEY este configurada en el servidor.",
        },
        { status: 401 }
      );
    }

    let authenticatedUser: Awaited<ReturnType<typeof currentUser>> | null = null;
    try {
      authenticatedUser = await currentUser();
    } catch (error) {
      console.warn("[PDF] No se pudo obtener currentUser desde Clerk:", error);
    }

    if (!(file instanceof File)) {
      console.warn("[PDF] Rechazado: no se adjunto archivo valido");
      return NextResponse.json({ error: "Archivo PDF requerido en 'file'" }, { status: 400 });
    }

    let profileIdentity: {
      username: string;
      displayName: string;
      slug: string;
      email: string | null;
      authUserId: string;
    } | null = null;

    if (authenticatedUser) {
      const primaryEmail =
        authenticatedUser.primaryEmailAddress?.emailAddress ??
        authenticatedUser.emailAddresses[0]?.emailAddress ??
        null;

      profileIdentity = deriveProfileIdentity({
        clerkId: authenticatedUser.id,
        username: authenticatedUser.username,
        firstName: authenticatedUser.firstName,
        lastName: authenticatedUser.lastName,
        emailAddress: primaryEmail,
      });
    }

    if (!profileIdentity) {
      const existingProfile = await getUserProfileByAuthUserId(resolvedAuthUserId);
      if (existingProfile) {
        profileIdentity = {
          username: existingProfile.username,
          displayName: existingProfile.username,
          slug: existingProfile.slug,
          email: existingProfile.email,
          authUserId: resolvedAuthUserId,
        };
      }
    }

    if (!profileIdentity) {
      const baseName =
        fallbackUsername || fallbackSlug || `user-${resolvedAuthUserId.slice(-6)}`;
      const derived = deriveProfileIdentity({
        clerkId: resolvedAuthUserId,
        username: baseName,
        firstName: undefined,
        lastName: undefined,
        emailAddress: fallbackEmail ?? undefined,
      });

      profileIdentity = {
        username: fallbackUsername || derived.username,
        displayName: fallbackUsername || derived.displayName,
        slug: fallbackSlug || derived.slug,
        email: fallbackEmail ?? derived.email,
        authUserId: resolvedAuthUserId,
      };
    }

    if (!profileIdentity?.slug) {
      console.warn("[PDF] Rechazado: no se pudo determinar el slug final");
      return NextResponse.json(
        {
          error:
            "No se pudo determinar el slug del perfil. Verifica que NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY esten configuradas.",
        },
        { status: 400 }
      );
    }

    console.log("[PDF] Identidad resuelta", {
      username: profileIdentity.username,
      slug: profileIdentity.slug,
      email: profileIdentity.email ? "si" : "no",
      authUserId: profileIdentity.authUserId,
      source: authenticatedUser ? "clerk" : fallbackAuthId ? "fallback" : "generado",
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfParser = new PDFParser(undefined, 1);
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => {
        reject(new Error(errData.parserError ?? "Error leyendo el PDF"));
      });
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(buffer);
    });

    const trimmedText = text.trim();
    if (!trimmedText) {
      console.warn("[PDF] Rechazado: no se obtuvo texto util del PDF");
      return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 400 });
    }

    console.log("[PDF] Contenido extraido", {
      characters: trimmedText.length,
    });

    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;
    let profileData: ProfileData | null = null;
    let processedWithAI = false;

    try {
      console.log("[PDF] Enviando a Pollinations", {
        tokenConfigured: Boolean(pollinationsToken),
        characters: trimmedText.length,
      });
      profileData = await reformulateAsProfessionalReport(trimmedText, pollinationsToken);
      processedWithAI = true;
      console.log("[PDF] Pollinations respondio", {
        sections: profileData.sections.length,
      });
    } catch (aiError) {
      console.error("Error en procesamiento de IA:", aiError);
      processedWithAI = false;
    }

    const profile = await saveProfileFromPdf({
      username: profileIdentity.username,
      slug: profileIdentity.slug,
      email: profileIdentity.email,
      authUserId: profileIdentity.authUserId,
      pdfText: trimmedText,
      profileJson: profileData,
    });

    console.log("[PDF] Perfil guardado", {
      slug: profile.slug,
      processedWithAI,
      sectionsCount: profileData?.sections.length ?? 0,
    });

    const ownerHint =
      !clerkUserId && resolvedAuthUserId
        ? `?authId=${encodeURIComponent(resolvedAuthUserId)}`
        : "";

    return NextResponse.json({
      ok: true,
      path: `/${profile.slug}${ownerHint}`,
      processed_with_ai: processedWithAI,
      sections_count: profileData?.sections.length ?? 0,
      profile,
    });
  } catch (err) {
    console.error("Error procesando PDF:", err);
    const message = err instanceof Error ? err.message : "Error procesando PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

