import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "InPlayer Cognito integration is ready.",
  });
}