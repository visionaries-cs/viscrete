"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HelpCircle, Upload, Search, MapPin, Trash2 } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface PreviousReport {
  id: string;
  title: string;
  date: string;
  imageUrl?: string;
}

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [constructionSiteName, setConstructionSiteName] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [fileType, setFileType] = useState<'image' | 'video'>('image');

  // Clear uploaded files when file type changes
  useEffect(() => {
    setUploadedFiles([]);
  }, [fileType]);

  // Mock previous reports data
  const previousReports: PreviousReport[] = [
    { id: "1", title: "First Inspection", date: "January 2, 2025" },
    { id: "2", title: "First Inspection", date: "January 2, 2025" },
    { id: "3", title: "First Inspection", date: "January 2, 2025" },
    { id: "4", title: "First Inspection", date: "February 1, 2025" },
    { id: "5", title: "First Inspection", date: "February 1, 2025" },
    { id: "6", title: "First Inspection", date: "February 2, 2025" },
  ];

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((file) =>
      file.type.startsWith(fileType === 'image' ? "image/" : "video/")
    );
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === "siteName") {
      setConstructionSiteName(e.target.value);
    } else if (e.target.name === "inspector") {
      setInspectorName(e.target.value);
    }
  };

  const handleDeleteFile = (indexToDelete: number) => {
    setUploadedFiles((prev) =>
      prev.filter((_, index) => index !== indexToDelete)
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleContinue = () => {
    if (!constructionSiteName.trim() || !inspectorName.trim()) {
      alert("Please fill in all fields");
      return;
    }
    if (uploadedFiles.length === 0) {
      alert(`Please upload at least one ${fileType === 'image' ? 'image' : 'video'}`);
      return;
    }
    console.log({
      constructionSiteName,
      inspectorName,
      uploadedFiles,
      fileType,
    });
    // TODO: Handle form submission
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0c0c0c]">
      

      {/* Welcome Section */}
      <div className="container mx-auto px-4 py-6">
        

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Create New Inspection */}
          <div className="lg:col-span-1">
            <Card className="border border-gray-300 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-black dark:text-white mb-1">
                    Create a new inspection job
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag and drop images to start inspection.
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 mb-6">
                  <div>
                    <Label htmlFor="siteName" className="text-sm font-medium mb-2">
                      Construction Site Name
                    </Label>
                    <Input
                      id="siteName"
                      name="siteName"
                      placeholder=""
                      value={constructionSiteName}
                      onChange={handleInputChange}
                      className="border-gray-300 dark:border-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="inspector" className="text-sm font-medium mb-2">
                      Inspector / Structural Engineer
                    </Label>
                    <Input
                      id="inspector"
                      name="inspector"
                      placeholder=""
                      value={inspectorName}
                      onChange={handleInputChange}
                      className="border-gray-300 dark:border-gray-600"
                    />
                  </div>

                  <div>
                    <Label htmlFor="fileType" className="text-sm font-medium mb-2">
                      File Type
                    </Label>
                    <Select defaultValue="image" onValueChange={(value: 'image' | 'video') => setFileType(value)}>
                      <SelectTrigger id="fileType" className="border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Select file type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="image">Images</SelectItem>
                          <SelectItem value="video">Videos</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={handleBrowseClick}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragging
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                      : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={fileType === 'image' ? "image/*" : "video/*"}
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <p className="font-semibold text-black dark:text-white mb-1">
                    Drag and Drop {fileType === 'image' ? 'images' : 'videos'} here
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    or click to browse ({fileType === 'image' ? 'images only' : 'videos only'})
                  </p>
                </div>

                {/* Uploaded Files Count */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {uploadedFiles.length} {fileType === 'image' ? 'image(s)' : 'video(s)'} selected
                    </p>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm">
                    <HelpCircle className="w-4 h-4" />
                    need help?
                  </button>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="cursor-pointer border-gray-300 dark:border-gray-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="cursor-pointer bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                      onClick={handleContinue}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Previous Reports */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-black dark:text-white">
                  Your Previous Report
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input  
                    type="text"
                    placeholder="Enter Keyword"
                    value={searchKeyword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
                    className="pl-10 border-gray-300 dark:border-gray-600 w-full sm:w-48"
                  />
                </div>
              </div>

              {/* Reports Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {previousReports.map((report) => (
                  <div
                    key={report.id}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
                  >
                    {/* Image Placeholder */}
                    <div className="w-full aspect-square bg-gray-200 dark:bg-neutral-900 relative overflow-hidden">
                      {report.imageUrl ? (
                        <img
                          src={report.imageUrl}
                          alt={report.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-gray-400 dark:text-gray-500 text-sm">
                            No image
                          </span>
                        </div>
                      )}

                      {/* Label Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/50 py-2 px-3">
                        <p className="text-black dark:text-white font-medium text-sm">
                          {report.title}
                        </p>
                        <p className="text-gray-600 dark:text-gray-300 text-xs">{report.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            © Viscrete 2026
          </p>
        </div>
      </footer>
    </div>
  );
}