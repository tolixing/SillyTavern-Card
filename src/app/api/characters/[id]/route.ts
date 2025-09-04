import { NextRequest, NextResponse } from "next/server";
import { StorageAdapter } from "../../../lib/storage";

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

interface IndexFile {
  repository_version: string;
  last_updated: string;
  characters: Character[];
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: characterId } = await params;

    // Read the index file
    let indexData: IndexFile;
    try {
      indexData = await StorageAdapter.readIndex();
    } catch {
      return NextResponse.json(
        { message: "Index file not found or is corrupted." },
        { status: 500 }
      );
    }

    // Find the character to delete
    const characterIndex = indexData.characters.findIndex(
      (char) => char.id === characterId
    );

    if (characterIndex === -1) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    // Remove the character from the index
    indexData.characters.splice(characterIndex, 1);
    indexData.last_updated = new Date().toISOString();

    // Delete the character's files
    await StorageAdapter.deleteCharacterFiles(characterId);

    // Write the updated index back to storage
    await StorageAdapter.saveIndex(indexData);

    return NextResponse.json({
      message: "Character deleted successfully.",
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
    const { id: characterId } = await params;
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const version = formData.get("version") as string;
    const description = formData.get("description") as string;
    const file = formData.get("file") as File | null;

    // Read the index file
    let indexData: IndexFile;
    try {
      indexData = await StorageAdapter.readIndex();
    } catch {
      return NextResponse.json(
        { message: "Index file not found or is corrupted." },
        { status: 500 }
      );
    }

    // Find the character to update
    const characterIndex = indexData.characters.findIndex(
      (char) => char.id === characterId
    );

    if (characterIndex === -1) {
      return NextResponse.json(
        { message: "Character not found." },
        { status: 404 }
      );
    }

    const characterToUpdate = indexData.characters[characterIndex];

    // If a new file is uploaded, process it
    if (file) {
      if (file.type !== "image/png") {
        return NextResponse.json(
          { message: "Invalid file type. Only PNG is allowed." },
          { status: 400 }
        );
      }
      
      // Remove old files
      await StorageAdapter.deleteCharacterFiles(characterId);

      const buffer = Buffer.from(await file.arrayBuffer());

      // --- Parse new metadata ---
      const metadata = parsePngMetadata(buffer);
      const charaDataString = metadata.tEXt?.chara;
      if (!charaDataString || typeof charaDataString !== 'string') {
          return NextResponse.json({ message: "Character data not found in new PNG." }, { status: 400 });
      }
      const cardData = JSON.parse(Buffer.from(charaDataString, 'base64').toString('utf-8'));
      const specData = cardData.data;

      // Save new card and avatar to storage
      const cardPath = `characters/${characterId}/card.png`;
      const avatarPath = `characters/${characterId}/avatar.png`;
      
      await StorageAdapter.saveFile(cardPath, buffer, 'image/png');
      
      const avatarDataString = metadata.tEXt?.char_avatar;
      if (avatarDataString && typeof avatarDataString === 'string') {
          await StorageAdapter.saveFile(avatarPath, Buffer.from(avatarDataString, 'base64'), 'image/png');
      } else {
          await StorageAdapter.saveFile(avatarPath, buffer, 'image/png');
      }
      
      // Update character with new metadata
      characterToUpdate.name = specData.name || "Unnamed";
      characterToUpdate.author = specData.creator || "Unknown Author";
      characterToUpdate.version = specData.character_version || "1.0";
      characterToUpdate.description = specData.description || "No description.";
      characterToUpdate.first_mes = specData.first_mes || "";

    } else {
      // If no new file, just update the text fields
      characterToUpdate.name = name;
      characterToUpdate.version = version;
      characterToUpdate.description = description;
    }

    // Update timestamp and save the index file
    characterToUpdate.last_updated = new Date().toISOString();
    indexData.last_updated = new Date().toISOString();

    await StorageAdapter.saveIndex(indexData);

    return NextResponse.json({
      message: "Character updated successfully.",
      character: characterToUpdate,
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