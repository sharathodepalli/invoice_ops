import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("export_records")
      .select("*")
      .order("exported_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ 
      history: data || [],
      count: data?.length || 0 
    });
  } catch (error) {
    console.error("Failed to fetch export history:", error);
    return NextResponse.json(
      { error: "Failed to fetch export history" },
      { status: 500 }
    );
  }
}
