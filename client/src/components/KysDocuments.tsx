import { useEffect, useRef, useState } from 'react';
import { KYS_DOCUMENT_REQUIREMENTS } from '@fossil/shared';
import { useToast } from './Toast';
import { Upload, FileText, Trash2, CheckCircle, Loader2, Download, Eye, X, CalendarClock, AlertTriangle, ShieldCheck, ShieldX } from 'lucide-react';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Document types that carry a validity period. These must be uploaded with an
 * expiry date — the server rejects them otherwise, because an expiry date that
 * nothing records is an expiry date nothing can act on.
 * Mirrors EXPIRING_DOCUMENT_TYPES in the API's documentExpiry service.
 */
const EXPIRING_DOCUMENT_TYPES = [
  'tax_clearance',
  'nssa_compliance',
  'insurance',
  'iso_certification',
  'industry_licence',
  'nec_registration',
  'bee_certificate'
];

const isExpiringType = (documentType: string) => EXPIRING_DOCUMENT_TYPES.includes(documentType);

export interface KysDocument {
  _id?: string;
  documentType: string;
  fileName: string;
  filePath: string;
  mimeType?: string;
  verified?: boolean;
  verifiedAt?: string;
  expiryDate?: string;
  notes?: string;
  uploadedAt?: string;
}

/** Days until expiry, negative once lapsed. */
function daysUntil(date?: string): number | undefined {
  if (!date) return undefined;
  const ms = new Date(date).getTime() - Date.now();
  if (Number.isNaN(ms)) return undefined;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
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
 * Renders the KYS document requirements (mandatory + optional) with
 * per-item upload / view / remove. Used by both procurement (on behalf of a
 * supplier) and suppliers themselves.
 */
export default function KysDocuments({
  documents,
  onUpload,
  onDelete,
  onVerify,
  readOnly = false,
  includeTypes,
  title
}: {
  documents: KysDocument[];
  onUpload: (payload: {
    documentType: string;
    fileName: string;
    fileData: string;
    mimeType: string;
    expiryDate?: string;
  }) => Promise<void>;
  onDelete?: (doc: KysDocument) => Promise<void>;
  /** Supplied by procurement screens to verify or reject a document. */
  onVerify?: (doc: KysDocument, verified: boolean, notes?: string) => Promise<void>;
  readOnly?: boolean;
  /** When provided, render only these document types as a single list (used by the step wizard). */
  includeTypes?: string[];
  /** Optional heading shown above the list when `includeTypes` is used. */
  title?: string;
}) {
  const { showToast } = useToast();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ doc: KysDocument; url: string; type: string } | null>(null);
  // Expiry date staged per document type before the file is chosen.
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
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

    const expiryDate = expiryDrafts[documentType];
    if (isExpiringType(documentType)) {
      if (!expiryDate) {
        showToast('Set the expiry date before uploading this document', 'error');
        if (inputs.current[documentType]) inputs.current[documentType]!.value = '';
        return;
      }
      if (new Date(expiryDate).getTime() <= Date.now()) {
        showToast('That expiry date has already passed', 'error');
        if (inputs.current[documentType]) inputs.current[documentType]!.value = '';
        return;
      }
    }

    try {
      setBusyType(documentType);
      const fileData = await readFileAsDataUrl(file);
      await onUpload({
        documentType,
        fileName: file.name,
        fileData,
        mimeType: file.type,
        ...(expiryDate ? { expiryDate } : {})
      });
      setExpiryDrafts((prev) => ({ ...prev, [documentType]: '' }));
      showToast('Document uploaded', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setBusyType(null);
      if (inputs.current[documentType]) inputs.current[documentType]!.value = '';
    }
  };

  const handleVerify = async (doc: KysDocument, verified: boolean) => {
    if (!onVerify) return;
    let notes: string | undefined;
    if (!verified) {
      const reason = window.prompt(`Why is "${doc.fileName}" being rejected?`);
      if (!reason?.trim()) return;
      notes = reason.trim();
    }
    try {
      setBusyType(doc.documentType);
      await onVerify(doc, verified, notes);
      showToast(verified ? 'Document verified' : 'Document rejected', 'success');
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Could not update the document', 'error');
    } finally {
      setBusyType(null);
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
            <>
              <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{existing.fileName}</span>
                {existing.verified ? (
                  <span className="inline-flex items-center gap-0.5 text-green-600 ml-1 shrink-0">
                    <CheckCircle className="h-3 w-3" /> verified
                  </span>
                ) : (
                  <span className="text-amber-600 ml-1 shrink-0">awaiting review</span>
                )}
              </p>
              {existing.expiryDate && (() => {
                const left = daysUntil(existing.expiryDate);
                const shown = new Date(existing.expiryDate).toLocaleDateString('en-ZA');
                if (left === undefined) return null;
                if (left <= 0) {
                  return (
                    <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3" /> Expired {shown} — replace to stay compliant
                    </p>
                  );
                }
                return (
                  <p className={`text-xs flex items-center gap-1 mt-0.5 ${left <= 60 ? 'text-amber-600' : 'text-gray-400'}`}>
                    <CalendarClock className="h-3 w-3" />
                    Expires {shown}{left <= 60 ? ` — ${left} day(s) left` : ''}
                  </p>
                );
              })()}
              {existing.notes && !existing.verified && (
                <p className="text-xs text-red-600 mt-0.5 truncate" title={existing.notes}>
                  Rejected: {existing.notes}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">{req.section} · not uploaded</p>
          )}

          {/* Documents with a validity period cannot be uploaded without one. */}
          {!readOnly && isExpiringType(req.documentType) && (
            <div className="flex items-center gap-2 mt-2">
              <label className="text-[11px] text-gray-500 shrink-0">
                Expiry date{!existing ? ' *' : ''}
              </label>
              <input
                type="date"
                value={expiryDrafts[req.documentType] || ''}
                min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                onChange={(e) =>
                  setExpiryDrafts((prev) => ({ ...prev, [req.documentType]: e.target.value }))
                }
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
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
          {/* Verification is procurement opening the file and saying so —
              uploading one is not verification. */}
          {existing && onVerify && !readOnly && (
            <>
              {!existing.verified && (
                <button
                  type="button"
                  onClick={() => handleVerify(existing, true)}
                  disabled={busy}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                  title="Verify this document"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleVerify(existing, false)}
                disabled={busy}
                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50"
                title={existing.verified ? 'Withdraw verification' : 'Reject this document'}
              >
                <ShieldX className="h-4 w-4" />
              </button>
            </>
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
