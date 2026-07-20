import React, { useState } from 'react';
import { X } from 'lucide-react';
import { listEquipmentDetails, ATTACHMENT_KIND_OPTIONS } from '@fossil/shared';

interface Props {
  equipment?: Record<string, any> | null;
  attachments?: any[] | null;
  /** Compact variant for table cells; roomier variant for supplier RFQ views. */
  compact?: boolean;
}

const kindLabel = (kind: string) =>
  ATTACHMENT_KIND_OPTIONS.find((o) => o.value === kind)?.label || 'Photo';

/**
 * Read-only rendering of a line's machine identification and photos.
 * Renders nothing when the line carries neither, so office-supply requisitions
 * look exactly as they did before.
 */
export default function EquipmentDetailsView({ equipment, attachments, compact = false }: Props) {
  const [preview, setPreview] = useState<any>(null);
  const details = listEquipmentDetails(equipment);
  const photos = attachments || [];

  if (details.length === 0 && photos.length === 0) return null;

  return (
    <div className={compact ? 'mt-1.5' : 'mt-3'}>
      {details.length > 0 && (
        <div className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? 'mt-1' : 'mt-2'}`}>
          {details.map((d) => (
            <span key={d.label} className="text-xs text-gray-600">
              <span className="text-gray-400">{d.label}:</span>{' '}
              <span className="font-medium text-gray-800">{d.value}</span>
            </span>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {photos.map((att: any, i: number) => (
            <button
              key={i}
              type="button"
              onClick={() => setPreview(att)}
              className="group relative"
              title={att.caption || kindLabel(att.kind)}
            >
              {att.mimeType === 'application/pdf' ? (
                <span className="flex items-center justify-center h-14 w-14 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-500">
                  PDF
                </span>
              ) : (
                <img
                  src={att.fileData}
                  alt={att.caption || kindLabel(att.kind)}
                  className="h-14 w-14 object-cover rounded border border-gray-200 group-hover:ring-2 group-hover:ring-primary/40"
                />
              )}
              <span className="block text-[10px] text-gray-400 mt-0.5 max-w-14 truncate">
                {kindLabel(att.kind)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox — data plates are unreadable at thumbnail size */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {preview.mimeType === 'application/pdf' ? (
              <iframe src={preview.fileData} title={preview.fileName} className="w-full h-[80vh] rounded-lg bg-white" />
            ) : (
              <img
                src={preview.fileData}
                alt={preview.caption || preview.fileName}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
            <p className="text-center text-sm text-white/80 mt-3">
              {kindLabel(preview.kind)}
              {preview.caption ? ` — ${preview.caption}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
