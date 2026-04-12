import { Camera, Building2, Target } from "lucide-react";

const stats = [
  {
    icon: Camera,
    value: "1,000+",
    label: "Images Analyzed",
    highlight: false,
  },
  {
    icon: Building2,
    value: "10+",
    label: "Infrastructure Samples Evaluated",
    highlight: false,
  },
  {
    icon: Target,
    value: "92%",
    label: "Detection Accuracy",
    highlight: true,
  },
];

const StatsSection = () => {
  return (
    <section className="w-full py-16
                        bg-gray-100 dark:bg-[#101115]
                        border-y border-emerald-200 dark:border-[#1e4032]">
      <div className="container max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center gap-3">
              <stat.icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              <span className={`text-4xl md:text-5xl font-bold font-mono ${
                stat.highlight
                  ? "text-emerald-600 dark:text-[#2ca75d]"
                  : "text-gray-900 dark:text-white"
              }`}>
                {stat.value}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
