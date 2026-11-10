import React, { useEffect } from 'react';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import { firstError } from '@fossil/shared';
import SupplierProfileEditor, { draftErrors, type SupplierDraft } from './SupplierProfileEditor';
import SupplierProfileView from './SupplierProfileView';
import { useToast } from '../Toast';
import { useFormValidation } from '../../lib/useFormValidation';

type Props = {
  section: string;
  supplier: any;
  draft: SupplierDraft;
  editing: boolean;
  saving: boolean;
  /** Omitted for read-only viewers, which hides the Edit control. */
  onEdit?: () => void;
  onCancel: () => void;
  /** Saves the section; resolves with the error when the save failed. */
  onSave: () => Promise<unknown> | void;
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
  const { showToast } = useToast();
  // A supplier without a sign-in has no login fields for the API to check.
  const hasLogin = Boolean(supplier?.user);
  const validation = useFormValidation((values: SupplierDraft) => draftErrors(section, values, hasLogin), draft);

  // Messages start afresh each time a section is opened for editing.
  useEffect(() => {
    validation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, section]);

  /** Checks the section before the page saves it. */
  const save = async () => {
    if (!validation.check()) {
      // A problem on a field this section does not show (an old address while
      // editing Corporate, say) has nowhere to appear, so it is said here.
      setTimeout(() => {
        if (!validation.formRef.current?.querySelector('[aria-invalid="true"]')) {
          showToast(firstError(draftErrors(section, draft, hasLogin)), 'error');
        }
      }, 0);
      return;
    }
    // Field problems the API finds (a duplicate email, say) go under their
    // fields; anything else is said in a toast.
    const failure: any = await onSave();
    if (failure && !validation.fromServer(failure)) {
      showToast(failure.response?.data?.message || 'Failed to save supplier profile', 'error');
    }
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        <SupplierProfileView section={section} supplier={supplier} />
        {onEdit && (
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={validation.formRef} className="space-y-4">
      <SupplierProfileEditor
        section={section}
        draft={draft}
        onChange={onDraftChange}
        onSave={save}
        onCancel={onCancel}
        saving={saving}
        showActions={false}
        errors={validation.errors}
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
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
