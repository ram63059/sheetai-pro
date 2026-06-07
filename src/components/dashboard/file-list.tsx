"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileSpreadsheet, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  name: string;
  created_at: string;
}

interface FileListProps {
  files: FileItem[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onFileDelete: (id: string) => void;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FileList({
  files,
  activeFileId,
  onFileSelect,
  onFileDelete,
}: FileListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <FileSpreadsheet className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">No files yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Upload a spreadsheet to get started
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      <AnimatePresence initial={false}>
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const isHovered = file.id === hoveredId;

          return (
            <motion.button
              key={file.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onFileSelect(file.id)}
              onMouseEnter={() => setHoveredId(file.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm ring-1 ring-emerald-200/60"
                  : "hover:bg-slate-50"
              )}
            >
              {/* File icon */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                  isActive
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600"
                )}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </div>

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium transition-colors duration-200",
                    isActive ? "text-emerald-900" : "text-slate-700"
                  )}
                >
                  {file.name}
                </p>
                <div className="mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <p className="text-xs text-slate-400">
                    {formatRelativeDate(file.created_at)}
                  </p>
                </div>
              </div>

              {/* Delete button */}
              <AnimatePresence>
                {isHovered && !isActive && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDelete(file.id);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeFileIndicator"
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-500"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
