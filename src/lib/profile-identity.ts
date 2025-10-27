export type BasicClerkIdentity = {
  clerkId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emailAddress?: string | null;
};

export type ProfileIdentity = {
  username: string;
  slug: string;
  email: string | null;
  displayName: string;
  authUserId: string;
};

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: string): string {
  const normalized = removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized;
}

function buildBaseName(identity: BasicClerkIdentity): {
  base: string;
  display: string;
} {
  const nameParts: string[] = [];
  if (identity.firstName) {
    nameParts.push(identity.firstName);
  }
  if (identity.lastName) {
    nameParts.push(identity.lastName);
  }

  const displayName =
    nameParts.join(" ").trim() ||
    identity.username?.trim() ||
    identity.emailAddress?.split("@")[0]?.trim() ||
    "Perfil Profesional";

  const baseCandidate =
    identity.username?.trim() ||
    nameParts.join(" ").trim() ||
    identity.emailAddress?.split("@")[0]?.trim() ||
    identity.clerkId;

  return { base: baseCandidate, display: displayName };
}

function buildStableSuffix(clerkId: string): string {
  const sanitized = clerkId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const suffix = sanitized.slice(-6);
  if (suffix) {
    return suffix;
  }

  return Math.random().toString(36).slice(-6);
}

export function deriveProfileIdentity(identity: BasicClerkIdentity): ProfileIdentity {
  const { base, display } = buildBaseName(identity);
  const baseSlug = slugify(base);
  const suffix = buildStableSuffix(identity.clerkId);
  const slug = baseSlug ? `${baseSlug}-${suffix}` : `user-${suffix}`;

  return {
    username: display,
    displayName: display,
    slug,
    email: identity.emailAddress ?? null,
    authUserId: identity.clerkId,
  };
}

