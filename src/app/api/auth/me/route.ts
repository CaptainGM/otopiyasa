import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";
import { avatarDescriptor } from "@/lib/avatar";

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ user: null });
    }

    await connectDB();
    const user = await User.findById(authUser.userId)
      .select("name email favorites role businessStatus businessName businessRejectionReason avatarType avatarPreset avatarVersion")
      .lean<{ _id: unknown; avatarType?: string | null; avatarPreset?: string | null; avatarVersion?: number | null } & Record<string, unknown>>();
    if (!user) return NextResponse.json({ user: null });

    // Profil resmi (web ve mobil aynı tarifi kullanır); ham alanlar dışarı verilmez.
    const { avatarType, avatarPreset, avatarVersion, ...rest } = user;
    void avatarType;
    void avatarPreset;
    void avatarVersion;
    return NextResponse.json({ user: { ...rest, avatar: avatarDescriptor(user) } });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ user: null });
  }
}
