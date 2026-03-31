'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import type { FeedbackForm, FeedbackResponse } from '../types';

interface ResponsesTableProps {
  responses: FeedbackResponse[];
  forms: FeedbackForm[];
  onExport: () => void;
}

type RowData = {
  formTitle: string;
  location: string;
  submittedAt: string;
  [questionId: string]: string;
};

const columnHelper = createColumnHelper<RowData>();

export default function ResponsesTable({ responses, forms, onExport }: ResponsesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const formsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const form of forms) {
      map[form.id] = form.title;
    }
    return map;
  }, [forms]);

  // Collect all unique question IDs across all responses
  const questionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const response of responses) {
      for (const key of Object.keys(response.responses)) {
        ids.add(key);
      }
    }
    return Array.from(ids);
  }, [responses]);

  // Flatten responses to row data
  const data = useMemo<RowData[]>(() => {
    return responses.map((response) => {
      const submittedAt =
        response.submittedAt instanceof Date
          ? response.submittedAt.toLocaleString()
          : typeof response.submittedAt === 'object' && 'toDate' in response.submittedAt
          ? (response.submittedAt as { toDate: () => Date }).toDate().toLocaleString()
          : String(response.submittedAt);

      const row: RowData = {
        formTitle: formsMap[response.formId] ?? response.formId,
        location: response.location,
        submittedAt,
      };

      for (const qId of questionIds) {
        row[qId] = response.responses[qId] !== undefined ? String(response.responses[qId]) : '';
      }

      return row;
    });
  }, [responses, formsMap, questionIds]);

  const columns = useMemo(() => {
    const staticCols = [
      columnHelper.accessor('formTitle', {
        header: 'Form Title',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('location', {
        header: 'Location',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('submittedAt', {
        header: 'Submitted At',
        cell: (info) => info.getValue(),
      }),
    ];

    const dynamicCols = questionIds.map((qId) =>
      columnHelper.accessor(qId, {
        id: qId,
        header: qId,
        cell: (info) => info.getValue() ?? '',
      })
    );

    return [...staticCols, ...dynamicCols];
  }, [questionIds]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search responses..."
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search responses"
        />
        <button
          onClick={onExport}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 whitespace-nowrap"
        >
          Export to Excel
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`px-4 py-3 text-left font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-gray-100' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <span aria-hidden>↑</span>}
                      {header.column.getIsSorted() === 'desc' && <span aria-hidden>↓</span>}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  No responses found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        {table.getRowModel().rows.length} of {data.length} row(s) shown
      </p>
    </div>
  );
}
