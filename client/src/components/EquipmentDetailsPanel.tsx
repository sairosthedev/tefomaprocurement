import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Camera, X, Loader2, FileText } from 'lucide-react';
import {
  EQUIPMENT_FIELDS,
  ATTACHMENT_KIND_OPTIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LINE,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  hasEquipmentDetails
} from '@fossil/shared';

interface Props {
  equipment: Record<string, string>;
  attachments: any[];
  onEquipmentChange: (key: string, value: string) => void;
  onAttachmentsChange: (attachments: any[]) => void;
  /** Open on first render — set when the line's category is plant/vehicle related. */
  defaultOpen?: boolean;
  onError?: (message: string) => void;
}

/**
 * Optional per-line panel for machine identification and data-plate photos.
 *
 * Collapsed by default so office-supply requisitions stay a two-field form;
 * auto-expanded for plant/vehicle categories. Each identifier gets its own
 * input rather than one comma-separated box, so values stay searchable and can
 * be shown to suppliers as labelled rows.
 */
export default function EquipmentDetailsPanel({
  equipment,
  attachments,
  onEquipmentChange,
  onAttachmentsChange,
  defaultOpen = false,
  onError
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [reading, setReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filled = hasEquipmentDetails(equipment);
  const count = (attachments || []).length;

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleFiles = async (event: any) => {
    const files: File[] = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (count + files.length > MAX_ATTACHMENTS_PER_LINE) {
      onError?.(`You can attach at most ${MAX_ATTACHMENTS_PER_LINE} photos to one item`);
      event.target.value = '';
      return;
    }

    try {
      setReading(true);
      const added: any[] = [];
      for (const file of files) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          onError?.(`${file.name} is larger than 5MB`);
          continue;
        }
        if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
          onError?.(`${file.name} is not a supported image type`);
          continue;
        }
        added.push({
          kind: 'data_plate',
          fileName: file.name,
          fileData: await readFile(file),
          mimeType: file.type,
          caption: ''
        });
      }
      if (added.length) onAttachmentsChange([...(attachments || []), ...added]);
    } catch (error: any) {
      onError?.(error.message || 'Could not read the selected file');
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  const updateAttachment = (index: number, field: string, value: string) => {
    const next = [...attachments];
    next[index] = { ...next[index], [field]: value };
    onAttachmentsChange(next);
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="col-span-12 border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Equipment details &amp; photos
          <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <span className="flex items-center gap-2">
          {filled && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              details added
            </span>
          )}
          {count > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {count} photo{count === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            For plant, vehicle or machinery spares. Fill in only what you know — if the
            data plate is unreadable, attach a photo and give the plant number instead.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EQUIPMENT_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={equipment?.[field.key] || ''}
                  onChange={(e: any) => onEquipmentChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  title={field.help}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            ))}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-700">
                Photos for the supplier
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={reading || count >= MAX_ATTACHMENTS_PER_LINE}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                Add photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
            </div>

            {count === 0 ? (
              <p className="text-xs text-gray-400">
                Attach a data plate photo so the supplier can read the serial themselves,
                or a photo of the old part so they can offer an equivalent replacement.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {attachments.map((att: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-2 relative">
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-gray-400 hover:text-red-500"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {att.mimeType === 'application/pdf' ? (
                      <div className="h-20 flex items-center justify-center bg-gray-50 rounded">
                        <FileText className="h-8 w-8 text-gray-400" />
                      </div>
                    ) : (
                      <img
                        src={att.fileData}
                        alt={att.caption || att.fileName}
                        className="h-20 w-full object-cover rounded"
                      />
                    )}
                    <select
                      value={att.kind}
                      onChange={(e: any) => updateAttachment(index, 'kind', e.target.value)}
                      className="w-full mt-1.5 px-1.5 py-1 border border-gray-200 rounded text-[11px] bg-white"
                    >
                      {ATTACHMENT_KIND_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={att.caption || ''}
                      onChange={(e: any) => updateAttachment(index, 'caption', e.target.value)}
                      placeholder="Caption (optional)"
                      className="w-full mt-1 px-1.5 py-1 border border-gray-200 rounded text-[11px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
