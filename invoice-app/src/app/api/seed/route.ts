import { NextResponse } from "next/server";
import { seedDatabase, clearDatabase } from "@/lib/seed-db";

export async function POST(req: any) {
  try {
    const body = await req.json();
    const action = body.action || "seed";

    if (action === "clear") {
      await clearDatabase();
      return NextResponse.json({ 
        success: true, 
        message: "Demo data cleared" 
      });
    }

    await seedDatabase();
    return NextResponse.json({ 
      success: true, 
      message: "Demo data seeded successfully",
      count: 12,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database", details: String(error) },
      { status: 500 }
    );
  }
}
