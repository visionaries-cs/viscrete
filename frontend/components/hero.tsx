'use client';
import { Button } from "@/components/ui/button";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStart = () => {
    router.push('/login');
  };

  return (
    <section className="relative min-h-[700px] w-full -mx-4 px-4">
      {/* Hero Content */}
      <div className="relative z-10 flex flex-col justify-center items-center space-y-6 md:space-y-8 pt-10 md:pt-20">
        <span className="inline-block px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base lg:text-lg font-medium bg-black dark:bg-white text-white dark:text-black rounded-full">
          Automated Structural Inspection Framework
        </span>
        
        <h1 className="text-4xl font-bold tracking-tighter max-w-2xl lg:max-w-5xl xl:max-w-6xl text-center sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl bg-gradient-to-r from-black via-gray-700 to-black bg-clip-text text-transparent dark:from-white dark:via-gray-300 dark:to-white px-4">
          Ensure safety with early concrete defect detection
        </h1>
        
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-normal text-gray-600 dark:text-gray-400 max-w-3xl lg:max-w-4xl xl:max-w-5xl text-center px-4">
          A pluggable, modular system designed to automate concrete wall defect detection using vision-based model and traditional image processing for safer infrastructure.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Button onClick={handleStart} size="lg" className="transform transition duration-500 hover:scale-105 cursor-pointer bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 px-8 py-6 text-lg">
            {/* <a href="/login"> */}
              Start Inspection
              <ChevronRightIcon className="h-6 w-6" />
            {/* </a> */}
          </Button>
          <Button onClick={() => scrollToSection('details')} size="lg" variant="outline" className="transform transition duration-500 hover:scale-105 cursor-pointer border-black dark:border-white text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900 px-8 py-6 text-lg">
            See How It Works
          </Button>
        </div>
      </div>
    </section>
  );
}
