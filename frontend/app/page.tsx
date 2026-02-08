
import Hero from "@/components/hero";
import Details from "@/components/details";
import Features from "@/components/features";
import Download from "@/components/download";

export default function Home() {
  return (
    <div className="scroll-smooth min-h-screen bg-[white] dark:bg-[#0c0c0c]">
      <main className="container mx-auto px-4 py-8">
        <div className="absolute inset-0 bg-white dark:bg-[#0c0c0c]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f15_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f15_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
        </div>
        
        <Hero/>

        {/* Other Info */}
        
        
        <section className="relative z-10 flex mt-12 max-w-3xl mx-auto opacity-100 px-4">
              <div className="flex flex-col sm:flex-row max-w-3xl mx-auto gap-6 sm:gap-x-12 w-full">
              <div className="flex-1 text-center">  
                <div className="text-2xl md:text-3xl font-bold text-black dark:text-white">1,000+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Images Analyzed</div>
              </div>
              <div className="sm:block w-px bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl md:text-3xl font-bold text-black dark:text-white">10+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Infrastructure Samples Evaluated</div>
              </div>
              <div className="sm:block w-px bg-gray-300 dark:bg-gray-700"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl md:text-3xl font-bold text-black dark:text-white">92%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Detection Accuracy</div>
              </div>
              </div>
            </section>

        <Details/>
        

        <Features/>

        {/* <Download/> */}
      </main>
    </div>
  );
}