import { NextResponse } from "next/server";

export async function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <rect width="192" height="192" fill="#0d0d14"/>
    <circle cx="96" cy="96" r="80" fill="#1a1a2e" stroke="#e8a020" stroke-width="6"/>
    <text x="96" y="115" font-size="70" text-anchor="middle" font-family="serif">🎬</text>
  </svg>`;
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}