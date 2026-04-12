
import LandingNav from "@/components/LandingNav";
import HeroSection from "@/components/HeroSection";
import StatsSection from "@/components/StatsSection";
import TechnologySection from "@/components/TechnologySection";
import AlgorithmSection from "@/components/AlgorithmSection";
import StrategySection from "@/components/StrategySection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#14171e] flex flex-col items-center">
      <LandingNav />
      {/* pt-12 offsets the fixed navbar height */}
      <div className="w-full pt-12">
        <HeroSection />
        <StatsSection />
        <TechnologySection />
        <AlgorithmSection />
        <StrategySection />
        <Footer />
      </div>
    </div>
  );
}
