import { useRef, useState } from 'react';
import { KYS_DOCUMENT_REQUIREMENTS } from '@fosssil/shared';
import { useToast } from './Toast';
import { Upload, FileText, Trash2, CheckCircle, Loader2, Download } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;

export interface KysDocument {
  _id?: string;
  documentType: string;
  fileName: string;
  filePath: string;
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

/**
 * Renders the §6.2.3 KYS document requirements (mandatory + optional) with
 * per-item upload / view / remove. Used by both procurement (on behalf of a
 * supplier) and suppliers themselves.
 */
export default function KysDocuments({
  documents,
  onUpload,
  onDelete,
  readOnly = false
}: {
  documents: KysDocument[];
  onUpload: (payload: { documentType: string; fileName: string; fileData: string; mimeType: string }) => Promise<void>;
  onDelete?: (doc: KysDocument) => Promise<void>;
  readOnly?: boolean;
}) {
  const { showToast } = useToast();
  const [busyType, setBusyType] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const byType = (t: string) => documents?.find((d) => d.documentType === t);

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

  return (
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
  );
}
