import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { sheetId } = await req.json();

    if (!sheetId) {
      return NextResponse.json({ error: "Sheet ID is required" }, { status: 400 });
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(exportUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch the sheet. Please make sure the sharing settings are set to 'Anyone with the link can view'." },
        { status: 400 }
      );
    }

    const csvText = await response.text();

    if (csvText.trim().toLowerCase().startsWith("<!doctype html") || csvText.trim().toLowerCase().startsWith("<html")) {
      return NextResponse.json(
        { error: "The sheet is private. You must change the sharing settings to 'Anyone with the link can view'." },
        { status: 403 }
      );
    }

    return new NextResponse(csvText, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="Google_Sheet_${sheetId.substring(0, 8)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Sheet import error:", error);
    return NextResponse.json({ error: "Internal server error during sheet import" }, { status: 500 });
  }
}
