import React from 'react';

type Props = {
  cols?: number;
  rows?: number;
};

export default function TableSkeleton({ cols = 5, rows = 8 }: Props) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="odd:bg-white even:bg-primary/[0.035]">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-2.5 px-3 border-b border-gray-100">
              <div
                className="h-4 rounded bg-gray-200 animate-pulse"
                style={{ width: `${60 + ((r * 3 + c * 7) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
