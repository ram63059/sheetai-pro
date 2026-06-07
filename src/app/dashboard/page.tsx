"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseFile, generateDataContext, exportToCSV, exportToXLSX, type ParsedFileData } from "@/lib/file-parser";
import {
  FileSpreadsheet, Sparkles, PanelLeftClose, PanelLeft, Upload, LogOut, Trash2, Send,
  Loader2, FunctionSquare, Zap, GripVertical, Link as LinkIcon,
  Plus, Minus, Undo2, Redo2, ArrowUpDown, Search, Download, X,
  ArrowUp, ArrowDown, CheckCircle2
} from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";

// ─── Types ────────────────────────────────────────────────────────
interface FileRecord {
  id: string;
  name: string;
  storage_path: string;
  row_count: number;
  column_count: number;
  columns_metadata: string[];
  created_at: string;
}

interface MessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

type ToolTab = "chat" | "formula" | "actions";

interface HistoryEntry {
  headers: string[];
  rows: string[][];
}

// ─── Apply Action Types ────────────────────────────────────────
interface ApplyAction {
  action: "add_column" | "update_column" | "delete_rows" | "filter_rows" | "rename_column";
  column_name?: string;
  javascript_expression?: string;
  condition_expression?: string;
  old_name?: string;
  new_name?: string;
}

// ─── Fuzzy Row Object Builder ──────────────────────────────────────
// Creates a row object where column lookups are case-insensitive and trim-aware.
// This handles AI expressions like row['periods'] when the actual header is 'Periods'.
function buildFuzzyRowObject(headers: string[], rowValues: string[]): Record<string, string> {
  const exact: Record<string, string> = {};
  const normalized: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const val = rowValues[i] ?? "";
    exact[headers[i]] = val;
    normalized[headers[i].trim().toLowerCase()] = val;
  }
  return new Proxy(exact, {
    get(target, prop) {
      // Guard: Proxy.get receives Symbols for internal JS operations — pass through
      if (typeof prop !== "string") return Reflect.get(target, prop);
      // Exact match first
      if (prop in target) return target[prop];
      // Case-insensitive, trim-aware lookup
      const key = prop.trim().toLowerCase();
      if (key in normalized) return normalized[key];
      // Partial match as last resort
      for (const h of Object.keys(normalized)) {
        if (h.includes(key) || key.includes(h)) return normalized[h];
      }
      return undefined;
    },
    has(target, prop) {
      if (typeof prop !== "string") return Reflect.has(target, prop);
      if (prop in target) return true;
      const key = prop.trim().toLowerCase();
      return key in normalized;
    }
  });
}

// ─── Chat Message Component ────────────────────────────────────────
function ChatMessage({ role, content, onApply, editHeaders, editRows }: { role: string; content: string; onApply?: (action: ApplyAction) => void; editHeaders?: string[]; editRows?: string[][] }) {
  const [copied, setCopied] = useState(false);
  const [appliedBlocks, setAppliedBlocks] = useState<Set<number>>(new Set());

  const handleCopyFormula = (formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopied(true);
    toast.success("Formula copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = (action: ApplyAction, blockIndex: number) => {
    if (onApply) {
      onApply(action);
      setAppliedBlocks((prev) => new Set(prev).add(blockIndex));
      toast.success("Applied to sheet!");
    }
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(```(?:formula|chart|apply)[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```formula")) {
        const formula = part.replace(/```formula\n?/, "").replace(/```$/, "").trim();
        return (
          <div key={i} className="my-3 border border-slate-200 rounded-md overflow-hidden bg-slate-50">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Formula</span>
              <button onClick={() => handleCopyFormula(formula)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>            <pre className="p-3 text-sm font-mono text-slate-800 overflow-x-auto">{formula}</pre>
          </div>        );
      }
      if (part.startsWith("```chart")) {
        const chartJson = part.replace(/```chart\n?/, "").replace(/```$/, "").trim();
        return <ChartBlock key={i} json={chartJson} />;
      }
      if (part.startsWith("```apply")) {
        // Robust extraction of JSON from the codeblock
        const lines = part.trim().split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) lines.pop();
        
        let applyJson = lines.join("\n").trim();
        
        // Extract the JSON object by finding matching braces (handles nested objects)
        const firstBrace = applyJson.indexOf("{");
        if (firstBrace !== -1) {
          let depth = 0;
          let lastBrace = -1;
          for (let ci = firstBrace; ci < applyJson.length; ci++) {
            if (applyJson[ci] === "{") depth++;
            else if (applyJson[ci] === "}") { depth--; if (depth === 0) { lastBrace = ci; break; } }
          }
          if (lastBrace > firstBrace) {
            applyJson = applyJson.substring(firstBrace, lastBrace + 1);
          }
        }

        // Clean up common AI mistakes before parsing
        // 1. Remove trailing commas before closing braces
        applyJson = applyJson.replace(/,\s*}/g, "}");
        // 2. Remove JS-style comments
        applyJson = applyJson.replace(/\/\/.*$/gm, "");
        
        // Try to parse as JSON, with multiple fallback strategies
        let parsedAction: ApplyAction | null = null;
        
        // Strategy 1: Direct JSON.parse
        try {
          parsedAction = JSON.parse(applyJson);
        } catch {
          // Strategy 2: Try to fix single quotes → double quotes (AI sometimes uses single quotes)
          try {
            const fixed = applyJson.replace(/'/g, '"');
            parsedAction = JSON.parse(fixed);
          } catch {
            // Strategy 3: Regex extraction as absolute last resort
            try {
              const actionMatch = applyJson.match(/"action"\s*:\s*"([^"]+)"/);
              const colMatch = applyJson.match(/"column_name"\s*:\s*"([^"]+)"/);
              const jsExprMatch = applyJson.match(/"javascript_expression"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              const condMatch = applyJson.match(/"condition_expression"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              const oldNameMatch = applyJson.match(/"old_name"\s*:\s*"([^"]+)"/);
              const newNameMatch = applyJson.match(/"new_name"\s*:\s*"([^"]+)"/);
              
              if (actionMatch) {
                parsedAction = {
                  action: actionMatch[1] as ApplyAction["action"],
                  ...(colMatch && { column_name: colMatch[1] }),
                  ...(jsExprMatch && { javascript_expression: jsExprMatch[1].replace(/\\"/g, '"') }),
                  ...(condMatch && { condition_expression: condMatch[1].replace(/\\"/g, '"') }),
                  ...(oldNameMatch && { old_name: oldNameMatch[1] }),
                  ...(newNameMatch && { new_name: newNameMatch[1] }),
                };
              }
            } catch { /* all strategies failed */ }
          }
        }

        if (parsedAction && parsedAction.action) {
          const action = parsedAction;
          const isApplied = appliedBlocks.has(i);
          const actionLabel = action.action === "add_column" ? `Add column "${action.column_name}"`
            : action.action === "update_column" ? `Update column "${action.column_name}"`
            : action.action === "delete_rows" ? `Delete rows matching condition`
            : action.action === "filter_rows" ? `Filter rows matching condition`
            : action.action === "rename_column" ? `Rename "${action.old_name}" → "${action.new_name}"`
            : "Apply changes";

          // Compute preview counts if we have data
          let previewInfo: string | null = null;
          let previewWarning = false;
          let debugExpr: string | null = null;
          let debugError: string | null = null;
          if (editHeaders && editRows && editRows.length > 0) {
            try {
              if ((action.action === "filter_rows" || action.action === "delete_rows") && action.condition_expression) {
                debugExpr = action.condition_expression;
                let matchCount = 0;
                let errorCount = 0;
                let firstError = "";
                
                for (const rowValues of editRows) {
                  try {
                    const rowObj = buildFuzzyRowObject(editHeaders, rowValues);
                    const func = new Function("row", `return ${action.condition_expression}`);
                    if (!!func(rowObj)) matchCount++;
                  } catch (e) {
                    errorCount++;
                    if (!firstError) firstError = (e instanceof Error ? e.message : String(e));
                  }
                }

                if (errorCount === editRows.length) {
                  // ALL rows threw errors — the expression itself is broken
                  previewInfo = `⚠️ Expression error: ${firstError}`;
                  previewWarning = true;
                  debugError = firstError;
                } else if (action.action === "filter_rows") {
                  previewInfo = matchCount === 0
                    ? `⚠️ No rows match — filter will NOT be applied`
                    : `Will show ${matchCount} of ${editRows.length} rows`;
                  previewWarning = matchCount === 0;
                } else {
                  previewInfo = matchCount === 0
                    ? `No rows match this condition`
                    : `Will permanently remove ${matchCount} of ${editRows.length} rows`;
                  previewWarning = matchCount === editRows.length;
                }
              }
              if ((action.action === "add_column" || action.action === "update_column") && action.javascript_expression) {
                const samples = editRows.slice(0, 3).map((rowValues) => {
                  try {
                    const rowObj = buildFuzzyRowObject(editHeaders, rowValues);
                    const func = new Function("row", `return ${action.javascript_expression}`);
                    const val = func(rowObj);
                    return val === null || val === undefined ? "(empty)" : String(val).substring(0, 40);
                  } catch { return "(error)"; }
                });
                previewInfo = `Sample values: ${samples.map(s => `"${s}"`).join(", ")}`;
              }
            } catch { /* preview failed, no big deal */ }
          }

          return (
            <div key={i} className="my-3 border border-emerald-200 rounded-md overflow-hidden bg-emerald-50">
              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-100/80 border-b border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap size={10} /> Sheet Action
                </span>
                <span className="text-[10px] font-semibold text-emerald-600">{actionLabel}</span>
              </div>              <div className="p-3">
                {action.action === "filter_rows" && action.condition_expression && (
                  <p className="text-xs text-slate-600 mb-2">
                    Will filter rows (non-destructive — your data stays safe).
                  </p>
                )}
                {action.action === "delete_rows" && action.condition_expression && (
                  <p className="text-xs text-slate-600 mb-2">
                    Will <strong>permanently remove</strong> rows matching the condition.
                  </p>
                )}
                {action.action === "add_column" && action.javascript_expression && (
                  <p className="text-xs text-slate-600 mb-2">
                    Will compute and add <strong>{action.column_name}</strong> to all rows.
                  </p>
                )}
                {action.action === "update_column" && action.javascript_expression && (
                  <p className="text-xs text-slate-600 mb-2">
                    Will overwrite <strong>{action.column_name}</strong> with computed values.
                  </p>
                )}
                {action.action === "rename_column" && (
                  <p className="text-xs text-slate-600 mb-2">
                    Will rename column <strong>{action.old_name}</strong> to <strong>{action.new_name}</strong>.
                  </p>
                )}
                {previewInfo && (
                  <p className={`text-[11px] font-semibold mb-2 px-2 py-1 rounded ${previewWarning ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                    {previewInfo}
                  </p>
                )}
                {previewWarning && debugExpr && (
                  <div className="mb-2 p-2 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600 overflow-x-auto">
                    <span className="text-slate-400">Expression: </span>{debugExpr}
                    {debugError && <><br/><span className="text-red-500">Error: </span>{debugError}</>}
                  </div>
                )}
                <button
                  onClick={() => handleApply(action, i)}
                  disabled={isApplied || previewWarning}
                  className={`w-full flex items-center justify-center gap-2 h-9 rounded-md font-semibold text-sm transition-all shadow-sm ${
                    isApplied
                      ? "bg-emerald-200 text-emerald-700 cursor-default"
                      : previewWarning
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {isApplied ? (
                    <><span>✓</span> Applied to Sheet</>
                  ) : previewWarning ? (
                    <>Cannot Apply</>
                  ) : (
                    <><Zap size={14} /> Apply to Sheet</>
                  )}
                </button>
              </div>            </div>          );
        } else {
          return (
            <div key={i} className="my-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-600 overflow-x-auto font-mono whitespace-pre-wrap">
              <strong>Failed to parse sheet action.</strong><br/>
              {applyJson}
            </div>          );
        }
      }
      return (
        <div key={i} className="prose prose-sm max-w-none prose-slate" dangerouslySetInnerHTML={{ __html: simpleMarkdown(part) }} />
      );
    });
  };

  if (role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-slate-800 text-white px-4 py-2.5 rounded-lg rounded-tr-sm shadow-sm">
          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>      </div>    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
        <Sparkles size={12} />
      </div>      <div className="max-w-[85%]">{renderContent(content)}</div>    </div>  );
}


// ─── Simple Markdown ────────────────────────────────────────
function simpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-xs font-mono text-emerald-700">$1</code>')
    .replace(/\n- /g, "<br/>• ")
    .replace(/\n\d+\. /g, (match) => `<br/>${match.trim()} `)
    .replace(/\n/g, "<br/>");
}

// ─── Chart Block ────────────────────────────────────────────────────
function ChartBlock({ json }: { json: string }) {
  try {
    const config = JSON.parse(json);
    const maxVal = Math.max(...config.data.map((d: Record<string, number>) => {
      const key = config.yKeys?.[0];
      return key ? Number(d[key]) || 0 : 0;
    }));
    return (
      <div className="my-4 p-4 border border-slate-200 rounded-md bg-white">
        <h4 className="text-sm font-semibold text-slate-800 mb-3">{config.title || "Chart"}</h4>
        <div className="flex items-end gap-1 h-32">
          {config.data.slice(0, 15).map((d: Record<string, string | number>, i: number) => {
            const key = config.yKeys?.[0];
            const val = key ? Number(d[key]) || 0 : 0;
            const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] font-medium text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{val}</span>
                <div className="w-full bg-emerald-500 rounded-t-sm hover:bg-emerald-400 transition-colors min-h-[2px]" style={{ height: `${height}%` }} />
              </div>            );
          })}
        </div>      </div>    );
  } catch {
    return <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-600">Chart generation failed.</div>;
  }
}

// ─── Main Dashboard Page ────────────────────────────────────────
export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // User / File State
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [credits, setCredits] = useState(100);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);

  // Editable Data (mutable working copy)
  const [editHeaders, setEditHeaders] = useState<string[]>([]);
  const [editRows, setEditRows] = useState<string[][]>([]);

  // Cell interaction
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [cellDraft, setCellDraft] = useState("");

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  // Sort
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Search & Replace
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");

  // Non-destructive filter (filter_rows sets this instead of deleting rows)
  const [activeFilter, setActiveFilter] = useState<{ expression: string; label: string } | null>(null);

  // Tool State
  const [activeTab, setActiveTab] = useState<ToolTab>("chat");
  const [inputMessage, setInputMessage] = useState("");
  const [formulaInput, setFormulaInput] = useState("");
  const [formulaResult, setFormulaResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // ─── Helper: Push current state to undo stack ────────────────
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-49), { headers: [...editHeaders], rows: editRows.map((r) => [...r]) }]);
    setRedoStack([]);
  }, [editHeaders, editRows]);

  // ─── Helper: Regenerate AI context from editable data ────────
  const regenerateContext = useCallback((headers: string[], rows: string[][]) => {
    const fakeData: ParsedFileData = { headers, rows, totalRows: rows.length, totalColumns: headers.length };
    return generateDataContext(fakeData);
  }, []);

  // ─── Sync parsedData → editableData ──────────────────────────
  useEffect(() => {
    if (parsedData) {
      setEditHeaders([...parsedData.headers]);
      setEditRows(parsedData.rows.map((r) => [...r]));
      setUndoStack([]);
      setRedoStack([]);
      setSelectedCell(null);
      setEditingCell(null);
      setSortCol(null);
      setActiveFilter(null);
    }
  }, [parsedData]);

  // ─── Focus cell input when editing ───────────────────────────
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    if (editingHeader !== null && headerInputRef.current) {
      headerInputRef.current.focus();
      headerInputRef.current.select();
    }
  }, [editingHeader]);

  // Scroll chat
  useEffect(() => {
    if (activeTab === "chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // ─── Load user data on mount ────────────────────────────────
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserEmail(user.email || "");
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("credits_remaining, plan").eq("id", user.id).single();
      if (profile) {
        if (!profile.plan || profile.plan === 'free') {
          setCredits(0);
        } else {
          setCredits(profile.credits_remaining);
        }
      }
      const { data: userFiles } = await supabase.from("files").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (userFiles) setFiles(userFiles);
    };
    loadUser();
  }, [supabase, router]);

  // ─── File Upload ────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    if (!userId) return;
    setIsUploading(true);
    try {
      const data = await parseFile(file);
      const filePath = `${userId}/${Date.now()}_${file.name.replace(/\//g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("spreadsheets").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: fileRecord, error: insertError } = await supabase.from("files").insert({ user_id: userId, name: file.name, storage_path: filePath, row_count: data.totalRows, column_count: data.totalColumns, columns_metadata: data.headers }).select().single();
      if (insertError) throw insertError;
      setFiles((prev) => [fileRecord, ...prev]);
      setParsedData(data);
      setActiveFileId(fileRecord.id);
      setShowTools(true);
      const { data: chat } = await supabase.from("chats").insert({ user_id: userId, file_id: fileRecord.id, title: file.name }).select().single();
      if (chat) { setChatId(chat.id); setMessages([]); }
      toast.success(`${file.name} imported successfully!`);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to import file.");
    } finally { setIsUploading(false); }
  }, [userId, supabase]);

  // ─── Google Sheet Import ────────────────────────────────────
  const handleImportFromUrl = async () => {
    if (!sheetUrl.trim() || !userId) return;
    const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { toast.error("Invalid Google Sheets URL."); return; }
    const sheetId = match[1];
    setIsImporting(true);
    try {
      const response = await fetch("/api/import-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sheetId }) });
      if (!response.ok) { const errorData = await response.json().catch(() => null); throw new Error(errorData?.error || "Could not fetch the sheet."); }
      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv" });
      const file = new File([blob], `Google_Sheet_${sheetId.substring(0, 8)}.csv`, { type: "text/csv" });
      await handleFileUpload(file);
      setSheetUrl("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to import."); }
    finally { setIsImporting(false); }
  };

  // ─── File Select ────────────────────────────────────────────
  const handleFileSelect = useCallback(async (fileId: string) => {
    setActiveFileId(fileId);
    setShowTools(true);
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    try {
      const { data: fileData } = await supabase.storage.from("spreadsheets").download(file.storage_path);
      if (fileData) { const blob = new File([fileData], file.name); const parsed = await parseFile(blob); setParsedData(parsed); }
    } catch (err) { console.error("File load error:", err); setParsedData(null); }
    const { data: existingChats } = await supabase.from("chats").select("*").eq("file_id", fileId).eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
    if (existingChats && existingChats.length > 0) {
      setChatId(existingChats[0].id);
      const { data: chatMessages } = await supabase.from("messages").select("*").eq("chat_id", existingChats[0].id).order("created_at", { ascending: true });
      setMessages(chatMessages || []);
    } else {
      const { data: newChat } = await supabase.from("chats").insert({ user_id: userId, file_id: fileId, title: file.name }).select().single();
      if (newChat) { setChatId(newChat.id); setMessages([]); }
    }
  }, [files, userId, supabase]);

  // ─── File Delete ────────────────────────────────────────────
  const handleFileDelete = useCallback(async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;
    try {
      await supabase.storage.from("spreadsheets").remove([file.storage_path]);
      await supabase.from("files").delete().eq("id", fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFileId === fileId) { setActiveFileId(null); setParsedData(null); setMessages([]); setChatId(null); setShowTools(false); }
      toast.success("File deleted.");
    } catch { toast.error("Failed to delete file."); }
  }, [files, activeFileId, supabase]);

  // ═══════════════════════════════════════════════════════════
  //  SPREADSHEET EDITING OPERATIONS
  // ═══════════════════════════════════════════════════════════

  const commitCellEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    pushUndo();
    setEditRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = cellDraft;
      return next;
    });
    setEditingCell(null);
  };

  const commitHeaderEdit = () => {
    if (editingHeader === null) return;
    pushUndo();
    setEditHeaders((prev) => {
      const next = [...prev];
      next[editingHeader] = cellDraft;
      return next;
    });
    setEditingHeader(null);
  };

  const handleAddRow = () => {
    pushUndo();
    const insertIdx = selectedCell ? selectedCell.row + 1 : editRows.length;
    const newRow = new Array(editHeaders.length).fill("");
    setEditRows((prev) => [...prev.slice(0, insertIdx), newRow, ...prev.slice(insertIdx)]);
    toast.success("Row added.");
  };

  const handleDeleteRow = () => {
    if (!selectedCell || editRows.length <= 1) return;
    pushUndo();
    setEditRows((prev) => prev.filter((_, i) => i !== selectedCell.row));
    setSelectedCell(null);
    toast.success("Row deleted.");
  };

  const handleAddColumn = () => {
    pushUndo();
    const insertIdx = selectedCell ? selectedCell.col + 1 : editHeaders.length;
    setEditHeaders((prev) => [...prev.slice(0, insertIdx), `Column ${prev.length + 1}`, ...prev.slice(insertIdx)]);
    setEditRows((prev) => prev.map((r) => [...r.slice(0, insertIdx), "", ...r.slice(insertIdx)]));
    toast.success("Column added.");
  };

  const handleDeleteColumn = () => {
    if (!selectedCell || editHeaders.length <= 1) return;
    pushUndo();
    const colIdx = selectedCell.col;
    setEditHeaders((prev) => prev.filter((_, i) => i !== colIdx));
    setEditRows((prev) => prev.map((r) => r.filter((_, i) => i !== colIdx)));
    setSelectedCell(null);
    toast.success("Column deleted.");
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { headers: [...editHeaders], rows: editRows.map((r) => [...r]) }]);
    setEditHeaders(last.headers);
    setEditRows(last.rows);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { headers: [...editHeaders], rows: editRows.map((r) => [...r]) }]);
    setEditHeaders(last.headers);
    setEditRows(last.rows);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleSort = (colIdx: number) => {
    pushUndo();
    const newDir = sortCol === colIdx && sortDir === "asc" ? "desc" : "asc";
    setSortCol(colIdx);
    setSortDir(newDir);
    setEditRows((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const aVal = a[colIdx] ?? "";
        const bVal = b[colIdx] ?? "";
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return newDir === "asc" ? aNum - bNum : bNum - aNum;
        return newDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
      return sorted;
    });
  };

  const handleSearchReplace = (replaceAll: boolean) => {
    if (!searchTerm) return;
    pushUndo();
    let count = 0;
    setEditRows((prev) =>
      prev.map((row) =>
        row.map((cell) => {
          if (cell.includes(searchTerm)) {
            if (replaceAll || count === 0) {
              count++;
              return cell.replaceAll(searchTerm, replaceTerm);
            }
          }
          return cell;
        })
      )
    );
    if (count > 0) toast.success(`Replaced ${count} occurrence${count > 1 ? "s" : ""}.`);
    else toast.error("No matches found.");
  };

  const handleExport = (format: "csv" | "xlsx") => {
    const fileName = files.find((f) => f.id === activeFileId)?.name?.replace(/\.[^/.]+$/, "") || "export";
    if (format === "csv") exportToCSV(editHeaders, editRows, fileName);
    else exportToXLSX(editHeaders, editRows, fileName);
    toast.success(`Exported as ${format.toUpperCase()}.`);
  };

  // ─── Handle AI Apply Actions (Frontend Execution) ─────────────
  const handleApplyAction = useCallback((action: ApplyAction) => {
    // Helper to dry-run an expression on the first row to catch systemic AI errors
    const dryRunExpression = (expr: string) => {
      if (editRows.length === 0) return;
      try {
        const rowObj = buildFuzzyRowObject(editHeaders, editRows[0]);
        const func = new Function("row", `return ${expr}`);
        func(rowObj);
      } catch (err) {
        throw new Error(`AI generated invalid code for the expression "${expr}". Error: ${(err as Error).message}`);
      }
    };

    try {
      if (action.javascript_expression) dryRunExpression(action.javascript_expression);
      if (action.condition_expression) dryRunExpression(action.condition_expression);
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }

    pushUndo();

    // Helper to evaluate an expression for a specific row
    const evaluateExpression = (expr: string, rowValues: string[]) => {
      try {
        const rowObj = buildFuzzyRowObject(editHeaders, rowValues);
        // Use new Function to create a safe execution context
        const func = new Function("row", `return ${expr}`);
        const result = func(rowObj);
        return result === null || result === undefined ? "" : String(result);
      } catch (err) {
        console.error("Failed to evaluate expression:", expr, err);
        return "";
      }
    };

    const evaluateCondition = (expr: string, rowValues: string[]) => {
      try {
        const rowObj = buildFuzzyRowObject(editHeaders, rowValues);
        const func = new Function("row", `return ${expr}`);
        return !!func(rowObj);
      } catch (err) {
        console.error("Failed to evaluate condition:", expr, err);
        return false;
      }
    };

    if (action.action === "add_column" && action.column_name && action.javascript_expression) {
      setEditHeaders((prev) => [...prev, action.column_name!]);
      setEditRows((prev) =>
        prev.map((row) => [...row, evaluateExpression(action.javascript_expression!, row)])
      );
    }

    if (action.action === "update_column" && action.column_name && action.javascript_expression) {
      const colIdx = editHeaders.indexOf(action.column_name);
      if (colIdx === -1) {
        // Fallback to adding it
        setEditHeaders((prev) => [...prev, action.column_name!]);
        setEditRows((prev) =>
          prev.map((row) => [...row, evaluateExpression(action.javascript_expression!, row)])
        );
      } else {
        setEditRows((prev) =>
          prev.map((row) => {
            const next = [...row];
            next[colIdx] = evaluateExpression(action.javascript_expression!, row);
            return next;
          })
        );
      }
    }

    if (action.action === "delete_rows" && action.condition_expression) {
      setEditRows((prev) => {
        const next = prev.filter((row) => {
          const shouldDelete = evaluateCondition(action.condition_expression!, row);
          return !shouldDelete;
        });
        if (next.length === 0) {
          toast.warning("This action removed all rows! Click Undo if this was a mistake.");
        }
        return next;
      });
    }

    if (action.action === "filter_rows" && action.condition_expression) {
      // Non-destructive: set a view filter instead of deleting rows
      // First, check how many rows match to give user feedback
      const matchCount = editRows.filter((row) => {
        return evaluateCondition(action.condition_expression!, row);
      }).length;

      if (matchCount === 0) {
        toast.warning("No rows match this filter. Filter was NOT applied to prevent data loss.");
        return;
      }

      setActiveFilter({
        expression: action.condition_expression,
        label: action.condition_expression,
      });
      toast.success(`Filter applied: showing ${matchCount} of ${editRows.length} rows. Click "Clear Filter" to see all data.`);
    }

    if (action.action === "rename_column" && action.old_name && action.new_name) {
      const colIdx = editHeaders.indexOf(action.old_name);
      if (colIdx !== -1) {
        setEditHeaders((prev) => {
          const next = [...prev];
          next[colIdx] = action.new_name!;
          return next;
        });
      }
    }
  }, [pushUndo, editHeaders]);

  // ─── Keyboard navigation ───────────────────────────────────
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell || editingHeader !== null) return; // Don't navigate while editing

    if (!selectedCell) return;
    const { row, col } = selectedCell;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case "ArrowDown":
        e.preventDefault();
        if (row < editRows.length - 1) setSelectedCell({ row: row + 1, col });
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (col > 0) setSelectedCell({ row, col: col - 1 });
        break;
      case "ArrowRight":
        e.preventDefault();
        if (col < editHeaders.length - 1) setSelectedCell({ row, col: col + 1 });
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) setSelectedCell({ row, col: col - 1 });
          else if (row > 0) setSelectedCell({ row: row - 1, col: editHeaders.length - 1 });
        } else {
          if (col < editHeaders.length - 1) setSelectedCell({ row, col: col + 1 });
          else if (row < editRows.length - 1) setSelectedCell({ row: row + 1, col: 0 });
        }
        break;
      case "Enter":
        e.preventDefault();
        setCellDraft(editRows[row]?.[col] ?? "");
        setEditingCell({ row, col });
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        pushUndo();
        setEditRows((prev) => { const next = prev.map((r) => [...r]); next[row][col] = ""; return next; });
        break;
      default:
        // Start typing directly into a selected cell
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setCellDraft(e.key);
          setEditingCell({ row, col });
        }
        break;
    }

    // Undo/Redo shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    }
  };

  // ─── AI Request ─────────────────────────────────────────────
  const runAiRequest = async (prompt: string, saveToChat: boolean = true) => {
    if (!prompt.trim() || isLoading) return null;
    const userMsgId = crypto.randomUUID();
    const userMsg: MessageRecord = { id: userMsgId, role: "user", content: prompt.trim(), created_at: new Date().toISOString() };
    if (saveToChat) setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const chatHistory = saveToChat ? messages.map((m) => ({ role: m.role === "user" ? "user" as const : "model" as const, parts: [{ text: m.content }] })) : [];
      const dataCtx = regenerateContext(editHeaders, editRows);
      const response = await fetch("/api/chat", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          message: prompt, 
          dataContext: dataCtx, 
          chatHistory, 
          chatId: saveToChat ? chatId : null
        }) 
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to get response");
      if (saveToChat) {
        const aiMsg: MessageRecord = { id: crypto.randomUUID(), role: "assistant", content: data.response, created_at: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
      }
      if (data.creditsRemaining !== undefined) setCredits(data.creditsRemaining);
      return data.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
      if (saveToChat) setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
      return null;
    } finally { setIsLoading(false); }
  };

  const handleSendMessage = () => { if (inputMessage.trim()) { const msg = inputMessage; setInputMessage(""); runAiRequest(msg, true); } };
  const handleGenerateFormula = async () => {
    if (!formulaInput.trim()) return;
    const prompt = `Generate an exact Excel/Google Sheets formula for this requirement: "${formulaInput}". Return ONLY the formula inside a \`\`\`formula code block, and a brief 1-sentence explanation.`;
    const result = await runAiRequest(prompt, false);
    if (result) setFormulaResult(result);
  };
  const runQuickAction = async (action: string) => { setActiveTab("chat"); await runAiRequest(`Analyze my data and perform this action: ${action}. Present the findings clearly.`, true); };
  const handleLogout = async () => { 
    toast.loading("Logging out...", { id: "logout" });
    await supabase.auth.signOut(); 
    toast.success("Logged out successfully", { id: "logout" });
    router.push("/"); 
    router.refresh(); 
  };

  const handleCheckout = async (planId: "basic" | "pro") => {
    try {
      setIsCheckingOut(planId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      toast.loading(`Initializing checkout for ${planId} plan...`, { id: "checkout" });
      
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) throw new Error("Failed to initialize checkout.");
      const orderData = await res.json();

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SheetAI Pro",
        description: `Upgrade to ${planId.toUpperCase()} Plan`,
        order_id: orderData.orderId,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          toast.loading("Verifying payment...", { id: "checkout" });
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId
            }),
          });
          
          if (verifyRes.ok) {
            toast.success("Payment successful! Your plan has been upgraded.", { id: "checkout" });
            setShowPricingModal(false);
            router.refresh();
          } else {
            toast.error("Payment verification failed.", { id: "checkout" });
          }
          setIsCheckingOut(null);
        },
        modal: {
          ondismiss: function() {
            setIsCheckingOut(null);
          }
        },
        prefill: { email: session.user.email },
        theme: { color: "#10B981" },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: { error: { description: string } }) {
        toast.error(`Payment failed: ${response.error.description}`, { id: "checkout" });
        setIsCheckingOut(null);
      });
      toast.dismiss("checkout");
      rzp.open();
    } catch (error: unknown) {
      toast.error((error as Error).message, { id: "checkout" });
      setIsCheckingOut(null);
    }
  };

  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]); };

  const activeFile = files.find((f) => f.id === activeFileId);

  // Apply non-destructive filter if active
  const filteredRows = activeFilter
    ? editRows.filter((rowValues) => {
        try {
          const rowObj = buildFuzzyRowObject(editHeaders, rowValues);
          const func = new Function("row", `return ${activeFilter.expression}`);
          return !!func(rowObj);
        } catch {
          return true; // If expression fails, show the row
        }
      })
    : editRows;
  const displayRows = filteredRows.slice(0, 200);

  // Search highlight count
  const searchMatchCount = searchTerm ? editRows.reduce((acc, row) => acc + row.filter((cell) => cell.includes(searchTerm)).length, 0) : 0;

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {/* ─── Sidebar ─── */}
      <aside className={`${sidebarOpen ? "w-[260px]" : "w-0"} bg-slate-50 text-slate-800 border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
        <div className="h-14 border-b border-slate-200 flex items-center px-4 gap-2.5 shrink-0 bg-white">
          <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/20">
            <FileSpreadsheet size={14} strokeWidth={2.5} />
          </div>          <span className="font-bold text-sm tracking-tight text-slate-900">SheetAI Pro</span>
        </div>
        <div className="p-4 shrink-0 border-b border-slate-200 bg-white">
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 h-9 bg-white hover:bg-slate-50 text-slate-700 rounded-md font-semibold text-xs border border-slate-300 transition-colors shadow-sm mb-3">
            <Upload size={14} /> Upload CSV / Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="flex gap-1.5">
            <input type="text" placeholder="Paste Google Sheets link..." value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" disabled={isImporting} />
            <button onClick={handleImportFromUrl} disabled={isImporting || !sheetUrl.trim()} className="w-8 h-8 flex items-center justify-center bg-slate-800 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors shrink-0" title="Import from Link">
              {isImporting ? <Loader2 size={12} className="animate-spin" /> : <LinkIcon size={12} />}
            </button>
          </div>        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Workspace</p>
          {files.length === 0 ? (
            <p className="text-xs text-slate-500 px-2 font-medium">No files imported yet.</p>
          ) : (
            <div className="space-y-0.5">
              {files.map((file) => (
                <div key={file.id} onClick={() => handleFileSelect(file.id)} className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors cursor-pointer group ${activeFileId === file.id ? "bg-emerald-100/50 text-emerald-800 font-semibold" : "hover:bg-slate-200/50 text-slate-600"}`}>
                  <FileSpreadsheet size={14} className={activeFileId === file.id ? "text-emerald-600" : "text-slate-400"} />
                  <div className="flex-1 min-w-0"><p className="text-xs truncate">{file.name}</p></div>                  <button onClick={(e) => { e.stopPropagation(); handleFileDelete(file.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 rounded text-slate-400 transition-all"><Trash2 size={12} /></button>
                </div>              ))}
            </div>          )}
        </div>
        <div className="border-t border-slate-200 p-3 space-y-3 shrink-0 bg-white">
          <div className="bg-slate-50 rounded-md p-2.5 border border-slate-200">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Credits</span>
              <span className="text-[10px] font-bold text-emerald-600">{credits}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((credits / 100) * 100, 100)}%` }} />
            </div>
            <button onClick={() => setShowPricingModal(true)} className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all active:scale-95 flex justify-center items-center gap-1.5 shadow-sm hover:shadow-md">
              <Zap size={12} className="text-amber-400" /> Upgrade Plan
            </button>
          </div>
          <div className="flex flex-col gap-2 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-sm">{userEmail.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-slate-700 truncate">{userEmail}</p></div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-2 py-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors text-xs font-semibold border border-transparent hover:border-red-100 mt-1">
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors border border-transparent hover:border-slate-200">
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
            {activeFile && (
              <div className="flex items-center gap-2 text-slate-800">
                <span className="font-bold text-sm">{activeFile.name}</span>
                <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                  {activeFilter
                    ? `${filteredRows.length} of ${editRows.length.toLocaleString()} rows (filtered)`
                    : `${editRows.length.toLocaleString()} rows`} · {editHeaders.length} cols
                </span>
                {activeFilter && (
                  <button
                    onClick={() => { setActiveFilter(null); toast.success("Filter cleared. All rows are visible again."); }}
                    className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    <X size={10} /> Clear Filter
                  </button>
                )}
              </div>            )}
          </div>          {activeFile && (
            <button onClick={() => setShowTools(!showTools)} className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-bold transition-colors border shadow-sm ${showTools ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
              <Sparkles size={14} /> {showTools ? "Close Tools" : "Open Tools"}
            </button>
          )}
        </header>

        <div className="flex-1 flex overflow-hidden p-3 gap-3">
          {!activeFileId ? (
            /* ─── Empty State ─── */
            <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-sm" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
              <div className={`max-w-md w-full flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all cursor-pointer mb-6 ${isDragging ? "border-emerald-400 bg-emerald-50" : "border-slate-300 hover:border-emerald-300 hover:bg-emerald-50/30"}`} onClick={() => fileInputRef.current?.click()}>
                {isUploading ? (
                  <><Loader2 size={32} className="text-emerald-500 mb-4 animate-spin" /><h3 className="text-base font-bold text-slate-900 mb-1">Processing dataset...</h3><p className="text-xs text-slate-500 font-medium">Parsing and saving securely</p></>
                ) : (
                  <><div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-4"><Upload size={20} className="text-slate-600" /></div><h3 className="text-base font-bold text-slate-900 mb-1">Upload a dataset</h3><p className="text-xs text-slate-500 font-medium text-center mb-3">Drag and drop CSV or Excel file</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide border px-2 py-1 rounded bg-slate-50">Up to 50MB</p></>
                )}
              </div>              <div className="max-w-md w-full bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><LinkIcon size={14}/> Import from Google Sheets</h4>
                <p className="text-xs text-slate-500 font-medium mb-4">Make your sheet &quot;Anyone with the link can view&quot; and paste the URL here.</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} className="flex-1 bg-white border border-slate-300 rounded-md px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none shadow-sm" disabled={isImporting} />
                  <button onClick={handleImportFromUrl} disabled={isImporting || !sheetUrl.trim()} className="px-4 h-10 flex items-center justify-center bg-slate-800 text-white rounded-md font-semibold text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm shrink-0">
                    {isImporting ? <Loader2 size={16} className="animate-spin" /> : "Import"}
                  </button>
                </div>              </div>            </div>          ) : (
            /* ─── Active State: Data Grid + Tools ─── */
            <PanelGroup orientation="horizontal" className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              <Panel defaultSize={showTools ? 60 : 100} minSize={30} className="flex flex-col bg-white">
                {/* ═══ Spreadsheet Toolbar ═══ */}
                <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-b border-slate-200 shrink-0 flex-wrap">
                  {/* Row/Col operations */}
                  <div className="flex items-center gap-0.5 mr-1">
                    <button onClick={handleAddRow} title="Add Row" className="p-1.5 hover:bg-emerald-50 rounded text-slate-500 hover:text-emerald-700 transition-colors"><Plus size={14} /></button>
                    <button onClick={handleDeleteRow} title="Delete Row" disabled={!selectedCell} className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors disabled:opacity-30"><Minus size={14} /></button>
                  </div>                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <div className="flex items-center gap-0.5 mr-1">
                    <button onClick={handleAddColumn} title="Add Column" className="p-1.5 hover:bg-emerald-50 rounded text-slate-500 hover:text-emerald-700 transition-colors flex items-center gap-0.5"><Plus size={12} /><span className="text-[10px] font-bold">COL</span></button>
                    <button onClick={handleDeleteColumn} title="Delete Column" disabled={!selectedCell} className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors disabled:opacity-30 flex items-center gap-0.5"><Minus size={12} /><span className="text-[10px] font-bold">COL</span></button>
                  </div>                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  {/* Undo / Redo */}
                  <button onClick={handleUndo} title="Undo (⌘Z)" disabled={undoStack.length === 0} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-30"><Undo2 size={14} /></button>
                  <button onClick={handleRedo} title="Redo (⌘⇧Z)" disabled={redoStack.length === 0} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-30"><Redo2 size={14} /></button>
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  {/* Search */}
                  <button onClick={() => setShowSearch(!showSearch)} title="Search & Replace" className={`p-1.5 rounded transition-colors ${showSearch ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}><Search size={14} /></button>
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  {/* Export */}
                  <button onClick={() => handleExport("csv")} title="Export CSV" className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"><Download size={14} /><span className="text-[10px] font-bold">.CSV</span></button>
                  <button onClick={() => handleExport("xlsx")} title="Export XLSX" className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"><Download size={14} /><span className="text-[10px] font-bold">.XLSX</span></button>
                  
                  {/* Status */}
                  <div className="flex-1" />
                  {selectedCell && <span className="text-[10px] font-semibold text-slate-400 mr-2">R{selectedCell.row + 1}:C{selectedCell.col + 1}</span>}
                </div>
                {/* ═══ Search & Replace Bar ═══ */}
                {showSearch && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input type="text" placeholder="Find..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-32 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                    <input type="text" placeholder="Replace..." value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} className="w-32 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none" />
                    <button onClick={() => handleSearchReplace(false)} disabled={!searchTerm} className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">Replace</button>
                    <button onClick={() => handleSearchReplace(true)} disabled={!searchTerm} className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">Replace All</button>
                    {searchTerm && <span className="text-[10px] font-semibold text-slate-500">{searchMatchCount} found</span>}
                    <button onClick={() => { setShowSearch(false); setSearchTerm(""); setReplaceTerm(""); }} className="p-1 hover:bg-slate-200 rounded text-slate-400"><X size={12} /></button>
                  </div>                )}

                {/* ═══ Editable Data Grid ═══ */}
                <div
                  ref={gridRef}
                  className="flex-1 overflow-auto focus:outline-none"
                  tabIndex={0}
                  onKeyDown={handleGridKeyDown}
                  onClick={(e) => {
                    // Deselect when clicking empty space
                    if (e.target === gridRef.current) { setSelectedCell(null); setEditingCell(null); }
                  }}
                >
                  {editHeaders.length > 0 ? (
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <tr>
                          <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 w-12 text-center">#</th>
                          {editHeaders.map((h, i) => (
                            <th
                              key={i}
                              className="px-0 py-0 border-r border-slate-200 min-w-[120px] group cursor-pointer"
                              onClick={() => handleSort(i)}
                              onDoubleClick={(e) => { e.stopPropagation(); setCellDraft(h); setEditingHeader(i); }}
                            >
                              {editingHeader === i ? (
                                <input
                                  ref={headerInputRef}
                                  value={cellDraft}
                                  onChange={(e) => setCellDraft(e.target.value)}
                                  onBlur={commitHeaderEdit}
                                  onKeyDown={(e) => { if (e.key === "Enter") commitHeaderEdit(); if (e.key === "Escape") setEditingHeader(null); }}
                                  className="w-full px-3 py-2 text-[11px] font-bold text-slate-800 bg-white outline-none border-2 border-emerald-500 rounded-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-[11px] font-bold text-slate-700 truncate">{h}</span>
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                                    {sortCol === i ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                                  </span>
                                </div>                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayRows.map((row, rowIdx) => (
                          <tr key={rowIdx} className={`transition-colors ${selectedCell?.row === rowIdx ? "bg-emerald-50/30" : "hover:bg-slate-50/80"}`}>
                            <td className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-r border-slate-100 text-center bg-slate-50/50 select-none">{rowIdx + 1}</td>
                            {row.map((cell, colIdx) => {
                              const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                              const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx;
                              const isSearchMatch = searchTerm && cell.includes(searchTerm);
                              return (
                                <td
                                  key={colIdx}
                                  className={`px-0 py-0 border-r border-slate-50 min-w-[120px] max-w-[250px] cursor-cell ${isSelected ? "ring-2 ring-emerald-500 ring-inset bg-emerald-50/50" : ""} ${isSearchMatch ? "bg-yellow-100" : ""}`}
                                  onClick={() => { setSelectedCell({ row: rowIdx, col: colIdx }); if (editingCell && !(editingCell.row === rowIdx && editingCell.col === colIdx)) commitCellEdit(); }}
                                  onDoubleClick={() => { setCellDraft(cell); setEditingCell({ row: rowIdx, col: colIdx }); }}
                                >
                                  {isEditing ? (
                                    <input
                                      ref={cellInputRef}
                                      value={cellDraft}
                                      onChange={(e) => setCellDraft(e.target.value)}
                                      onBlur={commitCellEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") { commitCellEdit(); setSelectedCell({ row: rowIdx + 1 < editRows.length ? rowIdx + 1 : rowIdx, col: colIdx }); }
                                        if (e.key === "Escape") { setEditingCell(null); }
                                        if (e.key === "Tab") { e.preventDefault(); commitCellEdit(); const nextCol = e.shiftKey ? Math.max(0, colIdx - 1) : Math.min(editHeaders.length - 1, colIdx + 1); setSelectedCell({ row: rowIdx, col: nextCol }); }
                                      }}
                                      className="w-full h-full px-3 py-1.5 text-xs text-slate-800 font-medium bg-white outline-none border-2 border-emerald-500 rounded-sm"
                                    />
                                  ) : (
                                    <div className="px-3 py-1.5 text-xs text-slate-700 font-medium truncate">{cell}</div>                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-8 h-full"><Loader2 size={24} className="text-slate-400 animate-spin" /></div>                  )}
                </div>              </Panel>

              {showTools && (
                <>
                  <PanelResizeHandle className="w-1.5 bg-slate-100 hover:bg-emerald-400 active:bg-emerald-600 transition-colors cursor-col-resize flex flex-col items-center justify-center border-l border-r border-slate-200">
                    <GripVertical size={12} className="text-slate-400" />
                  </PanelResizeHandle>
                  <Panel defaultSize={40} minSize={25} className="flex flex-col bg-slate-50">
                    {/* Tool Tabs */}
                    <div className="flex items-center p-2 gap-1 border-b border-slate-200 bg-white shrink-0">
                      <button onClick={() => setActiveTab("chat")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === "chat" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}><Sparkles size={14} /> Copilot</button>
                      <button onClick={() => setActiveTab("formula")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === "formula" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}><FunctionSquare size={14} /> Formulas</button>
                      <button onClick={() => setActiveTab("actions")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${activeTab === "actions" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}><Zap size={14} /> Actions</button>
                    </div>
                    {/* Chat Tab */}
                    {activeTab === "chat" && (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4">
                          {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                              <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3 shadow-sm"><Sparkles size={24} className="text-emerald-600" /></div>                              <h3 className="text-sm font-bold text-slate-800 mb-1">AI Data Copilot</h3>
                              <p className="text-xs text-slate-500 font-medium max-w-[220px]">Ask questions, generate charts, or extract insights from your dataset.</p>
                            </div>                          ) : (
                            <>
                              {messages.map((msg) => <ChatMessage key={msg.id} role={msg.role} content={msg.content} onApply={handleApplyAction} editHeaders={editHeaders} editRows={editRows} />)}
                              {isLoading && (
                                <div className="flex gap-3 mb-4">
                                  <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm"><Sparkles size={12} /></div>                                  <div className="flex items-center gap-1 h-6">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>                                  </div>                                </div>                              )}
                              <div ref={chatEndRef} />
                            </>
                          )}
                        </div>                        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                          <div className="relative border border-slate-300 rounded-md bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all shadow-sm">
                            <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} className="w-full bg-transparent text-sm font-medium p-3 pr-12 resize-none outline-none h-12 placeholder:text-slate-400" placeholder="Ask a question..." disabled={isLoading} />
                            <button onClick={handleSendMessage} disabled={isLoading || !inputMessage.trim()} className="absolute right-1.5 bottom-1.5 w-8 h-8 rounded bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            </button>
                          </div>                        </div>                      </div>                    )}

                    {/* Formula Tab */}
                    {activeTab === "formula" && (
                      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><FunctionSquare size={16} className="text-emerald-600"/> Formula Generator</h3>
                          <p className="text-xs text-slate-500 font-medium">Describe what you want to calculate, and the AI will write the exact formula.</p>
                        </div>                        <div className="space-y-4 flex-1">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Requirement</label>
                            <textarea value={formulaInput} onChange={(e) => setFormulaInput(e.target.value)} className="w-full border border-slate-300 rounded-md p-3 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-24 shadow-sm placeholder:text-slate-400" placeholder="e.g. Sum column B if column A is 'Active'" disabled={isLoading} />
                          </div>                          <button onClick={handleGenerateFormula} disabled={isLoading || !formulaInput.trim()} className="w-full flex items-center justify-center gap-2 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-md font-semibold text-sm transition-colors shadow-sm disabled:opacity-50">
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate Formula
                          </button>
                          {formulaResult && (
                            <div className="mt-6 border-t border-slate-200 pt-6">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2 block">Result</label>
                              <div className="bg-white border border-slate-200 rounded-md p-4 shadow-sm text-sm"><ChatMessage role="assistant" content={formulaResult} onApply={handleApplyAction} editHeaders={editHeaders} editRows={editRows} /></div>                            </div>                          )}
                        </div>                      </div>                    )}

                    {/* Actions Tab */}
                    {activeTab === "actions" && (
                      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                        <div className="mb-6">
                          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><Zap size={16} className="text-emerald-600"/> Quick Actions</h3>
                          <p className="text-xs text-slate-500 font-medium">One-click AI macros to analyze and clean your data.</p>
                        </div>                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { label: "Find Anomalies", desc: "Detect duplicates and outliers", icon: "🔍", action: "Find Data Anomalies and Duplicates" },
                            { label: "Standardize Formats", desc: "Clean up dates and capitalization", icon: "✨", action: "Standardize formatting for dates and text" },
                            { label: "Extract Entities", desc: "Pull emails, names, or URLs", icon: "✂️", action: "Extract Names and Emails into separate columns" },
                            { label: "Executive Summary", desc: "Get a high-level text summary", icon: "📊", action: "Generate an executive summary report of this data" },
                          ].map((item) => (
                            <button key={item.label} onClick={() => runQuickAction(item.action)} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-md hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group shadow-sm">
                              <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 group-hover:bg-white group-hover:border-emerald-200 flex items-center justify-center transition-colors shrink-0">{item.icon}</div>                              <div>
                                <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-800 transition-colors">{item.label}</div>                                <div className="text-[11px] font-medium text-slate-500">{item.desc}</div>                              </div>                            </button>
                          ))}
                        </div>                      </div>                    )}
                  </Panel>
                </>
              )}
            </PanelGroup>
          )}
        </div>      </div>

      {/* ─── Pricing Modal ─── */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900">Choose Your Plan</h2>
                <p className="text-sm text-slate-500 font-medium">Upgrade your workspace for higher limits and features.</p>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Plan */}
                <div className="border-2 border-slate-200 hover:border-emerald-500/50 rounded-xl p-6 transition-colors flex flex-col relative bg-slate-50 hover:bg-emerald-50/10">
                  <h3 className="text-lg font-black text-slate-900 mb-1">Basic</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-slate-900">$9</span>
                    <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-6 flex-1">
                    <li className="flex items-start gap-2 text-sm text-slate-600 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">1,000 AI operations</span></li>
                    <li className="flex items-start gap-2 text-sm text-slate-600 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">Up to 25MB file uploads</span></li>
                    <li className="flex items-start gap-2 text-sm text-slate-600 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">Export to CSV/Excel</span></li>
                  </ul>
                  <button 
                    onClick={() => handleCheckout("basic")} 
                    disabled={isCheckingOut !== null}
                    className="w-full h-11 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-800 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCheckingOut === "basic" ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Select Basic"}
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="border-2 border-emerald-500 rounded-xl p-6 relative flex flex-col bg-slate-900 shadow-xl shadow-emerald-900/10 hover:-translate-y-1 transition-transform">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[40px] pointer-events-none"></div>
                  <span className="absolute -top-3 right-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Popular</span>
                  
                  <h3 className="text-lg font-black text-white mb-1 relative z-10">Pro</h3>
                  <div className="flex items-baseline gap-1 mb-4 relative z-10">
                    <span className="text-3xl font-black text-white">$19</span>
                    <span className="text-emerald-500 font-bold text-xs uppercase tracking-widest">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-6 flex-1 relative z-10">
                    <li className="flex items-start gap-2 text-sm text-slate-300 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">Unlimited AI operations</span></li>
                    <li className="flex items-start gap-2 text-sm text-slate-300 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">Up to 500MB file uploads</span></li>
                    <li className="flex items-start gap-2 text-sm text-slate-300 font-semibold"><CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> <span className="flex-1 break-words leading-tight">Gemini 1.5 Pro Model</span></li>
                  </ul>
                  <button 
                    onClick={() => handleCheckout("pro")} 
                    disabled={isCheckingOut !== null}
                    className="relative z-10 w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCheckingOut === "pro" ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : "Upgrade to Pro"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
