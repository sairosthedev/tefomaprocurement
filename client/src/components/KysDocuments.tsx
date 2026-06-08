import { useEffect, useRef, useState } from 'react';
import { KYS_DOCUMENT_REQUIREMENTS } from '@fossil/shared';
import { useToast } from './Toast';
import { Upload, FileText, Trash2, CheckCircle, Loader2, Download, Eye, X } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;

export interface KysDocument {
  _id?: string;
  documentType: string;
  fileName: string;
  filePath: string;
  mimeType?: string;
  verified?: boolean;
  uploadedAt?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Best-effort MIME type for a stored document. */
function resolveMimeType(doc: KysDocument): string {
  if (doc.mimeType) return doc.mimeType;
  const fromData = doc.filePath.startsWith('data:')
    ? doc.filePath.match(/data:(.*?);/)?.[1]
    : undefined;
  if (fromData) return fromData;
  const ext = doc.fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  return (ext && map[ext]) || 'application/octet-stream';
}

/**
 * Converts a stored document (base64 data URL or remote path) into a Blob
 * object URL so it can be rendered inline in an <iframe>/<img> without the
 * browser forcing a download.
 */
function toObjectUrl(filePath: string, type: string): string {
  if (!filePath.startsWith('data:')) return filePath;
  const base64 = filePath.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type }));
}

/**
 * Renders the §6.2.3 KYS document requirements (mandatory + optional) with
 * per-item upload / view / remove. Used by both procurement (on behalf of a
 * supplier) and suppliers themselves.
 */
export default function KysDocuments({
  documents,
  onUpload,
  onDelete,
  readOnly = false,
  includeTypes,
  title
}: {
  documents: KysDocument[];
  onUpload: (payload: { documentType: string; fileName: string; fileData: string; mimeType: string }) => Promise<void>;
  onDelete?: (doc: KysDocument) => Promise<void>;
  readOnly?: boolean;
  /** When provided, render only these document types as a single list (used by the step wizard). */
  includeTypes?: string[];
  /** Optional heading shown above the list when `includeTypes` is used. */
  title?: string;
}) {
  const { showToast } = useToast();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ doc: KysDocument; url: string; type: string } | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const byType = (t: string) => documents?.find((d) => d.documentType === t);

  const openViewer = (doc: KysDocument) => {
    const type = resolveMimeType(doc);
    try {
      setViewer({ doc, url: toObjectUrl(doc.filePath, type), type });
    } catch {
      showToast('Could not open this document', 'error');
    }
  };

  const closeViewer = () => {
    if (viewer && viewer.url.startsWith('blob:')) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  };

  // Revoke any outstanding object URL on unmount.
  useEffect(() => {
    return () => {
      if (viewer && viewer.url.startsWith('blob:')) URL.revokeObjectURL(viewer.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.url]);

  const handleFile = async (documentType: string, file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      showToast('File exceeds the 5MB limit', 'error');
      return;
    }
    try {
      setBusyType(documentType);
      const fileData = await readFileAsDataUrl(file);
      await onUpload({ documentType, fileName: file.name, fileData, mimeType: file.type });
      showToast('Document uploaded', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setBusyType(null);
      if (inputs.current[documentType]) inputs.current[documentType]!.value = '';
    }
  };

  const handleDelete = async (doc: KysDocument) => {
    if (!onDelete) return;
    try {
      setBusyType(doc.documentType);
      await onDelete(doc);
      showToast('Document removed', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Remove failed', 'error');
    } finally {
      setBusyType(null);
    }
  };

  const mandatory = KYS_DOCUMENT_REQUIREMENTS.filter((r) => r.required);
  const optional = KYS_DOCUMENT_REQUIREMENTS.filter((r) => !r.required);
  const subset = includeTypes
    ? KYS_DOCUMENT_REQUIREMENTS.filter((r) => includeTypes.includes(r.documentType))
    : [];

  const renderRow = (req: (typeof KYS_DOCUMENT_REQUIREMENTS)[number]) => {
    const existing = byType(req.documentType);
    const busy = busyType === req.documentType;
    return (
      <div key={req.documentType} className="flex items-center gap-3 p-3 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
            {req.label}
            {req.required ? (
              <span className="text-[10px] font-semibold text-red-500">REQUIRED</span>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400">OPTIONAL</span>
            )}
          </p>
          {existing ? (
            <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{existing.fileName}</span>
              {existing.verified && (
                <span className="inline-flex items-center gap-0.5 text-green-600 ml-1">
                  <CheckCircle className="h-3 w-3" /> verified
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-gray-400">{req.section} · not uploaded</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {existing && (
            <button
              type="button"
              onClick={() => openViewer(existing)}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
              title="View"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {existing && (
            <a
              href={existing.filePath}
              download={existing.fileName}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          {existing && onDelete && !existing.verified && !readOnly && (
            <button
              type="button"
              onClick={() => handleDelete(existing)}
              disabled={busy}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {!readOnly && (
            <>
              <input
                ref={(el) => {
                  inputs.current[req.documentType] = el;
                }}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => handleFile(req.documentType, e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => inputs.current[req.documentType]?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {existing ? 'Replace' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const viewerModal = viewer && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={closeViewer}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-gray-800 truncate">{viewer.doc.fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={viewer.doc.filePath}
              download={viewer.doc.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button
              type="button"
              onClick={closeViewer}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center">
          {viewer.type.startsWith('image/') ? (
            <img src={viewer.url} alt={viewer.doc.fileName} className="max-h-full max-w-full object-contain" />
          ) : viewer.type === 'application/pdf' ? (
            <iframe src={viewer.url} title={viewer.doc.fileName} className="w-full h-full" />
          ) : (
            <div className="text-center p-8">
              <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-1">This file type can't be previewed in the browser.</p>
              <p className="text-xs text-gray-400 mb-4">{viewer.doc.fileName}</p>
              <a
                href={viewer.doc.filePath}
                download={viewer.doc.fileName}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
              >
                <Download className="h-4 w-4" /> Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (includeTypes) {
    return (
      <>
        <div className="bg-white rounded-xl shadow">
          {title && (
            <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
              <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
            </div>
          )}
          {subset.length > 0 ? (
            subset.map(renderRow)
          ) : (
            <p className="p-4 text-sm text-gray-400">No documents in this section.</p>
          )}
        </div>
        {viewerModal}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h3 className="text-sm font-semibold text-gray-700">Mandatory documents</h3>
          </div>
          {mandatory.map(renderRow)}
        </div>

        <div className="bg-white rounded-xl shadow">
          <div className="px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <h3 className="text-sm font-semibold text-gray-700">Optional documents</h3>
          </div>
          {optional.map(renderRow)}
        </div>
      </div>
      {viewerModal}
    </>
  );
}
