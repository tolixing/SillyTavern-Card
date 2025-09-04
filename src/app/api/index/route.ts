import { NextResponse } from "next/server";
import { StorageAdapter } from "../../lib/storage";

export async function GET() {
  try {
    const indexData = await StorageAdapter.readIndex();
    
    return NextResponse.json(indexData, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error reading index:', error);
    return NextResponse.json(
      { 
        repository_version: "1.0.0",
        last_updated: new Date().toISOString(),
        characters: []
      },
      { status: 500 }
    );
  }
}
