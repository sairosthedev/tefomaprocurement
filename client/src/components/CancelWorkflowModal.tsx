import React, { useEffect, useState } from 'react';
import { TEXT_LIMITS, validateWorkflowCancellation } from '@fossil/shared';
import { Modal, ModalFooter } from './Modal';
import { Loader2 } from 'lucide-react';
import FieldError from './FieldError';
import { useFormValidation } from '../lib/useFormValidation';

type ReasonOption = { code: string; label: string };

type CancelWorkflowModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  reasons: readonly ReasonOption[];
  onConfirm: (payload: { reasonCode: string; comments?: string }) => Promise<void>;
};

export default function CancelWorkflowModal({
  isOpen,
  onClose,
  title,
  description,
  reasons,
  onConfirm
}: CancelWorkflowModalProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The same check the API runs: requisitions against PR_CANCELLATION_REASONS,
  // purchase orders against PO_CANCELLATION_REASONS, whichever `reasons` is.
  const validation = useFormValidation(
    (values: { reasonCode: string; comments: string }) => validateWorkflowCancellation(values, reasons),
    { reasonCode, comments }
  );

  // Each opening starts clean.
  useEffect(() => {
    if (isOpen) validation.reset();
  }, [isOpen]);

  const handleClose = () => {
    if (submitting) return;
    setReasonCode('');
    setComments('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.check()) return;

    setSubmitting(true);
    try {
      await onConfirm({
        reasonCode,
        comments: comments.trim() || undefined
      });
      setReasonCode('');
      setComments('');
      onClose();
    } catch (error: any) {
      // The page has already said what went wrong unless it was a field.
      validation.fromServer(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <form ref={validation.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>

        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason for cancellation
          </label>
          <select
            id="cancel-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            {...validation.invalid('reasonCode')}
          >
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <FieldError message={validation.errors.reasonCode} />
        </div>

        <div>
          <label htmlFor="cancel-comments" className="block text-sm font-medium text-gray-700 mb-1">
            {reasonCode === 'other' ? 'Details (required)' : 'Additional notes (optional)'}
          </label>
          <textarea
            id="cancel-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            maxLength={TEXT_LIMITS.long}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            placeholder="Explain why this is being cancelled…"
            {...validation.invalid('comments')}
          />
          <FieldError message={validation.errors.comments} />
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Keep active
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm cancellation
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
