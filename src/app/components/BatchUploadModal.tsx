"use client";

import { useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import type { CardSpecV2, ServerValidation, ValidateResponse } from "@/app/types/card";

interface FileValidation {
  file: File;
  originalName: string;
  status: 'pending' | 'validating' | 'valid' | 'invalid' | 'uploaded' | 'failed';
  errors: string[];
  warnings: string[];
  parsedData?: CardSpecV2;
  characterId?: string;
  finalName?: string;
}

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

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchUploadModal({ isOpen, onClose, onSuccess }: BatchUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileValidations, setFileValidations] = useState<FileValidation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'validate' | 'upload' | 'complete'>('select');
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  // 从环境变量读取并发数（客户端可见变量）
  const CONCURRENCY = useMemo(() => {
    const v = Number(process.env.NEXT_PUBLIC_BATCH_UPLOAD_CONCURRENCY);
    if (!isNaN(v) && v > 0) return v;
    return 3;
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setFileValidations([]);
    setUploadResult(null);
    setCurrentStep('select');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'image/png');
    setSelectedFiles(files);
    setFileValidations([]);
    setUploadResult(null);
    setCurrentStep('select');
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    if (newFiles.length === 0) {
      setCurrentStep('select');
      setFileValidations([]);
      setUploadResult(null);
    }
  };

  // 已改为后端校验，不再需要前端解析 PNG 元数据

  // 名称去重：名称, 名称 (2), 名称 (3) ...（基于现有索引和当前批次）
  function getUniqueName(base: string, used: Set<string>) {
    let name = base.trim();
    if (!name) name = "Unnamed";
    let candidate = name;
    let counter = 2;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${name} (${counter++})`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }

  async function runLocalValidationAndUpload() {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setErrorMessage("");
    setOverallProgress(0);
    setCurrentStep('validate');

    try {
      // 先请求后端校验，获取权威校验结果
      const fd = new FormData();
      selectedFiles.forEach((file, index) => fd.append(`files[${index}]`, file));
      const valResp = await fetch('/api/upload/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: fd,
      });
      if (!valResp.ok) {
        const data = await valResp.json().catch(() => ({}));
        throw new Error(data?.message || '后端校验失败');
      }
      const valData: ValidateResponse = await valResp.json();

      // 读取现有名称集合用于去重
      const indexResp = await fetch('/api/index', { cache: 'no-cache' });
      const indexData: { characters?: Array<{ name?: string }> } = await indexResp.json();
      const usedNames = new Set<string>((indexData.characters || []).map((c) => String(c.name || '').toLowerCase()));

      const validations: FileValidation[] = selectedFiles.map((file) => {
        const server: ServerValidation | undefined = (valData.results || []).find((r) => r.originalName === file.name);
        const base: FileValidation = {
          file,
          originalName: file.name,
          status: 'invalid',
          errors: [],
          warnings: [],
          parsedData: undefined,
        };
        if (!server) {
          base.errors.push('后端无对应校验结果');
          return base;
        }
        base.status = server.status === 'valid' ? 'valid' : 'invalid';
        base.errors = server.errors || [];
        base.warnings = server.warnings || [];
        base.parsedData = server.parsedData || {};
        // 去重名称（仅对有效项）
        if (base.status === 'valid') {
          const baseName = String(base.parsedData?.name || '').trim() || file.name.replace(/\.[^/.]+$/, "");
          const uniqueName = getUniqueName(baseName, usedNames);
          if (uniqueName !== baseName) base.warnings.push(`名称已存在，调整为：${uniqueName}`);
          base.finalName = uniqueName;
        }
        return base;
      });

      setFileValidations(validations);

      // 没有可上传的有效文件
      const validOnes = validations.filter(v => v.status === 'valid');
      if (validOnes.length === 0) {
        setUploadResult({
          total: validations.length,
          successful: [],
          failed: [],
          skipped: validations,
          summary: { successCount: 0, failCount: 0, skipCount: validations.length }
        });
        setCurrentStep('complete');
        setIsProcessing(false);
        return;
      }

      // 开始上传
      setCurrentStep('upload');
      await uploadWithConcurrency(validOnes);

      // 生成汇总
      const successful = validations.filter(v => v.status === 'uploaded');
      const failed = validations.filter(v => v.status === 'failed');
      const skipped = validations.filter(v => v.status === 'invalid');
      setUploadResult({
        total: validations.length,
        successful,
        failed,
        skipped,
        summary: { successCount: successful.length, failCount: failed.length, skipCount: skipped.length }
      });
      setCurrentStep('complete');
      onSuccess();
    } catch (error: unknown) {
      console.error('批量上传错误:', error);
      const msg = error instanceof Error ? error.message : '批量上传失败';
      setErrorMessage(msg);
      setCurrentStep('select');
    } finally {
      setIsProcessing(false);
    }
  }

  async function uploadWithConcurrency(validOnes: FileValidation[]) {
    const total = validOnes.length;
    let finished = 0;

    const queue = validOnes.slice();
    const workers: Promise<void>[] = [];

    const runNext = async (): Promise<void> => {
      const item = queue.shift();
      if (!item) return;
      // 标记为上传中（用 pending 表示等待、valid 表示通过；这里直接开始时可以不加新状态，为简洁起见保留原状态显示）
      try {
        await uploadSingle(item);
      } catch (_e: unknown) {
        // 状态在 uploadSingle 内部已设置为 failed
      } finally {
        finished += 1;
        setOverallProgress(finished / total);
        await runNext();
      }
    };

    const workerCount = Math.min(CONCURRENCY, total);
    for (let i = 0; i < workerCount; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);
  }

  async function uploadSingle(v: FileValidation) {
    const formData = new FormData();
    const name = v.finalName || v.parsedData?.name || v.originalName.replace(/\.[^/.]+$/, "");
    const description = v.parsedData?.description || '自动上传的角色卡';
    const version = v.parsedData?.character_version || '1.0';
    formData.append('name', name);
    formData.append('description', description);
    formData.append('version', version);
    formData.append('file', v.file);

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data: { message?: string; character?: { id?: string } } = await resp.json();
      if (!resp.ok) {
        v.status = 'failed';
        v.errors.push(data?.message || '上传失败');
      } else {
        v.status = 'uploaded';
        v.characterId = data?.character?.id;
      }
    } catch (e: unknown) {
      v.status = 'failed';
      v.errors.push(e instanceof Error ? e.message : '网络错误');
    }
    // 推动状态刷新
    setFileValidations(prev => prev.map(x => (x.originalName === v.originalName ? { ...v } : x)));
  }

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedFiles([]);
      setFileValidations([]);
      setUploadResult(null);
      setCurrentStep('select');
      onClose();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded': return '✅';
      case 'invalid': case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded': return 'text-green-600';
      case 'invalid': case 'failed': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">批量上传角色卡</h2>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="text-gray-400 hover:text-gray-600 text-xl disabled:opacity-50"
            >
              ×
            </button>
          </div>
          
          {/* 进度指示器 */}
          <div className="flex items-center mt-4 space-x-2">
            {['select', 'validate', 'upload', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep === step ? 'bg-indigo-600 text-white' : 
                    ['select', 'validate', 'upload', 'complete'].indexOf(currentStep) > index ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    ['select', 'validate', 'upload', 'complete'].indexOf(currentStep) > index ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          
          <div className="text-sm text-gray-600 mt-2">
            {currentStep === 'select' && '选择要上传的PNG角色卡文件'}
            {currentStep === 'validate' && '正在验证文件...'}
            {currentStep === 'upload' && '正在上传角色卡...'}
            {currentStep === 'complete' && '批量上传完成'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 'select' && (
            <div>
              {/* 文件选择区域 */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl mb-4">📁</div>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  拖拽文件到此处或点击选择
                </p>
                <p className="text-sm text-gray-500">
                  支持多选PNG格式的角色卡文件，最大10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* 已选文件列表 */}
              {selectedFiles.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">已选择文件 ({selectedFiles.length})</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">📄</span>
                          <div>
                            <div className="font-medium">{file.name}</div>
                            <div className="text-sm text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'validate' && (
            <div>
              <h3 className="text-lg font-medium mb-4">校验结果</h3>
              {fileValidations.length === 0 ? (
                <p className="text-sm text-gray-600">正在校验所选文件...</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {fileValidations.map((v, idx) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{v.originalName}</div>
                        <div className={`text-sm ${
                          v.status === 'valid' ? 'text-green-600' : v.status === 'invalid' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {v.status === 'valid' ? '有效' : v.status === 'invalid' ? '无效' : '校验中'}
                        </div>
                      </div>
                      {v.finalName && (
                        <div className="text-xs text-gray-600 mt-1">最终名称：{v.finalName}</div>
                      )}
                      {v.warnings.length > 0 && (
                        <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside">
                          {v.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      )}
                      {v.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-700 list-disc list-inside">
                          {v.errors.map((er, i) => <li key={i}>{er}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'upload' && (
            <div>
              <div className="mb-2 text-sm text-gray-700">整体进度：{Math.round(overallProgress * 100)}%</div>
              <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
                <div className="bg-indigo-600 h-3 transition-all" style={{ width: `${Math.round(overallProgress * 100)}%` }} />
              </div>
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {fileValidations.map((v, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border rounded p-2">
                    <span className="truncate mr-2">{v.originalName}</span>
                    <span className={`${v.status === 'uploaded' ? 'text-green-600' : v.status === 'failed' ? 'text-red-600' : v.status === 'valid' ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {v.status === 'uploaded' ? '已上传' : v.status === 'failed' ? '失败' : '等待/进行中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 'complete' && uploadResult && (
            <div>
              {/* 结果汇总 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.summary.successCount}</div>
                  <div className="text-sm text-green-700">成功上传</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.summary.failCount}</div>
                  <div className="text-sm text-red-700">失败</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{uploadResult.summary.skipCount}</div>
                  <div className="text-sm text-yellow-700">跳过</div>
                </div>
              </div>

              {/* 详细结果 */}
              <div className="space-y-4">
                {[...uploadResult.successful, ...uploadResult.failed, ...uploadResult.skipped].map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{getStatusIcon(item.status)}</span>
                        <div>
                          <div className="font-medium">{item.originalName}</div>
                          <div className={`text-sm ${getStatusColor(item.status)}`}>
                            {item.status === 'uploaded' && '上传成功'}
                            {item.status === 'failed' && '上传失败'}
                            {item.status === 'invalid' && '验证失败'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 错误信息 */}
                    {item.errors.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium text-red-700 mb-1">错误:</div>
                        <ul className="text-sm text-red-600 list-disc list-inside">
                          {item.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 警告信息 */}
                    {item.warnings.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium text-yellow-700 mb-1">警告:</div>
                        <ul className="text-sm text-yellow-600 list-disc list-inside">
                          {item.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="border-t p-6">
          <div className="flex justify-end space-x-3">
            {currentStep === 'select' && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={runLocalValidationAndUpload}
                  disabled={selectedFiles.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  开始批量上传 ({selectedFiles.length})
                </button>
              </>
            )}
            
            {currentStep === 'complete' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                完成
              </button>
            )}
          </div>
          {errorMessage && (
            <div className="mt-3 text-sm text-red-600 text-right">{errorMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
}
