"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Sparkles, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

interface ContentBlock {
  type: "text" | "formula" | "chart";
  content: string;
}

function parseContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(formula|chart)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) {
        blocks.push({ type: "text", content: textBefore });
      }
    }

    blocks.push({
      type: match[1] as "formula" | "chart",
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
      blocks.push({ type: "text", content: remaining });
    }
  }

  // If no blocks were found, treat the whole content as text
  if (blocks.length === 0) {
    blocks.push({ type: "text", content });
  }

  return blocks;
}

function renderMarkdownLine(line: string): React.ReactNode {
  // Bold
  let result = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-emerald-700">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag
          key={`list-${elements.length}`}
          className={cn(
            "my-2 space-y-1 pl-5",
            listType === "ul" ? "list-disc" : "list-decimal"
          )}
        >
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {renderMarkdownLine(item)}
            </li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const headerClasses = [
        "text-base font-semibold text-slate-800 mt-3 mb-1",
        "text-sm font-semibold text-slate-700 mt-2 mb-1",
        "text-sm font-medium text-slate-600 mt-2 mb-1",
      ];
      elements.push(
        <p key={i} className={headerClasses[level - 1]}>
          {renderMarkdownLine(headerMatch[2])}
        </p>
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(olMatch[1]);
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed">
        {renderMarkdownLine(line)}
      </p>
    );
  }

  flushList();
  return elements;
}

function CopyableCodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-emerald-200/60 bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">{label}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-600 transition-all duration-200 hover:bg-emerald-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-sm text-slate-800">{code}</code>
      </pre>
    </div>
  );
}

function ChartPlaceholder({ config }: { config: string }) {
  return (
    <div className="my-3 flex flex-col items-center justify-center rounded-xl border border-teal-200/60 bg-gradient-to-b from-teal-50/50 to-white p-6">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-sm">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <p className="text-sm font-medium text-teal-800">Chart Generated</p>
      <p className="mt-1 text-xs text-teal-600">
        Rendering visualization...
      </p>
      {/* Hidden config for chart-renderer to pick up */}
      <div data-chart-config={config} className="hidden" />
    </div>
  );
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const blocks = useMemo(() => parseContent(content), [content]);
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-md"
            : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/60"
        )}
      >
        {blocks.map((block, index) => {
          if (block.type === "formula") {
            return (
              <CopyableCodeBlock
                key={index}
                code={block.content}
                label="Formula"
              />
            );
          }

          if (block.type === "chart") {
            return <ChartPlaceholder key={index} config={block.content} />;
          }

          return (
            <div
              key={index}
              className={cn(
                "space-y-1.5",
                isUser ? "[&_strong]:text-emerald-300 [&_code]:bg-slate-700 [&_code]:text-emerald-300" : ""
              )}
            >
              {renderMarkdown(block.content)}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
