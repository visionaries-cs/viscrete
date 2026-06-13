"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  SlidersHorizontal,
  ScanSearch,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  Cpu,
  Download,
  FolderOpen,
  Lightbulb,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    icon: Upload,
    title: "Upload Your Files",
    color: "blue",
    summary: "Create a job and upload concrete images for inspection.",
    details: [
      {
        heading: "Start a new inspection",
        body: 'Click "Start Inspection" on the home page or navigate to /upload. A unique job ID is automatically assigned to track your session.',
      },
      {
        heading: "Accepted file types",
        body: "Images: JPG, JPEG, PNG, BMP, TIFF. You can upload multiple images at once.",
      },
      {
        heading: "Quality check",
        body: "VISCRETE runs an automatic blur check (Laplacian variance) on every file. Blurry or out-of-focus files are flagged as invalid — they will not be processed but the rest of your upload continues.",
      },
      {
        heading: "GPS metadata",
        body: "If your images have GPS EXIF data, it is extracted automatically. If not, you can manually assign coordinates using the location patch tool before proceeding.",
      },
    ],
    tips: [
      { text: "Use sharp, well-lit photos taken within 1–3 m of the surface for best results." },
      { text: "Avoid extreme glare or reflections — these reduce detection accuracy." },
    ],
  },
  {
    num: "02",
    icon: SlidersHorizontal,
    title: "Preprocessing",
    color: "emerald",
    summary: "MOCS-optimized CLAHE contrast enhancement prepares your files for accurate detection.",
    details: [
      {
        heading: "What happens here",
        body: "The preprocessing pipeline enhances image contrast using CLAHE (Contrast-Limited Adaptive Histogram Equalization). Parameters are automatically tuned per image cluster using Multi-Objective Cat Swarm Optimization (MOCS).",
      },
      {
        heading: "Image pipeline (4 steps)",
        body: "Feature Extraction → Cluster Assignment (K=3) → MOCS Optimization (finds optimal CLAHE parameters) → CLAHE Enhancement. Each cluster gets its own tuned parameters for precise enhancement.",
      },
      {
        heading: "Live progress",
        body: "A real-time pipeline stepper and terminal log stream progress as each step completes. You can watch individual step durations and see detailed output.",
      },
      {
        heading: "Before / After comparison",
        body: "Once complete, toggle between the original and processed versions of each image to see the contrast improvement. The CII (Contrast Improvement Index) score is shown per image.",
      },
    ],
    tips: [
      { text: "You do not need to adjust any settings — MOCS finds the optimal parameters automatically." },
      { text: "Processing time scales with file count and image resolution. Large batches may take a few minutes." },
    ],
  },
  {
    num: "03",
    icon: ScanSearch,
    title: "Defect Detection",
    color: "orange",
    summary: "YOLOv11 scans every image or frame and identifies concrete defects with bounding boxes.",
    details: [
      {
        heading: "What VISCRETE detects",
        body: "Four defect classes: Crack, Spalling, Peeling, and Algae. Each detection includes a class label and a confidence score (0–100%).",
      },
      {
        heading: "Annotated image viewer",
        body: "Use the interactive viewer to browse all annotated images. Toggle bounding boxes, class labels, and color overlays on/off. Use the class filter pills to isolate specific defect types.",
      },
      {
        heading: "Defect summary table",
        body: "A paginated table lists every detection across all files — including which image it appears in, the defect type, and confidence score. Click any row to jump directly to that image and highlight the defect.",
      },
      {
        heading: "Stat cards",
        body: "The right sidebar shows per-class counts (Total, Crack, Spalling, Peeling, Algae) so you can see the defect breakdown at a glance.",
      },
    ],
    tips: [
      { text: "Higher confidence scores (> 70%) indicate more certain detections." },
      { text: "Use the class toggle pills to focus on one defect type at a time." },
      { text: "Click a row in the Defect Summary table to jump to and highlight that exact detection on the image." },
    ],
  },
  {
    num: "04",
    icon: FileText,
    title: "Generate Report",
    color: "purple",
    summary: "Export a structured PDF inspection report or a CSV spreadsheet of all detections.",
    details: [
      {
        heading: "Generate the PDF report",
        body: 'Click "Generate Report" from the detection results page. The report includes: job metadata, annotated image snapshots, a defect summary table, GPS coordinate listing, and a total defect count.',
      },
      {
        heading: "Download or view the PDF",
        body: 'Once generated, use "Download PDF Report" to save it locally, or "View PDF Report" to open the structured report page in the browser.',
      },
      {
        heading: "Export as CSV",
        body: 'Use "More Export Options → Generate CSV Report" to download all detection data as a spreadsheet — useful for further analysis in Excel or other tools.',
      },
      {
        heading: "Regenerate",
        body: "If you need to refresh the report (e.g., after reviewing results), click the refresh icon next to the Download button to regenerate it.",
      },
      {
        heading: "Resume a previous job",
        body: 'All jobs are saved automatically. Return to the home page and click "Previous Jobs" to resume any past inspection from exactly where you left off.',
      },
    ],
    tips: [
      { text: "Generate the report only after you are satisfied with the detection results." },
      { text: "The CSV export is ideal for integrating VISCRETE data into maintenance management systems." },
      { text: "Completed jobs are accessible from the Previous Jobs list at any time — they never expire." },
    ],
  },
];

const fileRequirements = [
  { label: "Images", icon: ImageIcon, items: ["JPG / JPEG / PNG / BMP / TIFF", "Minimum 480 × 480 px recommended", "Multiple files supported per job", "Clear, in-focus shots within 1–3 m of surface"] },
];

const faqs = [
  {
    q: "How many images can I upload at once?",
    a: "There is no hard cap on file count, but very large batches will increase preprocessing and detection time. For best performance, batches of 20–50 images are recommended.",
  },
  {
    q: "My file was marked invalid. What does that mean?",
    a: "A file is marked invalid when it fails the blur check — its Laplacian variance score was below the threshold (20.0), indicating the image is too blurry or out of focus for reliable detection. Other valid files in the same upload are still processed.",
  },
  {
    q: "Can I reuse a job if I want to rerun detection?",
    a: "Yes. Navigate back to the job via Previous Jobs. Jobs at any pipeline stage can be resumed. If the job is already at the detected stage, detection results are loaded from the cache without re-running inference.",
  },
  {
    q: "Does VISCRETE work on indoor concrete surfaces?",
    a: "Yes. The model was trained on a variety of concrete surfaces. Indoor shots work as long as lighting is adequate and the surface fills most of the frame.",
  },
  {
    q: "What do the defect classes mean?",
    a: "Crack: linear fractures in the concrete surface. Spalling: flaking or chipping of the surface layer. Peeling: paint or coating detachment. Algae: biological growth from moisture.",
  },
  {
    q: "Why is the confidence score low for some detections?",
    a: "Low confidence (< 50%) may mean the defect is partially obscured, at an unusual angle, or visually similar to another class. You can filter or disregard low-confidence detections when reviewing results.",
  },
];

const colorMap = {
  blue: {
    num: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/50",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  emerald: {
    num: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-900/50",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  orange: {
    num: "text-orange-600 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-900/50",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    icon: "bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  purple: {
    num: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-900/50",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
} as const;

// ─── Components ───────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: typeof steps[number]; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const c = colorMap[step.color as keyof typeof colorMap];
  const Icon = step.icon;

  return (
    <div className={cn(
      "rounded-2xl border bg-white dark:bg-[#161616] shadow-sm overflow-hidden transition-all",
      open ? c.border : "border-gray-200 dark:border-gray-800"
    )}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", c.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("text-xs font-mono font-bold", c.num)}>{step.num}</span>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{step.title}</h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{step.summary}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {open && (
        <div className={cn("border-t px-6 pb-6 pt-5 space-y-6", c.border.replace("border-", "border-t-"))}>
          {/* Detail list */}
          <div className="space-y-4">
            {step.details.map(({ heading, body }) => (
              <div key={heading} className="flex gap-3">
                <div className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", c.dot)} />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-0.5">{heading}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className={cn("rounded-xl border p-4", c.border, c.bg)}>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className={cn("w-4 h-4 shrink-0", c.num)} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tips</span>
            </div>
            <ul className="space-y-1.5">
              {step.tips.map(tip => (
                <li key={tip.text} className="flex gap-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", c.num)} />
                  {tip.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-[#161616]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstructionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#14171e]">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2 select-none">
              <span className="text-sm font-bold font-mono tracking-tight bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
                viscrete
              </span>
              <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">/ how to use</span>
            </Link>
          </div>
          <ModeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-14">

        {/* ── Hero ──────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          bg-emerald-50 dark:bg-emerald-950/30
                          border border-emerald-200 dark:border-emerald-800
                          text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Info className="w-3.5 h-3.5" />
            User Guide
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            How to Use{" "}
            <span className="bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
              VISCRETE
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
            VISCRETE is an AI-powered concrete defect inspection tool. Upload images
            and the system automatically enhances, analyzes, and reports on surface defects — no manual configuration needed.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                         bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-400
                         dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 dark:border-blue-600
                         text-sm font-semibold transition"
            >
              Start Inspection
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ── Pipeline overview ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-5">
            The 4-Step Pipeline
          </h2>
          {/* Flow strip */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            {steps.map((s, i) => {
              const c = colorMap[s.color as keyof typeof colorMap];
              const Icon = s.icon;
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold",
                    c.bg, c.border, c.num
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                    {s.title}
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-700 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step cards */}
          <div className="space-y-4">
            {steps.map((step, i) => (
              <StepCard key={step.num} step={step} index={i} />
            ))}
          </div>
        </div>

        {/* ── File requirements ─────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-5">
            File Requirements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fileRequirements.map(({ label, icon: Icon, items }) => (
              <div key={label} className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{label}</span>
                </div>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick tips ────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Things to Know</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: FolderOpen, text: "Jobs are saved automatically. You can resume any inspection from the Previous Jobs list on the home page." },
              { icon: Cpu, text: "Processing is handled entirely on the server — you do not need to install anything locally." },
              { icon: MapPin, text: "GPS coordinates in EXIF data are used to tag defect locations in the report. You can also assign them manually." },
              { icon: Download, text: "Reports can be downloaded as PDF or exported as CSV for use in spreadsheet or maintenance software." },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
                <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-5">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {faqs.map(({ q, a }) => (
              <FaqItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────── */}
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ready to inspect?</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-400
                       dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400 dark:border-blue-600
                       font-semibold transition shadow-sm"
          >
            Start Inspection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-4">
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 font-mono">
          © 2026 <span className="text-emerald-600 dark:text-[#2ca75d]">viscrete</span>. Visual Inspection System for Concrete Evaluation.
        </p>
      </footer>

    </div>
  );
}
