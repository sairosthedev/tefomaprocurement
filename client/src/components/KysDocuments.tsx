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
  /** No longer sent by supplier reads; the file is fetched when opened. */
  filePath?: string;
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
  const fromData = doc.filePath?.startsWith('data:')
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

const revokeIfBlob = (url?: string) => {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
};

/** The API's message from a failed blob request (the body arrives as a Blob too). */
async function blobErrorMessage(error: any, fallback: string): Promise<string> {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text())?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
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
  fetchFile,
  requiredTypes,
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
  /**
   * Loads one document's file. Supplier reads no longer carry the file bodies
   * (they made the record too large to send), so View and Download fetch the
   * file they need when clicked.
   */
  fetchFile?: (doc: KysDocument) => Promise<Blob>;
  /** Document types required for this supplier's tier; defaults to the full required set. */
  requiredTypes?: string[];
  readOnly?: boolean;
  /** When provided, render only these document types as a single list (used by the step wizard). */
  includeTypes?: string[];
  /** Optional heading shown above the list when `includeTypes` is used. */
  title?: string;
}) {
  const { showToast } = useToast();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ doc: KysDocument; url: string; type: string; loading?: boolean } | null>(null);
  // Bumped on every open/close, so a file that arrives after the viewer was
  // closed (or another document opened) is discarded rather than shown.
  const viewRequest = useRef(0);
  // Expiry date staged per document type before the file is chosen.
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const byType = (t: string) => documents?.find((d) => d.documentType === t);
  const isRequired = (req: (typeof KYS_DOCUMENT_REQUIREMENTS)[number]) =>
    requiredTypes ? requiredTypes.includes(req.documentType) : req.required;

  /** An object URL for the document's file, fetched from the API when possible. */
  const loadFile = async (doc: KysDocument): Promise<{ url: string; type: string }> => {
    if (fetchFile && doc._id) {
      const blob = await fetchFile(doc);
      return { url: URL.createObjectURL(blob), type: blob.type || resolveMimeType(doc) };
    }
    // Older responses still carried the file inline.
    if (doc.filePath) {
      const type = resolveMimeType(doc);
      return { url: toObjectUrl(doc.filePath, type), type };
    }
    throw new Error('This document has no file to open');
  };

  const openViewer = async (doc: KysDocument) => {
    const request = ++viewRequest.current;
    setViewer({ doc, url: '', type: resolveMimeType(doc), loading: true });
    try {
      const { url, type } = await loadFile(doc);
      if (request !== viewRequest.current) {
        revokeIfBlob(url);
        return;
      }
      setViewer({ doc, url, type });
    } catch (error) {
      if (request !== viewRequest.current) return;
      setViewer(null);
      showToast(await blobErrorMessage(error, 'Could not open this document'), 'error');
    }
  };

  const closeViewer = () => {
    viewRequest.current++;
    revokeIfBlob(viewer?.url);
    setViewer(null);
  };

  const downloadDoc = async (doc: KysDocument) => {
    try {
      setDownloading(doc.documentType);
      const { url } = await loadFile(doc);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to start the download before releasing the URL.
      setTimeout(() => revokeIfBlob(url), 30_000);
    } catch (error) {
      showToast(await blobErrorMessage(error, 'Download failed'), 'error');
    } finally {
      setDownloading(null);
    }
  };

  // Revoke any outstanding object URL on unmount.
  useEffect(() => {
    return () => revokeIfBlob(viewer?.url);
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

  const mandatory = KYS_DOCUMENT_REQUIREMENTS.filter(isRequired);
  const optional = KYS_DOCUMENT_REQUIREMENTS.filter((r) => !isRequired(r));
  const subset = includeTypes
    ? KYS_DOCUMENT_REQUIREMENTS.filter((r) => includeTypes.includes(r.documentType))
    : [];

  const renderRow = (req: (typeof KYS_DOCUMENT_REQUIREMENTS)[number]) => {
    const existing = byType(req.documentType);
    const busy = busyType === req.documentType;
    return (
      <div key={req.documentType} className="flex flex-wrap items-center gap-3 p-3 border-b border-gray-100 last:border-b-0">
        <div className="flex-1 min-w-[14rem]">
          <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
            {req.label}
            {isRequired(req) ? (
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

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {existing && (
            <button
              type="button"
              onClick={() => openViewer(existing)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-primary bg-primary text-white hover:bg-primary-dark"
              title="View"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </button>
          )}
          {existing && (
            <button
              type="button"
              onClick={() => downloadDoc(existing)}
              disabled={downloading === req.documentType}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Download"
            >
              {downloading === req.documentType ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </button>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-primary bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                  title="Verify this document"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify
                </button>
              )}
              <button
                type="button"
                onClick={() => handleVerify(existing, false)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                title={existing.verified ? 'Withdraw verification' : 'Reject this document'}
              >
                <ShieldX className="h-3.5 w-3.5" />
                {existing.verified ? 'Withdraw' : 'Reject'}
              </button>
            </>
          )}
          {existing && onDelete && !existing.verified && !readOnly && (
            <button
              type="button"
              onClick={() => handleDelete(existing)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={closeViewer}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-gray-800 truncate">{viewer.doc.fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!viewer.loading && (
              <a
                href={viewer.url}
                download={viewer.doc.fileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Close"
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center">
          {viewer.loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : viewer.type.startsWith('image/') ? (
            <img src={viewer.url} alt={viewer.doc.fileName} className="max-h-full max-w-full object-contain" />
          ) : viewer.type === 'application/pdf' ? (
            <iframe src={viewer.url} title={viewer.doc.fileName} className="w-full h-full" />
          ) : (
            <div className="text-center p-8">
              <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-1">This file type can't be previewed in the browser.</p>
              <p className="text-xs text-gray-400 mb-4">{viewer.doc.fileName}</p>
              <a
                href={viewer.url}
                download={viewer.doc.fileName}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {title && (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-gray-700">Mandatory documents</h3>
          </div>
          {mandatory.map(renderRow)}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-gray-700">Optional documents</h3>
          </div>
          {optional.map(renderRow)}
        </div>
      </div>
      {viewerModal}
    </>
  );
}
