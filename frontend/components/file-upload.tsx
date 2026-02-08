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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HelpCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function FileUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileProgresses, setFileProgresses] = useState<Record<string, number>>(
    {}
  );
  const [fileType, setFileType] = useState<'image' | 'video'>('image');

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const allFiles = Array.from(files);
    
    // Filter files based on selected type
    const filteredFiles = allFiles.filter(file => {
      if (fileType === 'image') {
        return file.type.startsWith('image/');
      } else {
        return file.type.startsWith('video/');
      }
    });
    
    setUploadedFiles((prev) => [...prev, ...filteredFiles]);

    // Simulate upload progress for each file
    filteredFiles.forEach((file) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
        }
        setFileProgresses((prev) => ({
          ...prev,
          [file.name]: Math.min(progress, 100),
        }));
      }, 300);
    });
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (filename: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.name !== filename));
    setFileProgresses((prev) => {
      const newProgresses = { ...prev };
      delete newProgresses[filename];
      return newProgresses;
    });
  };

  const handleContinue = () => {
    if (uploadedFiles.length > 0) {
      router.push('/upload-review');
    }
  };

  return (
    <div id="upload" className="flex flex-col items-center justify-center p-10">
      <div className="mb-8 text-center max-w-6xl">
        <h1 className="text-4xl font-bold text-foreground mb-3">
          Upload your Folder
        </h1>
        <p className="text-lg sm:text-xl sm:text-center text-muted-foreground max-w-3xl mx-auto">
          Select a folder containing {fileType}s for structural assessment using YOLOv11 and traditional processing.
        </p>
      </div>
      <Card className="w-full mx-auto max-w-6xl bg-background rounded-lg p-0 shadow-md">
        <CardContent className="p-0">
          <div className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-foreground">
                  Create a new inspection job
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop to start inspection.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-4 mt-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="projectName" className="mb-2">
                  Construction Site Name
                </Label>
                <Input
                  id="projectName"
                  type="text"
                  defaultValue="Open Source Stripe"
                />
              </div>

              <div>
                <Label htmlFor="projectLead" className="mb-2">
                  Inspector / Structural Engineer
                </Label>
                <Select defaultValue="1">
                  <SelectTrigger id="projectLead" className="ps-2 w-full">
                    <SelectValue placeholder="Select project lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="1">
                        <img
                          className="size-5 rounded"
                          src="https://blocks.so/avatar-01.png"
                          alt="Ephraim Duncan"
                          width={20}
                          height={20}
                        />
                        <span className="truncate">Ephraim Duncan</span>
                      </SelectItem>
                      <SelectItem value="2">
                        <img
                          className="size-5 rounded"
                          src="https://blocks.so/avatar-03.png"
                          alt="Lucas Smith"
                          width={20}
                          height={20}
                        />
                        <span className="truncate">Lucas Smith</span>
                      </SelectItem>
                      <SelectItem value="3">
                        <img
                          className="size-5 rounded"
                          src="https://blocks.so/avatar-02.jpg"
                          alt="Timur Ercan"
                          width={20}
                          height={20}
                        />
                        <span className="truncate">Timur Ercan</span>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fileType" className="mb-2">
                  File Type
                </Label>
                <Select defaultValue="image" onValueChange={(value: 'image' | 'video') => setFileType(value)}>
                  <SelectTrigger id="fileType" className="w-full">
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
          </div>

          <div className="px-6">
            <div
              className="border-2 border-dashed border-border rounded-md p-8 flex flex-col items-center justify-center text-center cursor-pointer"
              onClick={handleBoxClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="mb-2 bg-muted rounded-full p-3">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Upload project folder ({fileType === 'image' ? 'Images only' : 'Videos only'})
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or,{" "}
                <label
                  htmlFor="fileUpload"
                  className="text-primary hover:text-primary/90 font-medium cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  click to browse
                </label>{" "}
                for folder (only {fileType}s will be loaded)
              </p>
              <input
                type="file"
                id="fileUpload"
                ref={fileInputRef}
                className="hidden"
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          </div>

          <div
            className={cn(
              "px-6 pb-5 space-y-3",
              uploadedFiles.length > 0 ? "mt-4" : ""
            )}
          >
            {uploadedFiles.map((file, index) => {
              const fileUrl = URL.createObjectURL(file);
              const isVideo = file.type.startsWith('video/');

              return (
                <div
                  className="border border-border rounded-lg p-2 flex flex-col"
                  key={file.name + index}
                  onLoad={() => {
                    return () => URL.revokeObjectURL(fileUrl);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-18 h-14 bg-muted rounded-sm flex items-center justify-center self-start row-span-2 overflow-hidden">
                      {isVideo ? (
                        <video
                          src={fileUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={fileUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 pr-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground truncate max-w-[250px]">
                            {file.name}
                          </span>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {Math.round(file.size / 1024)} KB
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 bg-transparent! hover:text-red-500"
                          onClick={() => removeFile(file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-muted rounded-full overflow-hidden flex-1">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${fileProgresses[file.name] || 0}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {Math.round(fileProgresses[file.name] || 0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-3 border-t border-border bg-muted rounded-b-lg flex justify-between items-center">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Need help?
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="py-3 bg-background text-foreground border">
                  <div className="space-y-1">
                    <p className="text-[13px] font-medium">Need assistance?</p>
                    <p className="text-muted-foreground dark:text-muted-background text-xs max-w-[200px]">
                      Upload project images by dragging and dropping files or
                      using the file browser. Supported formats: JPG, PNG, SVG.
                      Maximum file size: 4MB.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-9 px-4 text-sm font-medium"
              >
                Cancel
              </Button>
              <Button 
                className="h-9 px-4 text-sm font-medium"
                onClick={handleContinue}
                disabled={uploadedFiles.length === 0}
              >
                Continue
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
