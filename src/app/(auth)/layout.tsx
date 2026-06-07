import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="font-[family-name:var(--font-dm)] min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Subtle background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 overflow-hidden rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/60 shadow-2xl shadow-emerald-950/20">
          {/* Left Panel — Branding & Testimonial */}
          <div className="hidden lg:flex flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 relative overflow-hidden">
            {/* Decorative shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/3 -translate-x-1/3" />
            <div className="absolute top-1/2 right-10 w-20 h-20 rounded-2xl bg-white/5 rotate-12" />

            {/* Logo & Brand */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <path d="M3 3h18v18H3z" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                    <path d="M9 3v18" />
                    <path d="M15 3v18" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-white tracking-tight">
                  SheetAI Pro
                </span>
              </div>
              <p className="text-emerald-100/70 text-sm mt-4 max-w-xs leading-relaxed">
                Transform your spreadsheets with the power of AI. Automate, analyze, and accelerate your workflow.
              </p>
            </div>

            {/* Testimonial */}
            <div className="relative mt-auto pt-10">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-white/30 mb-3"
                >
                  <path d="M11.3 2.6c-.2-.4-.7-.5-1.1-.3C5.4 5 2.4 9.3 2.4 14c0 3.5 2.3 6 5.3 6 2.7 0 4.8-2.2 4.8-4.8 0-2.7-2.1-4.8-4.8-4.8-.5 0-1 .1-1.4.2C7 7.6 9 5.3 11.6 3.7c.4-.2.5-.7.3-1.1h-.6zm10.3 0c-.2-.4-.7-.5-1.1-.3C15.7 5 12.7 9.3 12.7 14c0 3.5 2.3 6 5.3 6 2.7 0 4.8-2.2 4.8-4.8 0-2.7-2.1-4.8-4.8-4.8-.5 0-1 .1-1.4.2.7-2.8 2.7-5.1 5.3-6.7.4-.2.5-.7.3-1.1h-.6z" />
                </svg>
                <p className="text-white/90 text-sm leading-relaxed">
                  SheetAI Pro has completely transformed how our team handles data. What used to take hours now happens in seconds. It&apos;s like having a data scientist built into every spreadsheet.
                </p>
                <div className="flex items-center gap-3 mt-5">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-semibold">
                    SK
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Sarah Kim</p>
                    <p className="text-emerald-200/60 text-xs">
                      Head of Analytics, Vercel
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-4 mt-6 text-emerald-200/50 text-xs">
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  SOC 2 Compliant
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  End-to-end Encrypted
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel — Auth Form */}
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 xl:p-12">
            {/* Mobile logo (hidden on desktop) */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <path d="M3 3h18v18H3z" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                SheetAI Pro
              </span>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
