import { NextRequest, NextResponse } from "next/server";
import { list } from '@vercel/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = pathSegments.join('/');
    
    // 检查是否在 Vercel 环境中
    const isVercel = process.env.VERCEL === "1" || process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!isVercel) {
      // 在本地环境中，重定向到静态文件
      return NextResponse.redirect(new URL(`/${filePath}`, request.url));
    }
    
    // 在 Vercel 环境中，从 Blob 存储获取文件
    try {
      const blobs = await list({ prefix: filePath, limit: 1 });
      
      if (blobs.blobs.length === 0) {
        return new NextResponse('File not found', { status: 404 });
      }
      
      const blob = blobs.blobs[0];
      const response = await fetch(blob.url);
      
      if (!response.ok) {
        return new NextResponse('File not found', { status: 404 });
      }
      
      const buffer = await response.arrayBuffer();
      
      // 根据文件扩展名设置适当的 Content-Type
      let contentType = 'application/octet-stream';
      if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      }
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Error fetching file from blob storage:', error);
      return new NextResponse('File not found', { status: 404 });
    }
  } catch (error) {
    console.error('Error in file API:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
