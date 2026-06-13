"use client";

import { cn } from "@/lib/utils";

interface ClusterInfo {
  cluster_id: number;
  representative_file_id: string;
  member_count: number;
  clahe_params: {
    clip_limit: number;
    tile_grid_size: [number, number];
    source: string;
  };
}

export function ClusterCard({ info }: { info: ClusterInfo }) {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-800 dark:text-white">
          Cluster {info.cluster_id}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[11px] font-semibold",
            info.clahe_params.source === "mocs"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {info.clahe_params.source.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div>
          <p className="text-gray-400 dark:text-gray-500">Members</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.member_count} images
          </p>
        </div>
        <div>
          <p className="text-gray-400 dark:text-gray-500">CLAHE Clip</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.clahe_params.clip_limit.toFixed(2)}
          </p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400 dark:text-gray-500">Tile Grid</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {info.clahe_params.tile_grid_size[0]} ×{" "}
            {info.clahe_params.tile_grid_size[1]}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ClusterCard;
