import { NextRequest, NextResponse } from "next/server";
import { storage, type Character } from "../../../lib/storage";
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    
    // 串行化增加下载次数，并获取更新后的角色信息
    let character: Character | undefined;
    await storage.updateIndex((data) => {
      const c = data.characters.find(ch => ch.id === characterId);
      if (c) {
        c.download_count = (c.download_count || 0) + 1;
        c.last_updated = new Date().toISOString();
        character = { ...c };
      }
    });

    if (!character) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    // 读取角色卡文件
    const basePath = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    const filePath = join(basePath, 'public', 'characters', characterId, 'card.png');
    
    try {
      const fileBuffer = await readFile(filePath);
      
      // 返回文件下载
      // 对文件名进行URL编码，避免中文字符问题
      const encodedFileName = encodeURIComponent(`${character.name}_v${character.version}.png`);
      
      return new Response(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (fileError) {
      console.error("File read error:", fileError);
      return NextResponse.json(
        { message: "File not found." },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Download error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "An error occurred during download.", error: errorMessage },
      { status: 500 }
    );
  }
}
