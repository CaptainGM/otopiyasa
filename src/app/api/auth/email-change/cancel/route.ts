import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 });
    }

    await connectDB();
    await User.updateOne(
      { _id: authUser.userId },
      {
        $set: {
          emailChangePendingEmail: null,
          emailChangeCurrentCodeHash: null,
          emailChangeNewCodeHash: null,
          emailChangeCodeExpires: null,
          emailChangeAttempts: 0,
        },
      }
    );

    return NextResponse.json({ stage: "idle" });
  } catch (error) {
    console.error("POST /api/auth/email-change/cancel error:", error);
    return NextResponse.json({ error: "İptal edilemedi." }, { status: 500 });
  }
}
