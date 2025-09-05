import { readFile, writeFile, mkdir, rm, access } from 'fs/promises';
import { join } from 'path';

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

// 本地文件系统存储适配器
class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;
  private charactersPath: string;
  private indexPath: string;

  constructor() {
    this.basePath = process.cwd();
    this.charactersPath = join(this.basePath, 'public', 'characters');
    this.indexPath = join(this.basePath, 'public', 'index.json');
  }

  async saveFile(fileName: string, data: Buffer, contentType: string): Promise<string> {
    const filePath = join(this.charactersPath, fileName);
    
    console.log('Storage - Saving file:', fileName);
    console.log('Storage - File path:', filePath);
    console.log('Storage - Characters path:', this.charactersPath);
    
    // 确保文件的父目录存在
    const fileDir = join(filePath, '..');
    await mkdir(fileDir, { recursive: true });
    
    // 写入文件
    await writeFile(filePath, data);
    
    const returnPath = `/api/files/characters/${fileName}`;
    console.log('Storage - Return path:', returnPath);
    
    // 返回文件服务 API 路径，用于前端访问
    return returnPath;
  }

  async deleteCharacterFiles(characterId: string): Promise<void> {
    const characterDir = join(this.charactersPath, characterId);
    
    try {
      // 检查目录是否存在
      await access(characterDir);
      // 删除整个角色目录
      await rm(characterDir, { recursive: true, force: true });
    } catch {
      // 目录不存在，忽略错误
    }
  }

  async readIndex(): Promise<IndexFile> {
    try {
      const data = await readFile(this.indexPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // 如果文件不存在，返回空索引
      return {
        repository_version: "1.0.0",
        last_updated: new Date().toISOString(),
        characters: []
      };
    }
  }

  async saveIndex(data: IndexFile): Promise<void> {
    // 确保目录存在
    await mkdir(join(this.basePath, 'public'), { recursive: true });
    
    // 更新最后更新时间
    data.last_updated = new Date().toISOString();
    
    // 写入索引文件
    await writeFile(this.indexPath, JSON.stringify(data, null, 2));
  }
}

// 存储适配器接口
interface StorageAdapter {
  saveFile(fileName: string, data: Buffer, contentType: string): Promise<string>;
  deleteCharacterFiles(characterId: string): Promise<void>;
  readIndex(): Promise<IndexFile>;
  saveIndex(data: IndexFile): Promise<void>;
}

// 创建存储适配器实例
const storage = new LocalStorageAdapter();

export { storage, type Character, type IndexFile };