'use client';

import { useRef, useState } from 'react';
import { partitionPdfFiles } from '../lib/file-selection';

interface Props {
  busy: boolean;
  onFiles: (files: File[]) => void;
  onRejectedFiles: (files: File[]) => void;
}

export function UploadPanel({ busy, onFiles, onRejectedFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptSelection = (fileList: FileList | null) => {
    if (!fileList) return;

    const { acceptedFiles, rejectedFiles } = partitionPdfFiles(fileList);

    // 即使没有被拒绝的文件也回调一次，用于清除上一批次的过滤提示。
    onRejectedFiles(rejectedFiles);

    if (acceptedFiles.length > 0) {
      onFiles(acceptedFiles);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) acceptSelection(event.dataTransfer.files);
        }}
        className={`w-full rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging
            ? 'border-emerald-700 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-emerald-700 hover:bg-emerald-50/50'
        } ${busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <div className="text-base font-semibold text-slate-800">
          {busy ? '正在处理 PDF，请稍候…' : dragging ? '松开即可添加 PDF' : '拖入 PDF 发票，或点击选择文件'}
        </div>
        <div className="mt-2 text-sm text-slate-500">支持一次选择多个 PDF · 当前读取电子 PDF 文本层</div>
        <div className="mt-3 text-xs font-medium text-emerald-800">默认本地处理：原始 PDF 不上传服务器</div>
      </button>

      <input
        ref={inputRef}
        hidden
        multiple
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          acceptSelection(event.target.files);

          // 清空 input value 后，即使用户下一次重新选择同一批文件，也会再次触发 change。
          event.currentTarget.value = '';
        }}
      />
    </section>
  );
}
