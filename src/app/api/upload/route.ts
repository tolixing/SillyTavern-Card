import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { storage, type Character } from "../../lib/storage";
import { requireAuth } from "../../lib/middleware";
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
        const compMethod = data.readUInt8(i + 1); // 0 = deflate
        const compData = data.subarray(i + 2);
        try {
          const inflated = compMethod === 0 ? inflateSync(compData) : compData;
          const text = inflated.toString('utf8');
          map[keyword] = text;
        } catch {
          // ignore
        }
      }
    } else if (type === 'iTXt') {
      // keyword (latin1)\0 compFlag(1) compMethod(1) langTag\0 translatedKeyword(utf8)\0 text(utf8 or compressed)
      let p = 0;
      const i = data.indexOf(0, p);
      if (i === -1) continue;
      const keyword = data.subarray(p, i).toString('latin1');
      p = i + 1;
      if (p + 2 > data.length) continue;
      const compFlag = data.readUInt8(p); p += 1;
      const compMethod = data.readUInt8(p); p += 1;
      const j = data.indexOf(0, p);
      if (j === -1) continue; // language tag
      // const langTag = data.subarray(p, j).toString('ascii');
      p = j + 1;
      const k = data.indexOf(0, p);
      if (k === -1) continue; // translated keyword utf8
      // const translated = data.subarray(p, k).toString('utf8');
      p = k + 1;
      try {
        const textBytes = data.subarray(p);
        const text = compFlag === 1 && compMethod === 0 
          ? inflateSync(textBytes).toString('utf8')
          : textBytes.toString('utf8');
        map[keyword] = text;
      } catch {
        // ignore
      }
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
    if (t.startsWith('{') || t.startsWith('[')) {
      return JSON.parse(t);
    }
    throw new Error('not-json');
  };

  // 1) 尝试直接 JSON
  try {
    return tryJson(raw);
  } catch {}

  // 2) 尝试 base64 → JSON
  try {
    const buf = Buffer.from(raw, 'base64');
    const text = buf.toString('utf8');
    return JSON.parse(text);
  } catch {}

  // 3) 尝试 base64 → inflate → JSON（极少数情况）
  try {
    const buf = Buffer.from(raw, 'base64');
    const inflated = inflateSync(buf);
    const text = inflated.toString('utf8');
    return JSON.parse(text);
  } catch {}

  throw new Error('无法解析角色卡数据（既非JSON也非base64 JSON）');
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const user = requireAuth(request);
    if (!user.isAdmin) {
      return NextResponse.json(
        { message: "需要管理员权限才能上传角色卡" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const version = formData.get("version") as string;

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

    // --- 解析 PNG 元数据（兼容 tEXt/zTXt/iTXt） ---
    const charaDataString = extractCharaFromPng(buffer);

    if (!charaDataString || typeof charaDataString !== 'string') {
        return NextResponse.json(
            { message: "Character data not found in PNG metadata." },
            { status: 400 }
        );
    }
    
    // 解析 JSON（支持直接JSON或base64 JSON）
    const cardData: CardData = parseCharaPayload(charaDataString);
    
    // 保存角色卡文件到存储
    const cardFileName = `${characterId}/card.png`;
    const cardUrl = await storage.saveFile(cardFileName, buffer, 'image/png');

    // 创建去除元数据的纯图片作为头像
    const avatarFileName = `${characterId}/avatar.png`;
    const cleanImageBuffer = removePngMetadata(buffer);
    const avatarUrl = await storage.saveFile(avatarFileName, cleanImageBuffer, 'image/png');

    // --- 更新 index.json ---
    const specData = cardData.data;

    const newCharacter: Character = {
      id: characterId,
      name: name || specData.name || "Unnamed",
      author: specData.creator || "Unknown Author",
      version: version || specData.character_version || "1.0",
      description: description || specData.description || "No description.",
      tags: [], // 标签可以后续从其他元数据字段解析
      first_mes: specData.first_mes || "",
      avatar_url: avatarUrl,
      card_url: cardUrl,
      last_updated: new Date().toISOString(),
      upload_time: new Date().toISOString(),
      download_count: 0,
    };

    // 串行化索引更新，避免并发丢写
    await storage.updateIndex((indexData) => {
      indexData.characters.push(newCharacter);
    });

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
