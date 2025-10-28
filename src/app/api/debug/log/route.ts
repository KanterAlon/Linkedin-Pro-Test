import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { message, extra } = (await req.json()) as {
      message?: string;
      extra?: Record<string, unknown>;
    };

    const now = new Date().toISOString();
    const ua = req.headers.get("user-agent") || "-";
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "-";

    console.log("[DEBUG]", { time: now, ip, ua, message: message ?? "<empty>", extra });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DEBUG] error handling log:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
