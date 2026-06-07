"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  LogOut,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileList } from "./file-list";

interface SidebarFile {
  id: string;
  name: string;
  created_at: string;
}

interface SidebarProps {
  files: SidebarFile[];
  activeFileId: string | null;
  onFileSelect: (id: string) => void;
  onUploadClick: () => void;
  creditsRemaining: number;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({
  files,
  activeFileId,
  onFileSelect,
  onUploadClick,
  creditsRemaining,
  onLogout,
  isCollapsed,
  onToggle,
}: SidebarProps) {
  const maxCredits = 100;
  const creditPercentage = Math.min((creditsRemaining / maxCredits) * 100, 100);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex h-full shrink-0 flex-col border-r border-slate-200/60 bg-white"
    >
      {/* Logo & Toggle */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-slate-100 px-4",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-800">
                Sheet<span className="text-emerald-600">AI</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggle}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Upload button */}
      <div className={cn("shrink-0 px-3 pt-4 pb-2", isCollapsed && "px-2")}>
        <button
          onClick={onUploadClick}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 font-medium text-white shadow-sm transition-all duration-200 hover:from-emerald-600 hover:to-teal-600 hover:shadow-md active:scale-[0.98]",
            isCollapsed ? "h-10 w-10 mx-auto" : "h-10 px-4 text-sm"
          )}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span>Upload New</span>}
        </button>
      </div>

      {/* Files section */}
      <div className="flex min-h-0 flex-1 flex-col">
        {!isCollapsed && (
          <div className="shrink-0 px-4 pt-4 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Your Files
            </p>
          </div>
        )}
        <ScrollArea className="flex-1">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1 px-2 pt-2">
              {files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => onFileSelect(file.id)}
                  title={file.name}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-200",
                    file.id === activeFileId
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600"
                  )}
                >
                  {file.name.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          ) : (
            <FileList
              files={files}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onFileDelete={() => {
                /* handled by parent */
              }}
            />
          )}
        </ScrollArea>
      </div>

      {/* Bottom section - Credits & Logout */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-100",
          isCollapsed ? "p-2" : "p-4"
        )}
      >
        {/* Credits display */}
        {!isCollapsed ? (
          <div className="mb-3 rounded-xl bg-gradient-to-r from-slate-50 to-emerald-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-700">
                  Credits
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-600">
                {creditsRemaining}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${creditPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  creditPercentage > 50
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : creditPercentage > 20
                      ? "bg-gradient-to-r from-amber-400 to-orange-400"
                      : "bg-gradient-to-r from-red-400 to-rose-500"
                )}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {creditsRemaining} of {maxCredits} queries remaining
            </p>
          </div>
        ) : (
          <div className="mb-2 flex flex-col items-center">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"
              title={`${creditsRemaining} credits remaining`}
            >
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={onLogout}
          className={cn(
            "flex w-full items-center rounded-xl text-slate-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600",
            isCollapsed
              ? "h-9 w-9 mx-auto justify-center"
              : "h-9 gap-2 px-3 text-sm"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Log out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
