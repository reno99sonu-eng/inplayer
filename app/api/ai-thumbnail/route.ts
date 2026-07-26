import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "AI thumbnail generation is not implemented yet.",
    },
    { status: 501 }
  );
}