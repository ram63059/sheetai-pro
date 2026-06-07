"use client";

import { ArrowRight, BarChart3, CheckCircle2, Database, FileSpreadsheet, FileText, Sparkles, Zap, Search, Download, Settings, ChevronDown, Filter, Bot, Network, Wand2 } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacityParallax = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scaleParallax = useTransform(scrollYProgress, [0, 1], [1, 0.95]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const router = useRouter();
  const supabase = createClient();

  const handleCheckout = async (planId: "basic" | "pro") => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast("Please log in or sign up first to purchase a plan.");
        router.push("/signup");
        return;
      }

      toast.loading(`Initializing checkout for ${planId} plan...`, { id: "checkout" });
      
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        throw new Error("Failed to initialize checkout.");
      }

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
            router.push("/dashboard");
          } else {
            toast.error("Payment verification failed.", { id: "checkout" });
          }
        },
        prefill: {
          email: session.user.email,
        },
        theme: {
          color: "#10B981",
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: { error: { description: string } }) {
        toast.error(`Payment failed: ${response.error.description}`, { id: "checkout" });
      });
      
      toast.dismiss("checkout");
      rzp.open();
    } catch (error: unknown) {
      toast.error((error as Error).message, { id: "checkout" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("mousemove", handleMouseMove);

    // Initial position
    setMousePosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);
  // Removed Variants

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 font-sans selection:bg-emerald-200">
      
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Interactive Mouse Tracking Glow */}
        <motion.div 
          animate={{ 
            x: mousePosition.x - 150,
            y: mousePosition.y - 150
          }}
          transition={{ type: "tween", duration: 0 }}
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0) 70%)' }}
          className="absolute top-0 left-0 w-[300px] h-[300px] rounded-full will-change-transform pointer-events-none"
        />

        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-100/50 via-teal-50/20 to-transparent blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />
      </div>

      {/* Navigation */}
      <header 
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b ${
          scrolled ? "bg-white/80 backdrop-blur-2xl border-slate-200/50 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)]" : "bg-transparent border-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 lg:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20 overflow-hidden"
            >
              <FileSpreadsheet size={18} className="text-white relative z-10" strokeWidth={2.5} />
            </motion.div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">SheetAI</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-10 text-[15px] font-bold text-slate-500">
            <Link href="#platform" className="hover:text-slate-900 transition-colors relative group">
              Platform
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="#workflow" className="hover:text-slate-900 transition-colors relative group">
              How it Works
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="#pricing" className="hover:text-slate-900 transition-colors relative group">
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all duration-300 group-hover:w-full"></span>
            </Link>
          </nav>
          
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-[15px] font-bold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="relative overflow-hidden group flex items-center justify-center px-6 py-2.5 text-[15px] font-bold text-white bg-slate-900 rounded-full shadow-lg hover:shadow-xl transition-all duration-500 hover:-translate-y-0.5"
            >
              <div className="absolute inset-0 bg-emerald-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative z-10">Get Started</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-28 pb-24">
        {/* Powerful Hook Hero Section with Abstract Orbital Animations */}
        <section ref={heroRef} className="px-4 lg:px-8 flex flex-col items-center justify-center pb-20 text-center max-w-6xl mx-auto relative">
          
          {/* Floating UI Elements Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
            
            {/* Floating Formula Card */}
            <motion.div 
              animate={{ 
                y: [0, -20, 0],
                rotate: [-2, 2, -2]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[15%] left-[10%] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/60 hidden md:block"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              </div>
              <div className="font-mono text-sm font-bold">
                <span className="text-emerald-600">=VLOOKUP</span>
                <span className="text-slate-700">(A2, Data!A:E, 3, FALSE)</span>
              </div>
            </motion.div>

            {/* Floating Mini Chart */}
            <motion.div 
              animate={{ 
                y: [0, 25, 0],
                rotate: [2, -1, 2]
              }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute top-[25%] right-[10%] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/60 hidden md:block w-48"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500">Revenue</span>
                <BarChart3 size={14} className="text-emerald-500" />
              </div>
              <div className="flex items-end gap-1.5 h-16">
                <div className="w-full bg-emerald-100 rounded-t-sm h-[40%]"></div>
                <div className="w-full bg-emerald-200 rounded-t-sm h-[60%]"></div>
                <div className="w-full bg-emerald-400 rounded-t-sm h-[90%]"></div>
                <div className="w-full bg-teal-500 rounded-t-sm h-[100%]"></div>
                <div className="w-full bg-emerald-300 rounded-t-sm h-[70%]"></div>
              </div>
            </motion.div>

            {/* Floating Data Row */}
            <motion.div 
              animate={{ 
                y: [0, -15, 0],
                x: [0, -10, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute bottom-[20%] left-[15%] bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200/60 hidden lg:flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Database size={14} />
              </div>
              <div>
                <div className="h-2 w-24 bg-slate-200 rounded-full mb-2"></div>
                <div className="h-2 w-16 bg-slate-100 rounded-full"></div>
              </div>
              <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100">
                Cleaned
              </div>
            </motion.div>

            {/* Large Subtle Background Gradients */}
            <motion.div 
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-100/50 via-teal-50/20 to-transparent blur-[100px]" 
            />
          </div>

          <motion.div 
            style={{ y: yParallax, opacity: opacityParallax, scale: scaleParallax }}
            className="flex flex-col items-center w-full relative z-10 bg-white/40 backdrop-blur-[2px] p-8 rounded-[3rem]"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 shadow-sm text-slate-700 text-base font-bold mb-10 overflow-hidden relative group cursor-pointer"
            >
              <motion.div 
                animate={{ x: ["-100%", "200%"] }} 
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-100/50 to-transparent skew-x-12"
              ></motion.div>
              <Sparkles size={16} className="text-emerald-500" />
              <span>The world&apos;s most advanced data AI</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
              className="text-6xl md:text-[5.5rem] lg:text-[7rem] font-black tracking-tighter text-slate-900 mb-8 leading-[1.05]"
            >
              Automate spreadsheets. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600">Chat with your data.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="text-lg md:text-xl text-slate-600 mb-12 max-w-3xl leading-relaxed font-medium"
            >
              Never write a complex formula again. Upload your CSVs and instruct our AI to filter rows, build charts, and execute actions instantly using natural language.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center gap-4 mb-14"
            >
              <Link 
                href="/signup" 
                className="group flex items-center justify-center gap-2 h-16 px-10 bg-emerald-600 text-white rounded-full font-bold text-lg hover:bg-emerald-500 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
              >
                Get Started <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <span className="text-slate-400 font-medium text-sm mt-4 sm:mt-0 sm:ml-4 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500"/> Instant access. Cancel anytime.
              </span>
            </motion.div>

            {/* Feature Pills */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
              className="flex flex-wrap justify-center gap-3 max-w-4xl"
            >
              {[
                { icon: <Zap size={14} className="text-amber-500" />, text: "Generates Formulas" },
                { icon: <Filter size={14} className="text-indigo-500" />, text: "Non-Destructive Actions" },
                { icon: <BarChart3 size={14} className="text-blue-500" />, text: "Smart Charts" },
                { icon: <Network size={14} className="text-emerald-500" />, text: "Multi-Model AI Backend" },
                { icon: <FileSpreadsheet size={14} className="text-green-600" />, text: "CSV & Excel Uploads" }
              ].map((pill, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-full text-sm font-bold text-slate-700 shadow-sm">
                  {pill.icon}
                  <span>{pill.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
          
          {/* Soft, Professional Digital Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-40 w-full relative z-20"
          >
            <div className="absolute -inset-10 bg-gradient-to-b from-slate-200/40 to-transparent rounded-[4rem] blur-3xl opacity-50"></div>
            
            <div className="relative rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col h-[750px] ring-1 ring-slate-900/5 text-left text-sm group">
              
              {/* App Header */}
              <div className="h-14 border-b border-slate-100 flex items-center px-6 bg-slate-50/80 justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex gap-2.5 group-hover:opacity-100 opacity-70 transition-opacity">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FF5F56] border border-black/5 hover:bg-[#ff4a3f] transition-colors cursor-pointer"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-[#FFBD2E] border border-black/5 hover:bg-[#ffb00e] transition-colors cursor-pointer"></div>
                    <div className="w-3.5 h-3.5 rounded-full bg-[#27C93F] border border-black/5 hover:bg-[#1db835] transition-colors cursor-pointer"></div>
                  </div>
                  <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
                  <div className="flex items-center gap-2 text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                    <FileText size={16} className="text-emerald-500" />
                    <span className="font-bold text-sm">Q3_Global_Sales.csv</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm cursor-pointer hover:bg-slate-50 hover:text-emerald-600 transition-colors">
                    <Download size={14} />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-sm cursor-pointer hover:bg-emerald-700 transition-colors">
                    S
                  </div>
                </div>
              </div>
              
              {/* Main Interface */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white">
                
                {/* Left Panel: Dense but soft data table */}
                <div className="w-full md:w-[60%] border-r border-slate-100 flex flex-col relative z-10 bg-white">
                  
                  {/* Table Toolbar */}
                  <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Search records..." className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-56 transition-all font-medium" />
                      </div>
                      <button className="flex items-center gap-2 h-9 px-4 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <Filter size={14} /> Filter
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded">
                        10 of 2,491 rows (filtered)
                      </div>
                      <button className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded bg-slate-100 transition-colors">
                        Clear Filter
                      </button>
                    </div>
                  </div>
                  
                  {/* Table Content */}
                  <div className="flex-1 overflow-auto bg-white p-4">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-5 py-3 text-xs font-extrabold text-slate-500 uppercase tracking-widest w-10">
                              <input type="checkbox" className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                            </th>
                            <th className="px-5 py-3 text-xs font-extrabold text-slate-500 uppercase tracking-widest">Transaction</th>
                            <th className="px-5 py-3 text-xs font-extrabold text-slate-500 uppercase tracking-widest">Date</th>
                            <th className="px-5 py-3 text-xs font-extrabold text-slate-500 uppercase tracking-widest text-right">Amount</th>
                            <th className="px-5 py-3 text-xs font-extrabold text-slate-500 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { id: "TXN-9821", date: "Oct 24, 2023", amt: "$12,450.00", status: "Completed" },
                            { id: "TXN-9822", date: "Oct 24, 2023", amt: "$4,200.50", status: "Pending" },
                            { id: "TXN-9823", date: "Oct 23, 2023", amt: "$890.00", status: "Completed" },
                            { id: "TXN-9824", date: "Oct 23, 2023", amt: "$34,200.00", status: "Completed" },
                            { id: "TXN-9825", date: "Oct 22, 2023", amt: "$1,250.00", status: "Failed" },
                            { id: "TXN-9826", date: "Oct 22, 2023", amt: "$9,800.00", status: "Completed" },
                            { id: "TXN-9827", date: "Oct 21, 2023", amt: "$45,000.00", status: "Pending" },
                            { id: "TXN-9828", date: "Oct 21, 2023", amt: "$22,100.00", status: "Completed" },
                            { id: "TXN-9829", date: "Oct 20, 2023", amt: "$5,600.00", status: "Completed" },
                            { id: "TXN-9830", date: "Oct 20, 2023", amt: "$11,200.00", status: "Completed" },
                          ].map((row, i) => (
                            <motion.tr 
                              initial={{ opacity: 0, x: -10 }}
                              whileInView={{ opacity: 1, x: 0 }}
                              viewport={{ once: true }}
                              transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                              key={i} 
                              className="hover:bg-emerald-50/30 transition-colors group cursor-default"
                            >
                              <td className="px-5 py-4 text-sm">
                                <input type="checkbox" className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                              </td>
                              <td className="px-5 py-4 text-sm font-bold text-slate-800">{row.id}</td>
                              <td className="px-5 py-4 text-sm font-medium text-slate-500">{row.date}</td>
                              <td className="px-5 py-4 text-sm text-slate-900 font-mono font-bold text-right">{row.amt}</td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold ${
                                  row.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                                  row.status === 'Pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                                  'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Panel: AI Copilot Sidebar */}
                <div className="w-full md:w-[40%] bg-slate-50/50 flex flex-col h-full border-l border-white shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
                  
                  {/* AI Header */}
                  <div className="h-14 border-b border-slate-100 flex items-center px-6 justify-between bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                        <Sparkles size={14} />
                      </div>
                      <span className="font-bold text-base text-slate-900">SheetAI Copilot</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 cursor-pointer">
                        <Network size={12} className="text-emerald-500" />
                        Auto Model
                        <ChevronDown size={12} className="text-slate-400" />
                      </div>
                      <Settings size={18} className="text-slate-400 cursor-pointer hover:text-emerald-600 hover:rotate-45 transition-all duration-300" />
                    </div>
                  </div>
                  
                  {/* Chat Area */}
                  <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-8">
                    
                    {/* User Prompt */}
                    <div className="flex flex-col items-end gap-2">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, originX: 1, originY: 1 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1, duration: 0.4 }}
                        className="bg-slate-900 text-white p-5 rounded-2xl rounded-tr-sm text-sm font-medium shadow-lg shadow-slate-900/10 max-w-[90%] leading-relaxed"
                      >
                        Remove any failed transactions, then plot the daily revenue trend for the last two weeks.
                      </motion.div>
                      <motion.span 
                        initial={{ opacity: 0 }} 
                        whileInView={{ opacity: 1 }} 
                        viewport={{ once: true }}
                        transition={{ delay: 1.2 }}
                        className="text-xs font-bold text-slate-400"
                      >
                        Just now
                      </motion.span>
                    </div>

                    {/* AI Response */}
                    <div className="flex flex-col items-start gap-3 w-full">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 1.8 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                          <Sparkles size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-900">SheetAI</span>
                      </motion.div>
                      
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 2, duration: 0.5 }}
                        className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-6 shadow-sm w-full"
                      >
                        <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
                          Data cleaned. Failed rows removed. I generated a chart mapping your completed daily revenue. You had a massive <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">+34% spike</span> on Oct 21st.
                        </p>
                        
                        {/* Soft, beautiful Chart rendering */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 relative overflow-hidden group/chart cursor-pointer hover:border-emerald-300 transition-colors">
                          <div className="flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-slate-800 group-hover/chart:text-emerald-700 transition-colors">Revenue Trend</span>
                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded-md">Last 14 Days</span>
                          </div>
                          
                          <div className="h-32 relative ml-2">
                            {/* Grid lines */}
                            <div className="absolute top-0 w-full border-t border-dashed border-slate-200"></div>
                            <div className="absolute top-1/2 w-full border-t border-dashed border-slate-200"></div>
                            <div className="absolute bottom-0 w-full border-t border-dashed border-slate-200"></div>
                            
                            <svg className="w-full h-full relative z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="softGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              
                              <motion.path 
                                d="M0,80 C10,75 15,85 25,60 C35,35 40,65 50,40 C60,15 65,10 75,30 C85,50 90,45 100,20" 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                                initial={{ pathLength: 0 }}
                                whileInView={{ pathLength: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 2.2, duration: 1.5, ease: "easeOut" }}
                              />
                              
                              <motion.path 
                                d="M0,80 C10,75 15,85 25,60 C35,35 40,65 50,40 C60,15 65,10 75,30 C85,50 90,45 100,20 L100,100 L0,100 Z" 
                                fill="url(#softGradient)" 
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 3.2, duration: 1 }}
                              />
                            </svg>
                            
                            {/* Hover Data Point */}
                            <motion.div 
                              initial={{ opacity: 0, scale: 0 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ delay: 3.5, duration: 0.4, type: "spring" }}
                              className="absolute top-[10%] left-[65%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-emerald-500 rounded-full shadow-lg z-20"
                            >
                              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover/chart:opacity-100 transition-opacity whitespace-nowrap">
                                Oct 21: $45,000
                              </div>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Input Area */}
                  <div className="p-5 bg-white border-t border-slate-100">
                    <div className="relative border border-slate-200 rounded-2xl bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm group">
                      <textarea 
                        className="w-full bg-transparent text-sm font-bold p-4 pr-14 resize-none outline-none h-[60px] placeholder:text-slate-400"
                        placeholder="Ask anything about your data..."
                        readOnly
                      ></textarea>
                      <button className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-all shadow-md shadow-emerald-500/20 group-focus-within:-rotate-12 group-focus-within:scale-110">
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* NEW Crazy Animation Section: How It Works */}
        <section id="workflow" className="py-20 relative z-30">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl font-black text-slate-900 mb-6 tracking-tight"
              >
                The ultimate automation pipeline.
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-xl text-slate-500 font-medium"
              >
                SheetAI completely transforms how you handle raw data, bridging the gap between raw CSVs and executive presentations instantly.
              </motion.p>
            </div>
            
            <div className="relative flex flex-col md:flex-row justify-between items-center gap-10">
              
              {/* Connecting glowing line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 hidden md:block rounded-full">
                <motion.div 
                  initial={{ width: "0%" }}
                  whileInView={{ width: "100%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                />
              </div>

              {/* Step 1 */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="relative z-10 w-full md:w-1/3 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all text-center flex flex-col items-center cursor-default"
              >
                <motion.div 
                  whileHover={{ rotate: -10 }}
                  className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6"
                >
                  <Database className="text-slate-500" size={28} />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">1. Raw Data</h3>
                <p className="text-slate-500 font-medium">Upload thousands of messy, unformatted rows. Excel, CSV, Google Sheets.</p>
              </motion.div>

              {/* Step 2 */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                whileHover={{ scale: 1.05 }}
                className="relative z-10 w-full md:w-1/3 bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl text-center flex flex-col items-center transform md:-translate-y-6 cursor-default"
              >
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 rounded-[2.5rem]"></div>
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-4 border-2 border-dashed border-emerald-500/50 rounded-full"
                  />
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-emerald-500/30 relative z-10">
                    <Wand2 className="text-white" size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 relative z-10">2. AI Copilot</h3>
                <p className="text-slate-400 font-medium relative z-10">Our proprietary models parse your intent, clean the data, and execute complex math.</p>
              </motion.div>

              {/* Step 3 */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.8 }}
                whileHover={{ y: -5 }}
                className="relative z-10 w-full md:w-1/3 bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all text-center flex flex-col items-center cursor-default"
              >
                <motion.div 
                  whileHover={{ rotate: 10 }}
                  className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100"
                >
                  <Network className="text-emerald-600" size={28} />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">3. Final Insights</h3>
                <p className="text-slate-500 font-medium">Instantly receive flawless charts, summarized reports, and perfectly formatted sheets.</p>
              </motion.div>

            </div>

            {/* Additional Features Below Workflow */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-20 pt-10 border-t border-slate-200/60 max-w-4xl mx-auto text-center"
            >
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Works seamlessly with your tools</p>
              <div className="flex flex-wrap justify-center gap-10 opacity-70">
                <div className="flex items-center gap-2 font-bold text-slate-600"><FileSpreadsheet size={20} className="text-emerald-500" /> Google Sheets Integration</div>
                <div className="flex items-center gap-2 font-bold text-slate-600"><Database size={20} className="text-indigo-500" /> Secure Cloud Backup</div>
                <div className="flex items-center gap-2 font-bold text-slate-600"><Download size={20} className="text-blue-500" /> One-Click Export to CSV</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Soft, World-Class Bento Box Features */}
        <section id="platform" className="py-24 relative bg-white border-y border-slate-100">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-20 max-w-3xl mx-auto">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight"
              >
                Superb features. Beautiful interface.
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-xl text-slate-500 leading-relaxed font-medium"
              >
                We engineered an absurdly powerful AI backend and wrapped it in the most beautiful interface on the market.
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
              
              {/* Feature 1 - Large */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:col-span-2 p-12 rounded-[3rem] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all duration-500 flex flex-col justify-between group overflow-hidden relative cursor-default hover:shadow-xl"
              >
                <div className="relative z-10 max-w-md">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center mb-8 shadow-sm"
                  >
                    <Zap size={28} className="text-amber-500" />
                  </motion.div>
                  <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Formula Generation</h3>
                  <p className="text-slate-500 text-lg font-medium leading-relaxed">Describe your logic in plain text and get an instant, perfectly formatted formula ready to paste into your sheet.</p>
                </div>
                
                {/* Floating Code Snippet */}
                <div className="absolute right-0 bottom-0 p-8 opacity-40 group-hover:opacity-100 transition-all duration-500 transform translate-y-8 group-hover:translate-y-0">
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl font-mono text-sm font-bold shadow-xl">
                    <span className="text-emerald-500">=IF(</span><span className="text-slate-600">SUM(A2:A10){">"}100</span><span className="text-emerald-500">,</span> <span className="text-amber-500">&quot;Excellent&quot;</span><span className="text-emerald-500">)</span>
                  </div>
                </div>
              </motion.div>

              {/* Feature 2 */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="p-12 rounded-[3rem] bg-gradient-to-br from-emerald-500 to-teal-600 text-white transition-all duration-500 shadow-xl shadow-emerald-600/20 hover:shadow-2xl hover:shadow-emerald-600/30 relative overflow-hidden flex flex-col justify-between cursor-default group"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"
                ></motion.div>
                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -5 }}
                    className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-8"
                  >
                    <BarChart3 size={28} className="text-white" />
                  </motion.div>
                  <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Smart Charts</h3>
                  <p className="text-emerald-50 text-lg font-medium leading-relaxed">AI suggests and plots the best visualizations instantly.</p>
                </div>
              </motion.div>

              {/* Feature 3 */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="p-12 rounded-[3rem] bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all duration-500 cursor-default hover:shadow-xl"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: -10 }}
                  className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center mb-8 shadow-sm"
                >
                  <Filter size={28} className="text-indigo-500" />
                </motion.div>
                <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Non-Destructive Filters</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed">Filter rows safely using natural language. Preview all changes before applying.</p>
              </motion.div>

              {/* Feature 4 - Large */}
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="md:col-span-2 p-12 rounded-[3rem] bg-slate-900 text-white transition-all duration-500 shadow-2xl relative overflow-hidden flex flex-col justify-center cursor-default group"
              >
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 group-hover:opacity-20 transition-opacity duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row gap-10 items-start md:items-center">
                  <motion.div 
                    whileHover={{ rotateY: 180 }}
                    transition={{ duration: 0.8 }}
                    className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-inner"
                  >
                    <Network size={32} className="text-emerald-400" />
                  </motion.div>
                  <div>
                    <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Smart Fallback Router</h3>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-xl">Never experience downtime. Our custom backend automatically routes your requests across multiple LLM providers (OpenAI, Anthropic, Gemini) if rate limits are hit.</p>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* Explicit Paid Pricing Section */}
        <section id="pricing" className="py-32 relative bg-[#FAFAFA]">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-20">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight"
              >
                Transparent pricing.
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-xl text-slate-500 font-medium max-w-2xl mx-auto"
              >
                No complex tiers. No hidden limits. Just massive value for professionals.
              </motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Basic Tier */}
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="p-12 rounded-[3rem] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col hover:-translate-y-2 transition-transform duration-500"
              >
                <div className="mb-8 border-b border-slate-100 pb-8">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Basic</h3>
                  <p className="text-base text-slate-500 mb-6 font-medium">For professionals optimizing personal workflows.</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-slate-900">$9</span>
                    <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">/ month</span>
                  </div>
                </div>
                
                <ul className="space-y-5 mb-12 flex-1">
                  {[
                    "1,000 AI operations / month",
                    "Up to 25MB file uploads",
                    "Formula generation & cleaning",
                    "Export to CSV/Excel",
                    "Standard email support"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-4 text-base text-slate-600 font-bold">
                      <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button onClick={() => handleCheckout("basic")} className="flex items-center justify-center w-full h-14 bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-2xl font-black text-base transition-colors shadow-sm group">
                  <span className="group-hover:scale-105 transition-transform">Get Started</span>
                </button>
              </motion.div>

              {/* Pro Tier */}
              <motion.div 
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="p-12 rounded-[3rem] bg-slate-900 border border-slate-800 flex flex-col relative shadow-2xl shadow-slate-900/20 hover:-translate-y-2 transition-transform duration-500 overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-colors duration-500"></div>
                
                <div className="mb-8 border-b border-slate-800 pb-8 relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-2xl font-black text-white">Pro</h3>
                    <span className="bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg shadow-emerald-500/20">
                      Uncapped
                    </span>
                  </div>
                  <p className="text-base text-slate-400 mb-6 font-medium">For heavy data engineers and analysts.</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-black text-white">$19</span>
                    <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">/ month</span>
                  </div>
                </div>
                
                <ul className="space-y-5 mb-12 flex-1 relative z-10">
                  {[
                    "Unlimited AI operations",
                    "Up to 500MB file uploads",
                    "Advanced AI charting pipeline",
                    "Gemini 1.5 Pro Model access",
                    "API Access & Webhooks",
                    "Priority 24/7 support"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-4 text-base text-slate-300 font-bold">
                      <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button onClick={() => handleCheckout("pro")} className="relative z-10 flex items-center justify-center w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base transition-colors shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40">
                  <span className="group-hover:scale-105 transition-transform">Upgrade to Pro</span>
                </button>
              </motion.div>
            </div>
          </div>
        </section>

      </main>

      {/* Soft Footer */}
      <footer className="border-t border-slate-200 bg-white py-16">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <FileSpreadsheet size={16} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-slate-900 text-lg tracking-tight">SheetAI</span>
          </div>
          <p className="text-slate-400 font-bold text-sm">© {new Date().getFullYear()} SheetAI, Inc. Engineered for absolute scale.</p>
          <div className="flex gap-8 text-slate-400 text-sm font-bold uppercase tracking-widest">
            <Link href="#" className="hover:text-slate-900 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
