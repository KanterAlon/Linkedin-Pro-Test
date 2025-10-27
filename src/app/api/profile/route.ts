import { NextRequest, NextResponse } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { deriveProfileIdentity } from "@/lib/profile-identity";
import {
  ensureProfileMetadata,
  getUserProfile,
  getUserProfileByAuthUserId,
} from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const username = String(req.nextUrl.searchParams.get("username") ?? "").trim();
  const fallbackAuthId =
    req.nextUrl.searchParams.get("identityAuthId")?.toString().trim() ?? "";

  if (!username) {
    const { userId } = auth();
    const resolvedAuthId = userId || (fallbackAuthId ? fallbackAuthId : null);

    if (!resolvedAuthId) {
      return NextResponse.json({ error: "Debes iniciar sesion" }, { status: 401 });
    }

    const profile = await getUserProfileByAuthUserId(resolvedAuthId);

    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 404 });
    }

    return NextResponse.json({ profile });
  }

  const profile = await getUserProfile(username);

  if (!profile) {
    return NextResponse.json({ profile: null }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fallbackAuthId =
    typeof body.identityAuthId === "string" ? String(body.identityAuthId).trim() : "";

  const { userId } = auth();
  const resolvedAuthId = userId || (fallbackAuthId ? fallbackAuthId : null);

  if (!resolvedAuthId) {
    return NextResponse.json(
      {
        error:
          "Debes iniciar sesion. Si ya lo hiciste, verifica que CLERK_SECRET_KEY este configurada en el servidor.",
      },
      { status: 401 }
    );
  }

  const requestedDisplayName =
    typeof body.username === "string" ? String(body.username).trim() : "";
  const requestedEmail =
    typeof body.email === "string" || body.email === null ? body.email : undefined;

  let authenticatedUser = null;
  try {
    authenticatedUser = await currentUser();
  } catch (error) {
    console.warn("No se pudo obtener currentUser desde Clerk:", error);
  }

  if (authenticatedUser && authenticatedUser.id !== resolvedAuthId) {
    console.warn(
      "El usuario autenticado por Clerk no coincide con identityAuthId recibido. Usando fallback."
    );
    authenticatedUser = null;
  }

  const existingProfile = await getUserProfileByAuthUserId(resolvedAuthId);

  let identity = null;

  if (authenticatedUser) {
    const primaryEmail =
      authenticatedUser.primaryEmailAddress?.emailAddress ??
      authenticatedUser.emailAddresses[0]?.emailAddress ??
      null;

    identity = deriveProfileIdentity({
      clerkId: authenticatedUser.id,
      username: authenticatedUser.username,
      firstName: authenticatedUser.firstName,
      lastName: authenticatedUser.lastName,
      emailAddress: primaryEmail,
    });
  } else if (existingProfile) {
    identity = {
      username: existingProfile.username,
      slug: existingProfile.slug,
      email: existingProfile.email,
    };
  } else {
    const fallbackName = requestedDisplayName || `user-${resolvedAuthId.slice(-6)}`;
    const derived = deriveProfileIdentity({
      clerkId: resolvedAuthId,
      username: fallbackName,
      firstName: undefined,
      lastName: undefined,
      emailAddress: typeof requestedEmail === "string" ? requestedEmail : undefined,
    });
    identity = {
      username: derived.username,
      slug: derived.slug,
      email: derived.email,
    };
  }

  if (!identity?.slug) {
    return NextResponse.json(
      {
        error:
          "No se pudo determinar la identidad del perfil. Asegurate de configurar NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY y CLERK_SECRET_KEY.",
      },
      { status: 400 }
    );
  }

  const profile = await ensureProfileMetadata({
    username: requestedDisplayName || identity.username,
    slug: identity.slug,
    email: typeof requestedEmail === "undefined" ? identity.email : requestedEmail,
    authUserId: resolvedAuthId,
  });

  const responsePayload = {
    profile,
    identity: {
      username: identity.username,
      slug: identity.slug,
      email: identity.email,
    },
  };

  return NextResponse.json(responsePayload);
}
