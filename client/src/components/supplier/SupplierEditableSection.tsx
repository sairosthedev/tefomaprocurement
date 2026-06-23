import React from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import SupplierProfileEditor, { type SupplierDraft } from './SupplierProfileEditor';
import SupplierProfileView from './SupplierProfileView';

type Props = {
  section: string;
  supplier: any;
  draft: SupplierDraft;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (draft: SupplierDraft) => void;
};

export default function SupplierEditableSection({
  section,
  supplier,
  draft,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
  onDraftChange
}: Props) {
  if (!editing) {
    return (
      <div className="space-y-4">
        <SupplierProfileView section={section} supplier={supplier} />
        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SupplierProfileEditor
        section={section}
        draft={draft}
        onChange={onDraftChange}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
        showActions={false}
      />
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
