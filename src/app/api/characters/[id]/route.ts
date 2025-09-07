import { NextRequest, NextResponse } from "next/server";
import { storage, type Character } from "../../../lib/storage";
import { requireAuth } from "../../../lib/middleware";
import { inflateSync } from 'zlib';

// 从 PNG 中提取 chara 文本，支持 tEXt / zTXt / iTXt
function extractCharaFromPng(buffer: Buffer): string | null {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const map: Record<string, string> = {};
  let offset = 8;
  while (offset < buffer.length - 8) {
    const length = buffer.readUInt32BE(offset); offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii'); offset += 4;
    const data = buffer.subarray(offset, offset + length); offset += length;
    offset += 4; // CRC

    if (type === 'tEXt') {
      const i = data.indexOf(0);
      if (i !== -1) {
        const keyword = data.subarray(0, i).toString('latin1');
        const text = data.subarray(i + 1).toString('latin1');
        map[keyword] = text;
      }
    } else if (type === 'zTXt') {
      const i = data.indexOf(0);
      if (i !== -1 && i + 1 < data.length) {
        const keyword = data.subarray(0, i).toString('latin1');
        const compMethod = data.readUInt8(i + 1);
        const compData = data.subarray(i + 2);
        try {
          const inflated = compMethod === 0 ? inflateSync(compData) : compData;
          const text = inflated.toString('utf8');
          map[keyword] = text;
        } catch {}
      }
    } else if (type === 'iTXt') {
      let p = 0;
      const i = data.indexOf(0, p);
      if (i === -1) continue;
      const keyword = data.subarray(p, i).toString('latin1');
      p = i + 1;
      if (p + 2 > data.length) continue;
      const compFlag = data.readUInt8(p); p += 1;
      const compMethod = data.readUInt8(p); p += 1;
      const j = data.indexOf(0, p); if (j === -1) continue; p = j + 1; // lang tag
      const k = data.indexOf(0, p); if (k === -1) continue; p = k + 1; // translated
      try {
        const textBytes = data.subarray(p);
        const text = compFlag === 1 && compMethod === 0 
          ? inflateSync(textBytes).toString('utf8')
          : textBytes.toString('utf8');
        map[keyword] = text;
      } catch {}
    }
  }

  return map['chara'] || map['chara_card_v2'] || null;
}

// 去除 PNG 元数据，保留纯图片数据
function removePngMetadata(buffer: Buffer): Buffer {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // 检查 PNG 签名
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const result: Buffer[] = [PNG_SIGNATURE];
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

    // 读取 CRC (4 bytes)
    const crc = buffer.subarray(offset, offset + 4);
    offset += 4;

    // 只保留必要的 chunks，移除元数据 chunks
    if (type === 'IHDR' || type === 'IDAT' || type === 'IEND' || 
        (type === 'PLTE' && length > 0) || 
        (type === 'tRNS' && length > 0)) {
      // 保留这些 chunks
      result.push(Buffer.alloc(4));
      result[result.length - 1].writeUInt32BE(length, 0); // 长度
      result.push(Buffer.from(type, 'ascii')); // 类型
      result.push(data); // 数据
      result.push(crc); // CRC
    }
    // 跳过 tEXt, zTXt, iTXt 等元数据 chunks
  }

  return Buffer.concat(result);
}

// 定义从角色卡 PNG 元数据中解析出的数据结构
interface CardSpecV2 {
  name?: string;
  description?: string;
  first_mes?: string;
  creator?: string; 
  character_version?: string;
}

interface CardData {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CardSpecV2;
}

function parseCharaPayload(raw: string): CardData {
  const tryJson = (s: string) => {
    const t = s.trim();
    if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
    throw new Error('not-json');
  };
  try { return tryJson(raw); } catch {}
  try {
    const text = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(text);
  } catch {}
  try {
    const inflated = inflateSync(Buffer.from(raw, 'base64')).toString('utf8');
    return JSON.parse(inflated);
  } catch {}
  throw new Error('无法解析角色卡数据');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证管理员权限
    const user = requireAuth(request);
    if (!user.isAdmin) {
      return NextResponse.json(
        { message: "需要管理员权限才能删除角色卡" },
        { status: 403 }
      );
    }

    const { id: characterId } = await params;
    
    // 读取当前索引并检查是否存在
    const indexData = await storage.readIndex();
    const characterIndex = indexData.characters.findIndex(char => char.id === characterId);
    if (characterIndex === -1) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    // 删除角色文件（不持有索引锁）
    await storage.deleteCharacterFiles(characterId);
    // 串行化索引变更（移除该角色）
    await storage.updateIndex((data) => {
      const i = data.characters.findIndex(c => c.id === characterId);
      if (i !== -1) data.characters.splice(i, 1);
    });

    return NextResponse.json({
      message: "Character deleted successfully!",
    });
  } catch (error) {
    console.error("Delete error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "An error occurred during deletion.", error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证管理员权限
    const user = requireAuth(request);
    if (!user.isAdmin) {
      return NextResponse.json(
        { message: "需要管理员权限才能编辑角色卡" },
        { status: 403 }
      );
    }

    const { id: characterId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    let name = formData.get("name") as string;
    let description = formData.get("description") as string;
    let version = formData.get("version") as string;

    // 读取当前索引并检查是否存在
    const indexData = await storage.readIndex();
    const characterIndex = indexData.characters.findIndex(char => char.id === characterId);
    if (characterIndex === -1) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    const existingCharacter = indexData.characters[characterIndex];
    let cardUrl = existingCharacter.card_url;
    let avatarUrl = existingCharacter.avatar_url;

    // 如果上传了新文件，处理文件更新
    if (file && file.type === "image/png") {
      // 删除旧文件
      await storage.deleteCharacterFiles(characterId);
      
      // 读取新文件的 buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // 解析 PNG 元数据（更健壮）
      const charaDataString = extractCharaFromPng(buffer);

      if (charaDataString && typeof charaDataString === 'string') {
        const cardData: CardData = parseCharaPayload(charaDataString);
        const specData = cardData.data;

        // 保存新的角色卡文件
        const cardFileName = `${characterId}/card.png`;
        cardUrl = await storage.saveFile(cardFileName, buffer, 'image/png');

        // 创建去除元数据的纯图片作为头像
        const avatarFileName = `${characterId}/avatar.png`;
        const cleanImageBuffer = removePngMetadata(buffer);
        avatarUrl = await storage.saveFile(avatarFileName, cleanImageBuffer, 'image/png');

        // 如果从元数据中解析到了信息，使用解析的信息
        if (specData.name) name = name || specData.name;
        if (specData.description) description = description || specData.description;
        if (specData.character_version) version = version || specData.character_version;
      } else {
        // 如果没有元数据，直接保存文件
        const cardFileName = `${characterId}/card.png`;
        cardUrl = await storage.saveFile(cardFileName, buffer, 'image/png');
        
        // 创建去除元数据的纯图片作为头像
        const cleanImageBuffer = removePngMetadata(buffer);
        avatarUrl = await storage.saveFile(`${characterId}/avatar.png`, cleanImageBuffer, 'image/png');
      }
    }

    // 更新索引中的角色（串行化）
    const updatedCharacter: Character = {
      ...existingCharacter,
      name: name || existingCharacter.name,
      description: description || existingCharacter.description,
      version: version || existingCharacter.version,
      card_url: cardUrl,
      avatar_url: avatarUrl,
      last_updated: new Date().toISOString(),
      upload_time: existingCharacter.upload_time || new Date().toISOString(),
      download_count: existingCharacter.download_count || 0,
    };
    await storage.updateIndex((data) => {
      const i = data.characters.findIndex(c => c.id === characterId);
      if (i !== -1) {
        data.characters[i] = updatedCharacter;
      }
    });

    return NextResponse.json({
      message: "Character updated successfully!",
      character: updatedCharacter,
    });
  } catch (error) {
    console.error("Update error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "An error occurred during update.", error: errorMessage },
      { status: 500 }
    );
  }
}
