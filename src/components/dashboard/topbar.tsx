"use client";

import { Menu, FileSpreadsheet, Settings, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TopbarProps {
  fileName: string | null;
  userEmail: string;
  onMenuToggle: () => void;
  onLogout: () => void;
}

function getInitials(email: string): string {
  const name = email.split("@")[0];
  if (name.length <= 2) return name.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Topbar({
  fileName,
  userEmail,
  onMenuToggle,
  onLogout,
}: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Current file name */}
        {fileName ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
              <FileSpreadsheet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">
                {fileName}
              </h1>
              <p className="text-xs text-slate-400">Active spreadsheet</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No file selected</p>
          </div>
        )}
      </div>

      {/* Right section - User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50 focus:outline-none"
        >
          <Avatar>
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-semibold text-white">
              {getInitials(userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-slate-700">{userEmail}</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-slate-700">{userEmail}</p>
            <p className="text-xs text-slate-400">SheetAI Pro Account</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
