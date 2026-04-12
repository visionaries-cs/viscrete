"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import { useRouter } from "next/navigation";

const HeroSection = () => {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleStart = () => {
    router.push("/upload");
  };

  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden
                        bg-white dark:bg-[#14171e]">
      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light mode grid */}
        <div className="absolute inset-0 dark:hidden
          bg-[linear-gradient(to_right,#2ca75d0d_1px,transparent_1px),linear-gradient(to_bottom,#2ca75d0d_1px,transparent_1px)]
          bg-[size:14px_24px]
          [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        {/* Dark mode grid */}
        <div className="absolute inset-0 hidden dark:block
          bg-[linear-gradient(to_right,#2ca75d15_1px,transparent_1px),linear-gradient(to_bottom,#2ca75d15_1px,transparent_1px)]
          bg-[size:14px_24px]
          [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      </div>

      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-x-0 h-px bg-[#2ca75d]/10 dark:bg-[#2ca75d]/20 animate-scan-line" />
      </div>

      {/* Content */}
      <div className="relative z-10 container max-w-4xl mx-auto text-center px-6">
        <div className="flex flex-col items-center space-y-8">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                          border border-emerald-300 bg-emerald-50
                          dark:border-[#2ca75d]/30 dark:bg-[#1e4032]">
            <span className="w-2 h-2 rounded-full bg-[#2ca75d] animate-pulse" />
            <span className="text-sm font-mono text-emerald-700 dark:text-[#2ca75d]">
              Structural Analysis Platform
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
              viscrete
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl font-medium text-gray-900 dark:text-white/90">
            Visual Inspection System for Concrete Evaluation
          </p>

          {/* Description */}
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            A pluggable, modular system designed to automate concrete wall
            defect detection using vision-based models and traditional image
            processing for safer infrastructure.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="cursor-pointer gap-2 text-base bg-[#e5ac0c] hover:bg-[#e5ac0c]/90 text-black font-semibold"
              onClick={handleStart}
            >
              Start Inspection
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              className="cursor-pointer gap-2 text-base border border-[#0da6f2] bg-transparent text-[#0da6f2] hover:bg-[#0da6f2]/10"
              onClick={() => scrollToSection("technology")}
            >
              <Play className="w-4 h-4" />
              See How It Works
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
