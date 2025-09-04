"use client";

import { useState } from "react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // 自动解析角色卡信息
      try {
        const buffer = await selectedFile.arrayBuffer();
        const metadata = parsePngMetadata(Buffer.from(buffer));
        const charaDataString = metadata.tEXt?.chara;
        
        if (charaDataString) {
          const cardData = JSON.parse(Buffer.from(charaDataString, 'base64').toString('utf-8'));
          const specData = cardData.data;
          
          setName(specData.name || "");
          setDescription(specData.description || "");
          setVersion(specData.character_version || "1.0");
        }
      } catch {
        console.log("无法自动解析角色卡信息，请手动填写");
      }
    }
  };

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
          const keyword = data.subarray(0, nullIndex).toString('latin1');
          const text = data.subarray(nullIndex + 1).toString('latin1');
          chunks[keyword] = text;
        }
      }

      if (type === 'IEND') {
        break;
      }
    }

    return { tEXt: chunks };
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setMessage("请选择角色卡文件。");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("version", version);
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setMessage(`成功：${result.message}`);
        // 重置表单
        setName("");
        setDescription("");
        setVersion("1.0");
        setFile(null);
        setTimeout(() => {
          onSuccess();
          onClose();
          setMessage("");
        }, 1500);
      } else {
        setMessage(`错误：${result.message}`);
      }
    } catch (error) {
      setMessage("发生未知错误。");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setVersion("1.0");
    setFile(null);
    setMessage("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">上传角色卡</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 文件上传放在首位 */}
            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
                角色卡文件 (.png) *
              </label>
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                accept=".png"
                required
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <p className="text-xs text-gray-500 mt-1">上传后将自动解析角色信息</p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                名称 *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="version" className="block text-sm font-medium text-gray-700 mb-1">
                版本 *
              </label>
              <input
                type="text"
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                描述 *
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              >
                {isSubmitting ? "上传中..." : "上传"}
              </button>
            </div>
          </form>
          
          {message && (
            <p className={`mt-4 text-center text-sm ${
              message.startsWith("错误") ? "text-red-500" : "text-green-500"
            }`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
