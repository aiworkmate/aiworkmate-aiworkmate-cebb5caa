import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export const OWNER_ADMIN_EMAIL = "aidenhaynes43215@gmail.com";

const ControlInput = z.object({
  modelOverride: z.string().trim().max(120).nullable().optional(),
  systemOverride: z.string().trim().max(4000).nullable().optional(),
  forceLiveData: z.boolean().optional(),
  forceMemory: z.boolean().optional(),
});

export interface AiControlSettings {
  modelOverride: string | null;
  systemOverride: string | null;
  forceLiveData: boolean;
  forceMemory: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_CONTROL: AiControlSettings = {
  modelOverride: null,
  systemOverride: null,
  forceLiveData: false,
  forceMemory: false,
};

type ClaimsLike = { email?: string; sub?: string };

function adminEmails(): Set<string> {
  const configured = (process.env.AI_WORKMATE_OWNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([OWNER_ADMIN_EMAIL, ...configured]);
}

function normalizeEmail(email: string | null | undefined): string | null {
  return email ? email.trim().toLowerCase() : null;
}

function sanitizeControl(value: unknown): AiControlSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<AiControlSettings>;
  return {
    modelOverride: typeof raw.modelOverride === "string" && raw.modelOverride.trim()
      ? raw.modelOverride.trim().slice(0, 120)
      : null,
    systemOverride: typeof raw.systemOverride === "string" && raw.systemOverride.trim()
      ? raw.systemOverride.trim().slice(0, 4000)
      : null,
    forceLiveData: raw.forceLiveData === true,
    forceMemory: raw.forceMemory === true,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : undefined,
  };
}

async function getProfileByUserId(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, settings")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { user_id: string; email: string | null; settings: Json | null } | null;
}

export async function isAdminUser(userId: string, claims?: ClaimsLike): Promise<boolean> {
  const claimEmail = normalizeEmail(claims?.email);
  if (claimEmail && adminEmails().has(claimEmail)) return true;

  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return true;

  const profile = await getProfileByUserId(userId);
  const profileEmail = normalizeEmail(profile?.email);
  return Boolean(profileEmail && adminEmails().has(profileEmail));
}

async function ensureOwnerAdminRole(userId: string, claims?: ClaimsLike): Promise<boolean> {
  const profile = await getProfileByUserId(userId);
  const email = normalizeEmail(claims?.email) ?? normalizeEmail(profile?.email);
  if (!email || !adminEmails().has(email)) return false;

  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
  }
  return true;
}

export async function getAiControlForUser(userId: string, claims?: ClaimsLike): Promise<AiControlSettings> {
  const admin = await isAdminUser(userId, claims);
  if (!admin) return DEFAULT_CONTROL;

  const profile = await getProfileByUserId(userId);
  const settings = (profile?.settings && typeof profile.settings === "object" && !Array.isArray(profile.settings))
    ? profile.settings as Record<string, unknown>
    : {};
  return sanitizeControl(settings.aiControl);
}

export const getAdminControlPanel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as ClaimsLike;
    const ownerRoleEnsured = await ensureOwnerAdminRole(context.userId, claims);
    const admin = ownerRoleEnsured || await isAdminUser(context.userId, claims);
    if (!admin) return { admin: false as const, settings: DEFAULT_CONTROL, email: normalizeEmail(claims.email) };

    const settings = await getAiControlForUser(context.userId, claims);
    return { admin: true as const, settings, email: normalizeEmail(claims.email) };
  });

export const saveAdminAiControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ControlInput.parse(input))
  .handler(async ({ data, context }) => {
    const claims = context.claims as ClaimsLike;
    const ownerRoleEnsured = await ensureOwnerAdminRole(context.userId, claims);
    const admin = ownerRoleEnsured || await isAdminUser(context.userId, claims);
    if (!admin) throw new Error("Forbidden: admin role required");

    const profile = await getProfileByUserId(context.userId);
    const currentSettings = (profile?.settings && typeof profile.settings === "object" && !Array.isArray(profile.settings))
      ? profile.settings as Record<string, unknown>
      : {};
    const nextControl: AiControlSettings = {
      modelOverride: data.modelOverride?.trim() || null,
      systemOverride: data.systemOverride?.trim() || null,
      forceLiveData: data.forceLiveData === true,
      forceMemory: data.forceMemory === true,
      updatedAt: new Date().toISOString(),
      updatedBy: context.userId,
    };

    await supabaseAdmin
      .from("profiles")
      .update({ settings: { ...currentSettings, aiControl: nextControl } as Json })
      .eq("user_id", context.userId);

    return { ok: true, settings: nextControl };
  });
