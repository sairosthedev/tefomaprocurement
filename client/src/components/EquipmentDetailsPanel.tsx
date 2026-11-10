import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Camera, X, Loader2, FileText } from 'lucide-react';
import {
  EQUIPMENT_FIELDS,
  ATTACHMENT_KIND_OPTIONS,
  MAX_ATTACHMENTS_PER_LINE,
  TEXT_LIMITS,
  firstError,
  hasEquipmentDetails,
  validateRequisitionAttachment,
  validateRequisitionAttachments,
  type FieldErrors
} from '@fossil/shared';
import FieldError from './FieldError';

interface Props {
  equipment: Record<string, string>;
  attachments: any[];
  onEquipmentChange: (key: string, value: string) => void;
  onAttachmentsChange: (attachments: any[]) => void;
  /** Open on first render — set when the line's category is plant/vehicle related. */
  defaultOpen?: boolean;
  /**
   * The line's field errors from its form (validateRequisitionLine):
   * `equipment.make`, `attachments`, `attachments.0.caption` and so on.
   */
  errors?: FieldErrors;
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
  errors = {}
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [reading, setReading] = useState(false);
  // Why a file just picked was not added, in the words the API would use.
  const [pickError, setPickError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A problem in here keeps the panel open, so the field it is under can be seen.
  const hasPanelErrors = Object.keys(errors).some((key) => key.startsWith('equipment.') || key.startsWith('attachments'));
  const isOpen = open || hasPanelErrors;
  const attachmentError = (index: number, field: string) => errors[`attachments.${index}.${field}`];

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
    setPickError('');

    // Counted before anything is read.
    const tooMany = validateRequisitionAttachments([
      ...(attachments || []),
      ...files.map((file) => ({ fileName: file.name, fileData: 'pending' }))
    ]).attachments;
    if (tooMany) {
      setPickError(tooMany);
      event.target.value = '';
      return;
    }

    try {
      setReading(true);
      const added: any[] = [];
      const problems: string[] = [];
      for (const file of files) {
        const attachment = {
          kind: 'data_plate',
          fileName: file.name,
          fileData: await readFile(file),
          mimeType: file.type,
          caption: ''
        };
        // The type and size checks the API makes.
        const problem = firstError(validateRequisitionAttachment(attachment));
        if (problem) {
          problems.push(`${file.name}: ${problem}`);
          continue;
        }
        added.push(attachment);
      }
      if (added.length) onAttachmentsChange([...(attachments || []), ...added]);
      if (problems.length) setPickError(problems.join(' '));
    } catch (error: any) {
      setPickError(error.message || 'Could not read the selected file');
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
    setPickError('');
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="col-span-12 border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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

      {isOpen && (
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
                  maxLength={TEXT_LIMITS.name}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  {...(errors[`equipment.${field.key}`] ? { 'aria-invalid': true as const } : {})}
                />
                <FieldError message={errors[`equipment.${field.key}`]} />
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
            <FieldError message={pickError || errors.attachments} className="mb-2" />

            {count === 0 ? (
              <p className="text-xs text-gray-400">
                Attach a data plate photo so the supplier can read the serial themselves,
                or a photo of the old part so they can offer an equivalent replacement.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {attachments.map((att: any, index: number) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-2 relative ${
                      attachmentError(index, 'fileData') || attachmentError(index, 'mimeType') ? 'border-red-300' : 'border-gray-200'
                    }`}
                  >
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
                      {...(attachmentError(index, 'kind') ? { 'aria-invalid': true as const } : {})}
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
                      maxLength={TEXT_LIMITS.short}
                      className="w-full mt-1 px-1.5 py-1 border border-gray-200 rounded text-[11px]"
                      {...(attachmentError(index, 'caption') ? { 'aria-invalid': true as const } : {})}
                    />
                    <FieldError
                      message={
                        attachmentError(index, 'fileData') ||
                        attachmentError(index, 'mimeType') ||
                        attachmentError(index, 'kind') ||
                        attachmentError(index, 'caption')
                      }
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
