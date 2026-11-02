import React, { useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_LINE,
  ALLOWED_ATTACHMENT_MIME_TYPES
} from '@fossil/shared';

interface Props {
  attachments: any[];
  onChange: (attachments: any[]) => void;
  onError?: (message: string) => void;
}

/**
 * Photo upload for a supplier's quote line. Used when the supplier offers an
 * equivalent part: buyers need to see the data plate of what would actually
 * arrive before awarding.
 */
export default function QuoteLinePhotos({ attachments, onChange, onError }: Props) {
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const count = attachments?.length || 0;

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleFiles = async (event: any) => {
    const files: File[] = Array.from(event.target.files || []);
    if (!files.length) return;

    if (count + files.length > MAX_ATTACHMENTS_PER_LINE) {
      onError?.(`You can attach at most ${MAX_ATTACHMENTS_PER_LINE} photos per line`);
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
      if (added.length) onChange([...(attachments || []), ...added]);
    } catch (error: any) {
      onError?.(error.message || 'Could not read the selected file');
    } finally {
      setReading(false);
      event.target.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-gray-500">
          Photo of the part / its data plate
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading || count >= MAX_ATTACHMENTS_PER_LINE}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          Add photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>

      {count === 0 ? (
        <p className="text-xs text-gray-400">
          Attach the data plate or a clear photo so the buyer can confirm your part fits.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att: any, i: number) => (
            <div key={i} className="relative">
              {att.mimeType === 'application/pdf' ? (
                <span className="flex items-center justify-center h-16 w-16 rounded border border-gray-200 bg-white text-[10px] text-gray-500">
                  PDF
                </span>
              ) : (
                <img
                  src={att.fileData}
                  alt={att.fileName}
                  className="h-16 w-16 object-cover rounded border border-gray-200"
                />
              )}
              <button
                type="button"
                onClick={() => onChange(attachments.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 p-0.5 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
