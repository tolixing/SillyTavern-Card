import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../lib/middleware";
import type { CardSpecV2, ServerValidation } from "@/app/types/card";

// 兼容 Node 运行时，避免使用全局 File/Blob 的 instanceof
type UploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function isUploadFile(value: unknown): value is UploadFile {
  if (!value || typeof value !== 'object') return false;
  const v = value as { name?: unknown; type?: unknown; size?: unknown; arrayBuffer?: unknown };
  return (
    typeof v.name === 'string' &&
    typeof v.type === 'string' &&
    typeof v.size === 'number' &&
    typeof v.arrayBuffer === 'function'
  );
}

// 使用共享的 ServerValidation，parsedData 类型明确为 CardSpecV2

// PNG 元数据解析函数（服务端）
function parsePngMetadata(buffer: Buffer) {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a valid PNG file");
  }
  const chunks: { [key: string]: string } = {};
  let offset = 8; // 跳过签名
  while (offset < buffer.length - 8) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    // CRC
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

export async function POST(request: NextRequest) {
  try {
    // 权限校验
    const user = requireAuth(request);
    if (!user.isAdmin) {
      return NextResponse.json(
        { message: "需要管理员权限" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const files: UploadFile[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('files[') && isUploadFile(value)) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ message: '未提供文件', results: [] }, { status: 400 });
    }

    const results: ServerValidation[] = [];
    for (const file of files) {
      const v: ServerValidation = {
        originalName: file.name,
        status: 'invalid',
        errors: [],
        warnings: [],
      };

      // 类型/大小
      if (file.type !== 'image/png') {
        v.errors.push('文件类型不正确，只支持PNG格式');
        results.push(v);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        v.errors.push('文件大小超过10MB限制');
        results.push(v);
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const metadata = parsePngMetadata(buffer);
        const charaDataString = metadata.tEXt?.chara;
        if (!charaDataString) {
          v.errors.push('未找到角色卡元数据');
          results.push(v);
          continue;
        }
        const cardData = JSON.parse(Buffer.from(charaDataString, 'base64').toString('utf-8'));
        const parsed = cardData?.data || {};

        if (!parsed.name) {
          parsed.name = file.name.replace(/\.[^/.]+$/, "");
          v.warnings.push('角色名称缺失，已从文件名提取');
        }
        if (!parsed.description) {
          parsed.description = '自动上传的角色卡';
          v.warnings.push('描述缺失，已使用默认描述');
        }
        if (!parsed.character_version) {
          parsed.character_version = '1.0';
          v.warnings.push('版本号缺失，已使用默认版本1.0');
        }

        v.parsedData = parsed;
        v.status = 'valid';
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '未知错误';
        v.errors.push(`文件解析失败: ${msg}`);
      }

      results.push(v);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Validate error:', error);
    return NextResponse.json(
      { message: '校验失败', error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
