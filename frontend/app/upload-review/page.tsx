"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  Filter,
  MapPin,
  MapPinOff,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useState } from "react";

// Image data structure
// GPS location (latitude/longitude) will be fetched per image from location API
interface ImageData {
  id: string;
  filename: string;
  size: string;
  camera: string;
  datetime: string;
  latitude?: number; // Fetched from location API (can be null/undefined)
  longitude?: number; // Fetched from location API (can be null/undefined)
  hasGPS: boolean; // Determined by API response
  thumbnail?: string;
}

export default function UploadReviewPage() {
  const [filterType, setFilterType] = useState<"all" | "gps" | "no-gps">("all");
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]); // Will be populated from backend API
  
  // Stats calculated from fetched image data
  // TODO: Fetch images from backend API
  // TODO: Fetch GPS coordinates per image from location API
  const totalImages = images.length;
  const withGPS = images.filter((img) => img.hasGPS).length;
  const withoutGPS = images.filter((img) => !img.hasGPS).length;
  const pending = totalImages - withGPS - withoutGPS;
  const completionPercentage = totalImages > 0 ? Math.round((withGPS / totalImages) * 100) : 0;

  const handleFilterChange = (type: "all" | "gps" | "no-gps") => {
    setFilterType(type);
  };

  const toggleLocationEntry = (imageId: string) => {
    setExpandedImage(expandedImage === imageId ? null : imageId);
  };

  const handleSaveLocation = (imageId: string) => {
    // TODO: Implement save location logic
    console.log("Save location for image:", imageId);
  };

  const handleBatchLocationEntry = () => {
    // TODO: Implement batch location entry logic
    console.log("Batch location entry");
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0c]">
      {/* Header */}
      <header className="bg-black dark:bg-black border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="text-white hover:text-gray-300 transition-colors cursor-pointer">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">UPLOAD REVIEW</h1>
              <p className="text-sm text-gray-400">
                Verify GPS data and add missing locations
              </p>
            </div>
          </div>
          <Button className="bg-white text-black hover:bg-gray-100 font-medium cursor-pointer">
            Proceed to Analysis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Image List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Filter className="w-4 h-4" />
                  <span>Filter:</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filterType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange("all")}
                    className={
                      filterType === "all"
                        ? "bg-black text-white hover:bg-gray-800 cursor-pointer"
                        : "cursor-pointer"
                    }
                  >
                    All
                  </Button>
                  <Button
                    variant={filterType === "gps" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange("gps")}
                    className="cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    With GPS
                  </Button>
                  <Button
                    variant={filterType === "no-gps" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange("no-gps")}
                    className="cursor-pointer"
                  >
                    <MapPinOff className="w-4 h-4 mr-1" />
                    No GPS
                  </Button>
                </div>
              </div>
              <div className="px-4 py-1 border border-gray-300 dark:border-gray-600 rounded-full text-sm">
                {totalImages > 0 ? `${totalImages} of ${totalImages} images` : 'No images'}
              </div>
            </div>

            {/* Image List - Placeholder */}
            <div className="space-y-3">
              {images.length === 0 ? (
                <Card className="border border-gray-300 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No images uploaded yet</p>
                      <p className="text-sm mt-1">Images will be fetched from backend API</p>
                      <p className="text-xs mt-1">GPS location data will be fetched per image</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // TODO: Map through images array and render image cards
                <div>Images will be displayed here</div>
              )}
            </div>

            {/* Example Image Card Structure (hidden, for reference) */}
            <div className="hidden">
              <Card className="border border-gray-300 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded flex-shrink-0">
                      <div className="absolute top-1 left-1 bg-black/70 p-1 rounded">
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-black dark:text-white">
                            image.jpg
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            4.31 MB
                          </p>
                        </div>
                        <span className="bg-black text-white text-xs px-3 py-1 rounded font-medium">
                          GPS FOUND
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          <span>Canon EOS R5</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>📅</span>
                          <span>February 3, 2026, 6:40 PM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>14.5995, 120.2675</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Location Entry */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
                      onClick={() => toggleLocationEntry("1")}
                    >
                      {expandedImage === "1" ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      Hide Location Entry
                    </button>

                    {expandedImage === "1" && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <Label htmlFor="locationName" className="text-sm mb-2">
                            Location Name
                          </Label>
                          <Input
                            id="locationName"
                            placeholder="e.g., Building A - North Wing"
                            className="border-gray-300 dark:border-gray-600"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="latitude" className="text-sm mb-2">
                              Latitude
                            </Label>
                            <Input
                              id="latitude"
                              placeholder="14.6752"
                              className="border-gray-300 dark:border-gray-600"
                            />
                          </div>
                          <div>
                            <Label htmlFor="longitude" className="text-sm mb-2">
                              Longitude
                            </Label>
                            <Input
                              id="longitude"
                              placeholder="128.231"
                              className="border-gray-300 dark:border-gray-600"
                            />
                          </div>
                        </div>
                        <Button
                          className="w-full bg-black text-white hover:bg-gray-800 cursor-pointer"
                          onClick={() => handleSaveLocation("1")}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          Save Location
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Summary & Batch Entry */}
          <div className="space-y-6">
            {/* Upload Summary */}
            <Card className="border border-gray-300 dark:border-gray-700">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-black dark:text-white mb-4">
                  Upload Summary
                </h2>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <ImageIcon className="w-4 h-4" />
                      <span>Total Images</span>
                    </div>
                    <p className="text-3xl font-bold text-black dark:text-white">
                      {totalImages}
                    </p>
                  </div>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span>With GPS</span>
                    </div>
                    <p className="text-3xl font-bold text-black dark:text-white">
                      {withGPS}
                    </p>
                  </div>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <MapPinOff className="w-4 h-4" />
                      <span>Without GPS</span>
                    </div>
                    <p className="text-3xl font-bold text-black dark:text-white">
                      {withoutGPS}
                    </p>
                  </div>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>⚠️</span>
                      <span>Pending</span>
                    </div>
                    <p className="text-3xl font-bold text-black dark:text-white">
                      {pending}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Location Completion
                    </span>
                    <span className="font-semibold text-black dark:text-white">
                      {completionPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-black dark:bg-white h-2 rounded-full transition-all"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                  {pending > 0 && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {pending} images require manual location entry
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Batch Location Entry */}
            <Card className="border border-gray-300 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <Layers className="w-5 h-5 mt-1 flex-shrink-0" />
                  <div>
                    <h2 className="text-lg font-bold text-black dark:text-white">
                      Batch Location Entry
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {pending > 0 
                        ? `Apply the same location to all ${pending} images without GPS data.`
                        : 'Apply the same location to images without GPS data (fetched per image from API).'
                      }
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="batchLocationName" className="text-sm mb-2">
                      Location Name
                    </Label>
                    <Input
                      id="batchLocationName"
                      placeholder="e.g., Building A - North Wing"
                      className="border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="batchLatitude" className="text-sm mb-2">
                        Latitude
                      </Label>
                      <Input
                        id="batchLatitude"
                        placeholder="14.6752"
                        className="border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div>
                      <Label htmlFor="batchLongitude" className="text-sm mb-2">
                        Longitude
                      </Label>
                      <Input
                        id="batchLongitude"
                        placeholder="128.231"
                        className="border-gray-300 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full bg-black text-white hover:bg-gray-800 cursor-pointer"
                    onClick={handleBatchLocationEntry}
                    disabled={pending === 0}
                  >
                    {pending > 0 ? `Apply to All ${pending} Images` : 'No Images to Update'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
