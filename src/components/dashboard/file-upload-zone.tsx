"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFileUploaded: (file: File) => void;
  isUploading: boolean;
}

const ACCEPTED_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function isValidFile(file: File): boolean {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return (
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.includes(extension)
  );
}

export function FileUploadZone({
  onFileUploaded,
  isUploading,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!isValidFile(file)) {
        setError("Please upload a .csv, .xlsx, or .xls file");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError("File size must be under 50MB");
        return;
      }
      onFileUploaded(file);
    },
    [onFileUploaded]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload spreadsheet file"
      />

      <motion.div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        whileHover={!isUploading ? { scale: 1.005 } : undefined}
        whileTap={!isUploading ? { scale: 0.995 } : undefined}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
          isDragging
            ? "border-emerald-400 bg-gradient-to-b from-emerald-50 to-teal-50 shadow-lg shadow-emerald-100/50"
            : "border-slate-200 bg-gradient-to-b from-slate-50/50 to-white hover:border-emerald-300 hover:bg-gradient-to-b hover:from-emerald-50/30 hover:to-white hover:shadow-sm",
          isUploading && "pointer-events-none"
        )}
      >
        {/* Background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <defs>
              <pattern
                id="grid-pattern"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        <div className="relative flex flex-col items-center justify-center px-8 py-16">
          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200/50">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
                <p className="text-base font-semibold text-slate-700">
                  Processing your file...
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Parsing data and preparing for analysis
                </p>
                {/* Progress bar */}
                <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: "5%" }}
                    animate={{ width: "90%" }}
                    transition={{ duration: 3, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  />
                </div>
              </motion.div>
            ) : isDragging ? (
              <motion.div
                key="dragging"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-200/50"
                >
                  <Upload className="h-8 w-8 text-white" />
                </motion.div>
                <p className="text-base font-semibold text-emerald-700">
                  Drop your file here
                </p>
                <p className="mt-1 text-sm text-emerald-500">
                  Release to start uploading
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-sm ring-1 ring-slate-200/60">
                  <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-base font-semibold text-slate-700">
                  Upload your spreadsheet
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Drag and drop or{" "}
                  <span className="font-medium text-emerald-600">
                    browse files
                  </span>
                </p>
                <div className="mt-4 flex items-center gap-2">
                  {[".CSV", ".XLSX", ".XLS"].map((ext) => (
                    <span
                      key={ext}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Maximum file size: 50MB
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
