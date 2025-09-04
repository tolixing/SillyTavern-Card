import { put, del, list } from '@vercel/blob';
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import path from "path";

interface Character {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  card_url: string;
  avatar_url: string;
  tags: string[];
  first_mes: string;
  last_updated: string;
}

interface IndexFile {
  repository_version: string;
  last_updated: string;
  characters: Character[];
}

// 检测是否在 Vercel 环境中
const isVercel = process.env.VERCEL === "1" || process.env.BLOB_READ_WRITE_TOKEN;

export class StorageAdapter {
  // 保存文件到 Blob 存储或本地文件系统
  static async saveFile(relativePath: string, buffer: Buffer, contentType: string = 'application/octet-stream'): Promise<string> {
    if (isVercel) {
      // 使用 Vercel Blob 存储
      const blob = await put(relativePath, buffer, {
        access: 'public',
        contentType,
      });
      return blob.url;
    } else {
      // 本地开发环境，保存到文件系统
      const fullPath = path.join(process.cwd(), "public", relativePath);
      const dir = path.dirname(fullPath);
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, buffer);
      return `/${relativePath}`;
    }
  }

  // 删除文件
  static async deleteFile(relativePath: string): Promise<void> {
    if (isVercel) {
      // 从 Blob 存储删除
      await del(relativePath);
    } else {
      // 从本地文件系统删除
      const fullPath = path.join(process.cwd(), "public", relativePath);
      await rm(fullPath, { recursive: true, force: true });
    }
  }

  // 保存索引文件
  static async saveIndex(indexData: IndexFile): Promise<void> {
    const indexContent = JSON.stringify(indexData, null, 2);
    
    if (isVercel) {
      // 保存到 Blob 存储
      await put('index.json', indexContent, {
        access: 'public',
        contentType: 'application/json',
      });
    } else {
      // 保存到本地文件系统
      const indexPath = path.join(process.cwd(), "public", "index.json");
      await writeFile(indexPath, indexContent);
    }
  }

  // 读取索引文件
  static async readIndex(): Promise<IndexFile> {
    if (isVercel) {
      // 从 Blob 存储读取
      try {
        const blobs = await list({ prefix: 'index.json', limit: 1 });
        if (blobs.blobs.length > 0) {
          const response = await fetch(blobs.blobs[0].url);
          const indexData = await response.json();
          return indexData;
        }
              } catch {
          console.log('No index file found in blob storage, creating new one');
        }
      
      // 如果没有找到，返回默认结构
      return {
        repository_version: "1.0.0",
        last_updated: new Date().toISOString(),
        characters: []
      };
    } else {
      // 从本地文件系统读取
      try {
        const indexPath = path.join(process.cwd(), "public", "index.json");
        const indexFileContent = await readFile(indexPath, "utf-8");
        return JSON.parse(indexFileContent);
      } catch {
        // 如果文件不存在，返回默认结构
        return {
          repository_version: "1.0.0",
          last_updated: new Date().toISOString(),
          characters: []
        };
      }
    }
  }

  // 删除角色相关的所有文件
  static async deleteCharacterFiles(characterId: string): Promise<void> {
    const cardPath = `characters/${characterId}/card.png`;
    const avatarPath = `characters/${characterId}/avatar.png`;
    
    try {
      await this.deleteFile(cardPath);
    } catch (error) {
      console.log(`Failed to delete card file: ${error}`);
    }
    
    try {
      await this.deleteFile(avatarPath);
    } catch (error) {
      console.log(`Failed to delete avatar file: ${error}`);
    }
  }
}
