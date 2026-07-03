import React, { useState } from 'react';
import { Modal, ModalFooter } from './Modal';
import { Loader2 } from 'lucide-react';

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

  const handleClose = () => {
    if (submitting) return;
    setReasonCode('');
    setComments('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonCode) return;
    if (reasonCode === 'other' && !comments.trim()) return;

    setSubmitting(true);
    try {
      await onConfirm({
        reasonCode,
        comments: comments.trim() || undefined
      });
      setReasonCode('');
      setComments('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>

        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason for cancellation
          </label>
          <select
            id="cancel-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
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
            required={reasonCode === 'other'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            placeholder="Explain why this is being cancelled…"
          />
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
            disabled={submitting || !reasonCode || (reasonCode === 'other' && !comments.trim())}
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
