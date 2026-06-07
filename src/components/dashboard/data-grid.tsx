"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Table2,
  Rows3,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedFileData } from "@/lib/file-parser";

interface DataGridProps {
  data: ParsedFileData | null;
}

const ROWS_PER_PAGE = 50;

export function DataGrid({ data }: DataGridProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!data) return 0;
    return Math.ceil(data.totalRows / ROWS_PER_PAGE);
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return data.rows.slice(start, end);
  }, [data, currentPage]);

  const startRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow = Math.min(currentPage * ROWS_PER_PAGE, data?.totalRows ?? 0);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <Table2 className="h-7 w-7 text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">No data to display</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload a file to see your data here
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Rows3 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-slate-600">
              {data.totalRows.toLocaleString()} rows
            </span>
          </div>
          <div className="h-3 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <Columns3 className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-xs font-medium text-slate-600">
              {data.totalColumns} columns
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Showing {startRow}–{endRow} of {data.totalRows.toLocaleString()}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {/* Row number header */}
              <th className="sticky left-0 z-10 w-12 bg-slate-50 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
                #
              </th>
              {data.headers.map((header, idx) => (
                <th
                  key={idx}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIdx) => {
              const absoluteRowIdx = (currentPage - 1) * ROWS_PER_PAGE + rowIdx;
              const isEven = rowIdx % 2 === 0;

              return (
                <tr
                  key={absoluteRowIdx}
                  className={cn(
                    "group border-b border-slate-50 transition-colors duration-100 hover:bg-emerald-50/30",
                    isEven ? "bg-white" : "bg-slate-50/30"
                  )}
                >
                  {/* Row number */}
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-center text-xs font-medium text-slate-400">
                    {absoluteRowIdx + 1}
                  </td>
                  {data.headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className="max-w-[300px] truncate whitespace-nowrap px-4 py-2 text-sm text-slate-700"
                      title={row[colIdx] ?? ""}
                    >
                      {row[colIdx] ?? ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-1">
            {/* First page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                currentPage === 1
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            {/* Previous page */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                currentPage === 1
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-all",
                    currentPage === pageNum
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next page */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                currentPage === totalPages
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Last page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                currentPage === totalPages
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              )}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
