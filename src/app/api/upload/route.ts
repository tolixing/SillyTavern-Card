import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { StorageAdapter } from "../../lib/storage";

// PNG 元数据解析函数
function parsePngMetadata(buffer: Buffer) {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // 检查 PNG 签名
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const chunks: { [key: string]: string } = {};
  let offset = 8; // 跳过 PNG 签名

  while (offset < buffer.length - 8) {
    // 读取 chunk 长度 (4 bytes, big-endian)
    const length = buffer.readUInt32BE(offset);
    offset += 4;

    // 读取 chunk 类型 (4 bytes)
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;

    // 读取 chunk 数据
    const data = buffer.subarray(offset, offset + length);
    offset += length;

    // 跳过 CRC (4 bytes)
    offset += 4;

    // 处理 tEXt chunks
    if (type === 'tEXt') {
      const nullIndex = data.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = data.subarray(0, nullIndex).toString('latin1');
        const text = data.subarray(nullIndex + 1).toString('latin1');
        chunks[keyword] = text;
      }
    }

    // 如果遇到 IEND chunk，停止解析
    if (type === 'IEND') {
      break;
    }
  }

  return { tEXt: chunks };
}

// 定义角色和索引文件的数据结构
interface Character {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  tags: string[];
  first_mes: string;
  avatar_url: string;
  card_url: string;
  last_updated: string;
}


// 定义从角色卡 PNG 元数据中解析出的数据结构
interface CardSpecV2 {
  name?: string;
  description?: string;
  first_mes?: string;
  // 假设还有其他字段，例如作者、版本等
  creator?: string; 
  character_version?: string;
}

interface CardData {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CardSpecV2;
}


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file uploaded." },
        { status: 400 }
      );
    }

    if (file.type !== "image/png") {
      return NextResponse.json(
        { message: "Invalid file type. Only PNG is allowed." },
        { status: 400 }
      );
    }

    const characterId = uuidv4();

    // 读取上传文件的 buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // --- 解析 PNG 元数据 ---
    const metadata = parsePngMetadata(buffer);
    const charaDataString = metadata.tEXt?.chara;

    if (!charaDataString || typeof charaDataString !== 'string') {
        return NextResponse.json(
            { message: "Character data not found in PNG metadata." },
            { status: 400 }
        );
    }
    
    // Base64 解码并解析 JSON
    const cardData: CardData = JSON.parse(Buffer.from(charaDataString, 'base64').toString('utf-8'));
    
    // 保存角色卡文件到存储
    const cardPath = `characters/${characterId}/card.png`;
    await StorageAdapter.saveFile(cardPath, buffer, 'image/png');

    // 提取并保存头像
    const avatarPath = `characters/${characterId}/avatar.png`;
    const avatarDataString = metadata.tEXt?.char_avatar;
    
    if (avatarDataString && typeof avatarDataString === 'string') {
        const avatarBuffer = Buffer.from(avatarDataString, 'base64');
        await StorageAdapter.saveFile(avatarPath, avatarBuffer, 'image/png');
    } else {
        // 如果没有独立的头像数据，就将整个卡片复制为头像
        await StorageAdapter.saveFile(avatarPath, buffer, 'image/png');
    }

    // --- 更新 index.json ---
    const indexData = await StorageAdapter.readIndex();
    
    const specData = cardData.data;

    const newCharacter: Character = {
      id: characterId,
      name: specData.name || "Unnamed",
      author: specData.creator || "Unknown Author",
      version: specData.character_version || "1.0",
      description: specData.description || "No description.",
      tags: [], // 标签可以后续从其他元数据字段解析
      first_mes: specData.first_mes || "",
      avatar_url: avatarPath,
      card_url: cardPath,
      last_updated: new Date().toISOString(),
    };

    // 添加新角色并更新时间戳
    indexData.characters.push(newCharacter);
    indexData.last_updated = new Date().toISOString();

    // 将更新后的索引保存
    await StorageAdapter.saveIndex(indexData);

    return NextResponse.json({
      message: "Character card uploaded successfully!",
      character: newCharacter,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "An error occurred during upload.", error: errorMessage },
      { status: 500 }
    );
  }
}