"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

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
  const { token } = useAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // 自动解析角色卡信息
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const metadata = parsePngMetadata(arrayBuffer);
        const charaDataString = metadata.tEXt?.chara;
        
        if (charaDataString) {
          const cardData = JSON.parse(atob(charaDataString));
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

  // PNG 元数据解析函数（浏览器环境）
  function parsePngMetadata(arrayBuffer: ArrayBuffer) {
    const signature = new Uint8Array(arrayBuffer, 0, 8);
    const PNG_SIGNATURE = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    ]);

    for (let i = 0; i < 8; i++) {
      if (signature[i] !== PNG_SIGNATURE[i]) {
        throw new Error("Not a valid PNG file");
      }
    }

    const chunks: { [key: string]: string } = {};
    const view = new DataView(arrayBuffer);
    let offset = 8;

    const readType = (off: number) => {
      const bytes = new Uint8Array(arrayBuffer, off, 4);
      return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    };

    while (offset + 8 <= arrayBuffer.byteLength) {
      const length = view.getUint32(offset, false); // big-endian
      offset += 4;
      const type = readType(offset);
      offset += 4;

      if (offset + length + 4 > arrayBuffer.byteLength) break;

      const dataBytes = new Uint8Array(arrayBuffer, offset, length);
      offset += length;

      // skip CRC
      offset += 4;

      if (type === 'tEXt') {
        const nullIndex = dataBytes.indexOf(0);
        if (nullIndex !== -1) {
          const keyword = String.fromCharCode(
            ...dataBytes.subarray(0, nullIndex)
          );
          const text = String.fromCharCode(
            ...dataBytes.subarray(nullIndex + 1)
          );
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
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setMessage(`成功：${result.message}`);
        // 立即刷新数据
        onSuccess();
        // 重置表单
        setName("");
        setDescription("");
        setVersion("1.0");
        setFile(null);
        // 延迟关闭弹窗，给用户时间看到成功消息
        setTimeout(() => {
          onClose();
          setMessage("");
        }, 1000);
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
