import { NextRequest, NextResponse } from "next/server";
import { storage } from "../../../lib/storage";
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;
    
    // 读取当前索引
    const indexData = await storage.readIndex();
    
    // 查找角色
    const character = indexData.characters.find(char => char.id === characterId);
    
    if (!character) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    // 增加下载次数
    character.download_count = (character.download_count || 0) + 1;
    character.last_updated = new Date().toISOString();
    
    // 保存更新后的索引
    await storage.saveIndex(indexData);

    // 读取角色卡文件
    const basePath = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
    const filePath = join(basePath, 'characters', characterId, 'card.png');
    
    try {
      const fileBuffer = await readFile(filePath);
      
      // 返回文件下载
      return new Response(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${character.name}_v${character.version}.png"`,
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
