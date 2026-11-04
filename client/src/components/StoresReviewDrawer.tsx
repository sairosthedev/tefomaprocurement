import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getCategoryName, isValidCategoryCode } from '@fossil/shared';
import { storesAPI } from '../lib/api';
import { useToast } from './Toast';
import Drawer from './Drawer';
import { CategorySelect } from './CategorySelect';

const th = 'text-left py-2 px-3 text-xs font-medium text-white uppercase tracking-wide bg-primary border-b border-primary whitespace-nowrap';
const td = 'py-2 px-3 border-b border-gray-100 align-top';

/** How much of a line stores still has to supply. */
export const remainingOf = (line: any): number => line.quantity - (line.quantityFulfilledFromStock || 0);

/**
 * Lines still owed that have no category. Requesters no longer pick one, so
 * stores sets it here; procurement matches suppliers on it.
 */
export const linesNeedingCategory = (requisition: any): any[] =>
  (requisition.items || []).filter((line: any) => remainingOf(line) > 0 && !isValidCategoryCode(line.category || ''));

export const allLinesIssued = (requisition: any): boolean =>
  requisition.items?.length > 0 && requisition.items.every((line: any) => remainingOf(line) <= 0);

type Action = 'forward' | 'auto' | 'fulfill';

/**
 * Stores' review of one IR: each line with the stock held for it, the category
 * for anything going on to procurement, and a way into the inventory to issue
 * it. The decision buttons sit in the footer.
 */
export default function StoresReviewDrawer({
  requisition,
  onClose,
  onUpdated,
  onAction,
  acting
}: {
  requisition: any;
  onClose: () => void;
  /** The requisition with a line changed here, so the list behind stays in step. */
  onUpdated: (requisition: any) => void;
  onAction: (action: Action) => void;
  /** The action in progress, if any. */
  acting: Action | null;
}) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [savingLine, setSavingLine] = useState<number | null>(null);

  const lines: any[] = requisition.items || [];
  const needCategory = linesNeedingCategory(requisition).length;
  const fullyIssued = allLinesIssued(requisition);

  const setCategory = async (lineIndex: number, category: string) => {
    try {
      setSavingLine(lineIndex);
      await storesAPI.setPurchaseRequisitionLineCategory(requisition._id, { lineIndex, category });
      onUpdated({
        ...requisition,
        items: lines.map((line, i) => (i === lineIndex ? { ...line, category } : line))
      });
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Could not save the category', 'error');
    } finally {
      setSavingLine(null);
    }
  };

  /** Open the inventory searched for this line, ready to issue it against the IR. */
  const issueFromStock = (lineIndex: number, line: any) => {
    const params = new URLSearchParams({
      search: line.description,
      prId: requisition._id,
      lineIndex: String(lineIndex),
      prNumber: requisition.requisitionNumber,
      lineQty: String(remainingOf(line)),
      lineUnit: line.unit || 'each'
    });
    navigate(`/app/inventory?${params.toString()}`);
  };

  const requester = requisition.requestedBy
    ? `${requisition.requestedBy.firstName} ${requisition.requestedBy.lastName}`
    : null;

  return (
    <Drawer
      isOpen
      onClose={onClose}
      size="xl"
      title={requisition.requisitionNumber}
      subtitle={[requisition.title, requisition.department?.name, requester].filter(Boolean).join(' · ')}
      footer={
        fullyIssued ? (
          <button
            type="button"
            disabled={!!acting}
            onClick={() => onAction('fulfill')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {acting === 'fulfill' && <Loader2 className="h-4 w-4 animate-spin" />}
            Fulfill from stock
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!!acting}
              onClick={() => onAction('auto')}
              title="Issue whatever is in stock and forward the rest"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {acting === 'auto' && <Loader2 className="h-4 w-4 animate-spin" />}
              Auto-process
            </button>
            <button
              type="button"
              disabled={!!acting || needCategory > 0}
              onClick={() => onAction('forward')}
              title={needCategory > 0 ? 'Set a category on every line still owed first' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {acting === 'forward' && <Loader2 className="h-4 w-4 animate-spin" />}
              Forward to procurement
            </button>
          </>
        )
      }
    >
      {requisition.justification && (
        <p className="mb-4 text-sm text-gray-600 whitespace-pre-line">{requisition.justification}</p>
      )}

      {needCategory > 0 && (
        <p className="mb-4 px-3 py-2 text-sm rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
          {needCategory === 1 ? '1 line needs' : `${needCategory} lines need`} a category before it can go to
          procurement. Issue what you hold first; only what is still owed needs one.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={th}>#</th>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={th}>In stock</th>
              <th className={th}>Category</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const remaining = remainingOf(line);
              const issued = line.quantityFulfilledFromStock || 0;
              const avail = line.storeAvailability;
              const category = isValidCategoryCode(line.category || '') ? line.category : '';
              return (
                <tr key={line._id || i} className="odd:bg-white even:bg-primary/[0.035] hover:bg-primary/[0.07] transition-colors">
                  <td className={`${td} text-gray-500 tabular-nums`}>{i + 1}</td>
                  <td className={td}>
                    <p className="font-medium text-gray-900">{line.description}</p>
                    {line.specification && <p className="text-xs text-gray-500">{line.specification}</p>}
                    <p className={`text-xs ${line.item ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {line.item ? 'From the catalogue' : 'New item — not in the catalogue'}
                    </p>
                  </td>
                  <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
                    {line.quantity} {line.unit}
                    {issued > 0 && <span className="block text-xs text-emerald-700">{issued} issued</span>}
                  </td>
                  <td className={`${td} text-xs whitespace-nowrap`}>
                    {!line.item ? (
                      <span className="text-gray-500">Search to check</span>
                    ) : (
                      <>
                        <span className={(avail?.quantityAtSite || 0) >= remaining ? 'text-emerald-700' : 'text-gray-700'}>
                          {avail?.quantityAtSite || 0} here
                        </span>
                        {(avail?.quantityAtOtherSites || 0) > 0 && (
                          <span className="block text-gray-500">{avail.quantityAtOtherSites} at other sites</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className={`${td} min-w-[14rem]`}>
                    {remaining > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <CategorySelect
                            value={category}
                            onChange={(code) => code && code !== category && setCategory(i, code)}
                            placeholder="Choose category"
                          />
                        </div>
                        {savingLine === i && <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />}
                      </div>
                    ) : (
                      <span className="text-gray-600">{category ? getCategoryName(category) : '—'}</span>
                    )}
                    {/* Older catalogue items carry a free-text group, not a code: a hint for choosing. */}
                    {remaining > 0 && !category && line.category && (
                      <p className="mt-1 text-xs text-gray-500">Catalogue: {line.category}</p>
                    )}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {remaining > 0 ? (
                      <button
                        type="button"
                        onClick={() => issueFromStock(i, line)}
                        className="px-2 py-1 text-xs font-medium border border-primary rounded bg-primary text-white hover:bg-primary-dark transition-colors"
                      >
                        Issue from stock
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700">Issued</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Drawer>
  );
}
