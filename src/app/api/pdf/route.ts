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

    if (!resolvedAuthUserId) {
      return NextResponse.json(
        {
          error:
            "Debes iniciar sesion para subir un PDF. Verifica que tu sesion de Clerk este activa y que CLERK_SECRET_KEY este configurada en el servidor.",
        },
        { status: 401 }
      );
    }

    let authenticatedUser = null;
    try {
      authenticatedUser = await currentUser();
    } catch (error) {
      console.warn("No se pudo obtener currentUser desde Clerk:", error);
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo PDF requerido en 'file'" }, { status: 400 });
    }

    let profileIdentity = null;

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

    if (!profileIdentity.slug) {
      return NextResponse.json(
        {
          error:
            "No se pudo determinar el slug del perfil. Verifica que NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY esten configuradas.",
        },
        { status: 400 }
      );
    }

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
      return NextResponse.json({ error: "No se pudo extraer texto del PDF" }, { status: 400 });
    }

    const pollinationsToken = process.env.POLLINATIONS_API_TOKEN;
    let profileData: ProfileData | null = null;
    let processedWithAI = false;

    try {
      profileData = await reformulateAsProfessionalReport(trimmedText, pollinationsToken);
      processedWithAI = true;
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
