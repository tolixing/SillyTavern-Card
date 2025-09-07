import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { storage, type Character } from "../../../lib/storage";
import { requireAuth } from "../../../lib/middleware";
import type { CardSpecV2 } from "@/app/types/card";

// 文件验证状态
interface FileValidation {
  file: File;
  originalName: string;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'uploaded' | 'failed';
  errors: string[];
  warnings: string[];
  parsedData?: CardSpecV2;
  characterId?: string;
}

// 批量上传结果
interface BatchUploadResult {
  total: number;
  successful: FileValidation[];
  failed: FileValidation[];
  skipped: FileValidation[];
  summary: {
    successCount: number;
    failCount: number;
    skipCount: number;
  };
}

// PNG 元数据解析函数
function parsePngMetadata(buffer: Buffer) {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const chunks: { [key: string]: string } = {};
  let offset = 8;

  while (offset < buffer.length - 8) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === 'tEXt') {
      const nullIndex = data.indexOf(0);
      if (nullIndex !== -1) {
        const keyword = data.subarray(0, nullIndex).toString('ascii');
        const text = data.subarray(nullIndex + 1).toString('ascii');
        chunks[keyword] = text;
      }
    }
  }

  return { tEXt: chunks };
}

// 去除 PNG 元数据
function removePngMetadata(buffer: Buffer): Buffer {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }

  const result: Buffer[] = [PNG_SIGNATURE];
  let offset = 8;

  while (offset < buffer.length - 8) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    const crc = buffer.subarray(offset, offset + 4);
    offset += 4;

    if (type === 'IHDR' || type === 'IDAT' || type === 'IEND' || 
        (type === 'PLTE' && length > 0) || 
        (type === 'tRNS' && length > 0)) {
      result.push(Buffer.alloc(4));
      result[result.length - 1].writeUInt32BE(length, 0);
      result.push(Buffer.from(type, 'ascii'));
      result.push(data);
      result.push(crc);
    }
  }

  return Buffer.concat(result);
}

// 验证单个文件
async function validateFile(file: File): Promise<FileValidation> {
  const validation: FileValidation = {
    file,
    originalName: file.name,
    status: 'validating',
    errors: [],
    warnings: []
  };

  try {
    // 基础验证
    if (file.type !== "image/png") {
      validation.errors.push("文件类型不正确，只支持PNG格式");
      validation.status = 'invalid';
      return validation;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB限制
      validation.errors.push("文件大小超过10MB限制");
      validation.status = 'invalid';
      return validation;
    }

    // PNG元数据解析
    const buffer = Buffer.from(await file.arrayBuffer());
    const metadata = parsePngMetadata(buffer);
    const charaDataString = metadata.tEXt?.chara;

    if (!charaDataString) {
      validation.errors.push("未找到角色卡元数据");
      validation.status = 'invalid';
      return validation;
    }

    // 解析角色卡数据
    const cardData = JSON.parse(Buffer.from(charaDataString, 'base64').toString('utf-8'));
    const data = (cardData?.data || {}) as CardSpecV2;
    validation.parsedData = data;

    // 智能修复缺失字段
    if (!data.name) {
      data.name = file.name.replace(/\.[^/.]+$/, ""); // 从文件名提取
      validation.warnings.push("角色名称缺失，已从文件名提取");
    }

    if (!data.description) {
      data.description = "自动上传的角色卡";
      validation.warnings.push("描述缺失，已使用默认描述");
    }

    if (!data.character_version) {
      data.character_version = "1.0";
      validation.warnings.push("版本号缺失，已使用默认版本1.0");
    }

    validation.status = 'valid';
    return validation;

  } catch (error) {
    validation.errors.push(`文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    validation.status = 'invalid';
    return validation;
  }
}

// 上传单个角色卡
async function uploadSingleCharacter(validation: FileValidation): Promise<void> {
  if (validation.status !== 'valid' || !validation.parsedData) {
    throw new Error("文件验证未通过");
  }

  const characterId = uuidv4();
  validation.characterId = characterId;

  const buffer = Buffer.from(await validation.file.arrayBuffer());
  
  // 保存角色卡文件
  const cardFileName = `${characterId}/card.png`;
  const cardUrl = await storage.saveFile(cardFileName, buffer, 'image/png');

  // 创建头像
  const avatarFileName = `${characterId}/avatar.png`;
  const cleanImageBuffer = removePngMetadata(buffer);
  const avatarUrl = await storage.saveFile(avatarFileName, cleanImageBuffer, 'image/png');

  // 更新索引
  const specData = validation.parsedData;

  const newCharacter: Character = {
    id: characterId,
    name: specData.name || "Unnamed",
    author: specData.creator || "Unknown Author",
    version: specData.character_version || "1.0",
    description: specData.description || "No description.",
    tags: [],
    first_mes: specData.first_mes || "",
    avatar_url: avatarUrl,
    card_url: cardUrl,
    last_updated: new Date().toISOString(),
    upload_time: new Date().toISOString(),
    download_count: 0,
  };

  await storage.updateIndex((indexData) => {
    indexData.characters.push(newCharacter);
  });
  validation.status = 'uploaded';
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const user = requireAuth(request);
    if (!user.isAdmin) {
      return NextResponse.json(
        { message: "需要管理员权限才能批量上传角色卡" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files: File[] = [];
    
    // 收集所有文件
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('files[') && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { message: "未找到要上传的文件" },
        { status: 400 }
      );
    }

    // 第一阶段：验证所有文件
    const validations: FileValidation[] = [];
    for (const file of files) {
      try {
        const validation = await validateFile(file);
        validations.push(validation);
      } catch (error) {
        validations.push({
          file,
          originalName: file.name,
          status: 'invalid',
          errors: [`验证过程出错: ${error instanceof Error ? error.message : '未知错误'}`],
          warnings: []
        });
      }
    }

    // 第二阶段：上传有效文件（乐观处理）
    const successful: FileValidation[] = [];
    const failed: FileValidation[] = [];
    const skipped: FileValidation[] = [];

    for (const validation of validations) {
      if (validation.status === 'valid') {
        try {
          await uploadSingleCharacter(validation);
          successful.push(validation);
        } catch (error) {
          validation.status = 'failed';
          validation.errors.push(`上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
          failed.push(validation);
        }
      } else {
        skipped.push(validation);
      }
    }

    const result: BatchUploadResult = {
      total: files.length,
      successful,
      failed,
      skipped,
      summary: {
        successCount: successful.length,
        failCount: failed.length,
        skipCount: skipped.length
      }
    };

    return NextResponse.json({
      message: `批量上传完成：成功 ${result.summary.successCount} 个，失败 ${result.summary.failCount} 个，跳过 ${result.summary.skipCount} 个`,
      result
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { message: "批量上传过程中发生错误", error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
