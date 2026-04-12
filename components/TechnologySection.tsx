import { Scan, Video, Plane, BarChart3, MapPin, HardHat } from "lucide-react";

const features = [
  {
    icon: Scan,
    title: "YOLO-Based Defect Detection",
    description:
      "Automatically detects concrete surface defects such as cracks, spalling, and exposed rebars using YOLO-based deep learning models.",
  },
  {
    icon: Video,
    title: "Image & Video Processing",
    description:
      "Processes images and video feeds from cameras or drones using computer vision and traditional image processing techniques.",
  },
  {
    icon: Plane,
    title: "Drone & Mobile Integration",
    description:
      "Supports aerial and handheld data capture for inspecting hard-to-reach concrete structures like bridges, railways, and buildings.",
  },
  {
    icon: BarChart3,
    title: "Defect Classification & Analysis",
    description:
      "Classifies detected defects by type and severity to assist engineers in prioritizing maintenance and structural assessment.",
  },
  {
    icon: MapPin,
    title: "Geotagged Inspection Records",
    description:
      "Stores detected defects with location data, timestamps, and visual evidence for inspection tracking and documentation.",
  },
  {
    icon: HardHat,
    title: "Engineer-Centered Workflow",
    description:
      "Designed to assist civil engineers by reducing manual inspection effort while improving safety, consistency, and accuracy.",
  },
];

const TechnologySection = () => {
  return (
    <section className="w-full py-24 bg-white dark:bg-[#14171e]" id="technology">
      <div className="container max-w-6xl mx-auto px-6">
        <div className="text-center mb-16 space-y-4">
          <p className="text-sm font-mono text-emerald-700 dark:text-[#0da6f2] uppercase tracking-widest">
            Core Capabilities
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            The Technology Behind{" "}
            <span className="bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent">
              viscrete
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-lg transition-colors
                         border border-emerald-100 bg-gray-50
                         hover:border-emerald-300
                         dark:border-[#1e4032] dark:bg-[#101115]
                         dark:hover:border-[#2ca75d]/50"
            >
              <div className="mb-4 w-10 h-10 rounded-md flex items-center justify-center transition-colors
                              bg-emerald-50 group-hover:bg-emerald-100
                              dark:bg-[#1e4032] dark:group-hover:bg-[#2ca75d]/20">
                <feature.icon className="w-5 h-5 text-emerald-600 dark:text-[#2ca75d]" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechnologySection;
