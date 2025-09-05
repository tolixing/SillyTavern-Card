import { NextRequest, NextResponse } from "next/server";
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');
    
    // 构建完整的文件路径
    // 在 Docker 环境中，文件可能保存在卷中
    const fullPath = join(process.cwd(), 'public', filePath);
    
    try {
      // 读取文件
      const buffer = await readFile(fullPath);
      
      // 根据文件扩展名设置适当的 Content-Type
      let contentType = 'application/octet-stream';
      if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filePath.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (filePath.endsWith('.webp')) {
        contentType = 'image/webp';
      }
      
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Error reading file:', error);
      return new NextResponse('File not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in file API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}