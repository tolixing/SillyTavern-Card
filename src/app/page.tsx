"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import UploadModal from "./components/UploadModal";
import EditModal from "./components/EditModal";

interface Character {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  card_url: string;
  avatar_url: string;
  tags: string[];
  upload_time: string;
  download_count: number;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [showDescModal, setShowDescModal] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const response = await fetch(`/api/index?_=${new Date().getTime()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch character index.");
        }
        const data = await response.json();
        setCharacters(data.characters || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
  }, []);

  const filteredCharacters = useMemo(() => {
    if (!searchTerm) {
      return characters;
    }
    return characters.filter(
      (char) =>
        char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        char.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        char.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (char.tags &&
          char.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          ))
    );
  }, [characters, searchTerm]);

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这个角色卡吗？")) {
      try {
        const response = await fetch(`/api/characters/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete character.");
        }

        // Remove the character from the state to update the UI
        setCharacters((prev) => prev.filter((char) => char.id !== id));
        
        // 强制刷新数据以确保与服务器同步
        setTimeout(() => {
          refreshCharacters();
        }, 1000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred."
        );
      }
    }
  };

  const handleEdit = (character: Character) => {
    setEditingCharacter(character);
    setShowEditModal(true);
  };

  const handleShowDescription = (character: Character) => {
    setSelectedCharacter(character);
    setShowDescModal(true);
  };

  const refreshCharacters = async () => {
    try {
      const response = await fetch(`/api/index?_=${new Date().getTime()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch character index.");
      }
      const data = await response.json();
      setCharacters(data.characters || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">角色卡中心1</h1>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="搜索角色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 whitespace-nowrap transition-colors"
            >
              上传角色卡
            </button>
            <a
              href="/index.json"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 whitespace-nowrap transition-colors"
            >
              API
            </a>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCharacters.length > 0 ? (
            filteredCharacters.map((char) => (
              <div
                key={char.id}
                className="relative rounded-lg shadow-lg overflow-hidden aspect-[3/4] group cursor-pointer transition-transform duration-300 hover:scale-105"
                onClick={() => handleShowDescription(char)}
              >
                {/* 背景图片 */}
                <Image
                  src={char.avatar_url}
                  alt={`${char.name}'s avatar`}
                  fill
                  style={{ objectFit: "cover" }}
                  className="bg-gray-200 transition-all duration-300"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
                
                {/* 底部信息区域 - 带动态模糊背景 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm p-4">
                  <div className="text-white">
                    <h2 className="text-lg font-bold truncate mb-3">{char.name}</h2>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-white/20 text-white px-2 py-1 rounded backdrop-blur-sm">
                          v{char.version}
                        </span>
                        <span className="text-xs bg-blue-500/80 text-white px-2 py-1 rounded backdrop-blur-sm">
                          {char.download_count || 0} 次下载
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/download/${char.id}`}
                          download
                          className="bg-green-500/80 hover:bg-green-600/90 text-white px-3 py-1 rounded-full text-xs transition-all duration-200 backdrop-blur-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          下载
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(char);
                          }}
                          className="bg-yellow-500/80 hover:bg-yellow-600/90 text-white px-3 py-1 rounded-full text-xs transition-all duration-200 backdrop-blur-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(char.id);
                          }}
                          className="bg-red-500/80 hover:bg-red-600/90 text-white px-3 py-1 rounded-full text-xs transition-all duration-200 backdrop-blur-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-full text-center text-gray-500">
              没有找到匹配的角色卡。
            </p>
          )}
        </div>
      </main>

      {/* 描述弹窗 */}
      {showDescModal && selectedCharacter && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDescModal(false)}
        >
          <div 
            className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{selectedCharacter.name}</h3>
                <button
                  onClick={() => setShowDescModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">版本：</span>
                  <span className="text-sm text-gray-800">v{selectedCharacter.version}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">上传时间：</span>
                  <span className="text-sm text-gray-800">
                    {selectedCharacter.upload_time ? new Date(selectedCharacter.upload_time).toLocaleString('zh-CN') : '未知'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">下载次数：</span>
                  <span className="text-sm text-gray-800">{selectedCharacter.download_count || 0} 次</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">描述：</span>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{selectedCharacter.description}</p>
                </div>
                {selectedCharacter.tags && selectedCharacter.tags.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">标签：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedCharacter.tags.map((tag, index) => (
                        <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 上传弹窗 */}
      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={refreshCharacters}
      />

      {/* 编辑弹窗 */}
      <EditModal 
        isOpen={showEditModal}
        character={editingCharacter}
        onClose={() => {
          setShowEditModal(false);
          setEditingCharacter(null);
        }}
        onSuccess={refreshCharacters}
      />
    </>
  );
}
