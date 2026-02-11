'use client';

// REACT
import { useParams } from 'next/navigation';
import { useRef, useState, useEffect, use } from "react";

// MUI
import SettingsIcon from '@mui/icons-material/Settings'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

// COMPONENTS
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Download } from 'lucide-react';
import { Grid3x3 } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { Box } from 'lucide-react';
import { Tag } from 'lucide-react';
import { Layers } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"






export default function ResultPage() {
    const params = useParams();
    const jobId = params.job_id as string;

    // Project Validity
    const [isValidProject, setIsValidProject] = useState(true);

    

    // Results
    const [result, setResult] = useState(null);
    const [riskScore, setRiskScore] = useState(null);
    const [totalDefectCount , setTotalDefectCount] = useState(null);
    const [cracksCount, setCracksCount] = useState(0);
    const [spallingCount, setSpallingCount] = useState(0);
    const [peelingCount, setPeelingCount] = useState(0);
    const [algaeCount, setAlgaeCount] = useState(0);
    const [stainCount, setStainCount] = useState(0);

    useEffect(() => {
        // Here you would typically fetch project data using the jobId
        // For demonstration, we'll assume the project is valid if jobId is "valid-job"
        if (jobId !== "valid-job") {
            setIsValidProject(false);
        }
    }, [jobId]);


    // Fetch results from API
    useEffect(() => {
        const fetchResults = async () => {
            try {
                const response = await fetch(`http://127.0.0.1:8000/api/detect?job_id=${encodeURIComponent(jobId)}`);

                
                 if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch images' }));
                    throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch images`);
                 };

                const data = await response.json();
                setResult(data);
                console.log('API Response:', data);

                // TODO: Update state with actual results from API
                // setTotalDefectCount, setCracksCount, setSpallingCount, setPeelingCount, setAlgaeCount, setStainCount

                // Set Total Count of Defects
                 
                setTotalDefectCount(data.total_defect_count);
                
            } catch (error) {
                console.error('Error fetching results:', error);
            };
        }
        
        

        fetchResults();
    }, [jobId]);

    // Project Info
    const [projectDate, setProjectDate] = useState("February 10, 2026; 6:07 PM");
    const [projectName, setProjectName] = useState("Construction Site 1 Upper Deck");
    const [modelName, setModelName] = useState("YOLOv11-STRUCTURAL.pt");
    const [projectImages, setProjectImages] = useState([]);

    // Overlay buttons
    const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(false);



    return (
        <div className='flex flex-col min-h-screen overflow-hidden'>
            {/* HEADER */}
            <header className="bg-black dark:bg-black border-b border-gray-800">
                <div className="container mx-4 px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="text-white hover:text-gray-300 transition-colors cursor-pointer">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        
                        <div>
                            <h1 className="text-xl font-bold text-white">VIEW RESULTS</h1>
                            <p className="text-sm text-gray-400">
                                Detection Results for {projectName}
                            </p>
                        </div>
                    </div>
                    <div className='flex flex-row gap-4 items-center justify-end'>
                        <h3 className='p-2 text-gray-400'>
                            <span className="flex items-center gap-1">
                                <SettingsIcon fontSize="small" />
                                {modelName}
                            </span>
                        </h3>
                        <h3 className='p-2 text-gray-400'>
                            <span className="flex items-center gap-1">
                                <CalendarMonthIcon fontSize="small" />
                                {projectDate}
                            </span>
                        </h3>
                    </div>
                </div>
            </header>

            {/* CONTENT */}
            <div className='flex flex-1'>
                {/* Main Image Viewer */}
                <div className='flex-1 bg-gray-900 relative flex flex-col'>
                    {/* Overlay Controls */}
                    <div className='absolute top-6 left-1/2 transform -translate-x-1/2 z-10'>
                        <div className='bg-gray-950/90 backdrop-blur-sm border border-gray-700 rounded-lg px-6 py-3'>
                            <div className='flex items-center gap-6'>
                                <span className='text-gray-400 text-sm uppercase tracking-wider'>Overlays</span>
                                
                                {/* Bounding Boxes Toggle */}
                                <button 
                                    onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                                    className='flex items-center gap-2 text-gray-300 hover:text-white transition-colors'
                                >
                                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showBoundingBoxes ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showBoundingBoxes ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                    <Box className='w-5 h-5' />
                                </button>

                                {/* Labels Toggle */}
                                <button 
                                    onClick={() => setShowLabels(!showLabels)}
                                    className='flex items-center gap-2 text-gray-300 hover:text-white transition-colors'
                                >
                                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showLabels ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showLabels ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                    <Tag className='w-5 h-5' />
                                </button>

                                {/* Heatmap Toggle */}
                                <button 
                                    onClick={() => setShowHeatmap(!showHeatmap)}
                                    className='flex items-center gap-2 text-gray-300 hover:text-white transition-colors'
                                >
                                    <div className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${showHeatmap ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showHeatmap ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                    <Layers className='w-5 h-5' />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Image Placeholder */}
                    <div className='flex-1 flex items-center justify-center p-8'>
                        <div className='w-full h-full bg-gray-800/30 border-2 border-dashed border-gray-700/50 rounded-lg flex items-center justify-center'>
                            <div className='text-center'>
                                <ImageIcon className='w-16 h-16 text-gray-600 mx-auto mb-4' />
                                <p className='text-gray-500 text-lg'>No image loaded</p>
                                <p className='text-gray-600 text-sm mt-2'>Detection results will appear here</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className='w-96 bg-gray-950 border-l border-gray-800 p-6 overflow-y-auto'>
                    {/* Risk Score Section */}
                    <div className='mb-6'>
                        <div className='text-xs text-gray-400 uppercase mb-2'>Overall Risk Score</div>
                        <div className='flex items-end gap-2 mb-2'>
                            <div className='text-5xl font-bold text-red-500'>0</div>
                            <div className='text-gray-500 text-lg mb-2'>/ 100</div>
                        </div>
                        <div className='w-full h-2 bg-gray-800 rounded-full overflow-hidden'>
                            <div className='h-full bg-red-500' style={{ width: '0%' }}></div>
                        </div>
                    </div>

                    {/* Defect Type Cards Grid */}
                    <div className='grid grid-cols-2 gap-3 mb-6'>
                        {/* Total Defects */}
                        <div className='bg-blue-950/30 border border-blue-900/50 rounded-lg p-4'>
                            <div className='text-blue-400 text-3xl font-bold mb-1'>{totalDefectCount ? totalDefectCount : 0}</div>
                            <div className='text-blue-300 text-sm' >Total Defects</div>
                        </div>

                        {/* Cracks */}
                        <div className='bg-red-950/30 border border-red-900/50 rounded-lg p-4'>
                            <div className='text-red-400 text-3xl font-bold mb-1'>0</div>
                            <div className='text-red-300 text-sm'>Cracks</div>
                        </div>

                        {/* Spalling */}
                        <div className='bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-4'>
                            <div className='text-yellow-400 text-3xl font-bold mb-1'>0</div>
                            <div className='text-yellow-300 text-sm'>Spalling</div>
                        </div>

                        {/* Peeling */}
                        <div className='bg-orange-950/30 border border-orange-900/50 rounded-lg p-4'>
                            <div className='text-orange-400 text-3xl font-bold mb-1'>0</div>
                            <div className='text-orange-300 text-sm'>Peeling</div>
                        </div>

                        {/* Algae */}
                        <div className='bg-green-950/30 border border-green-900/50 rounded-lg p-4'>
                            <div className='text-green-400 text-3xl font-bold mb-1'>0</div>
                            <div className='text-green-300 text-sm'>Algae</div>
                        </div>

                        {/* Stain */}
                        <div className='bg-purple-950/30 border border-purple-900/50 rounded-lg p-4'>
                            <div className='text-purple-400 text-3xl font-bold mb-1'>0</div>
                            <div className='text-purple-300 text-sm'>Stain</div>
                        </div>
                    </div>

                    {/* Detected Defects List */}
                    <div className='w-full h-px bg-gray-800 mb-6'></div>

                    <div className='mb-6'>
                        <div className='text-xs text-gray-400 uppercase mb-4 tracking-wider'>Detected Defects (0)</div>
                        <div className='text-gray-500 text-sm'>No defects detected</div>
                    </div>

                    <div className='w-full h-px bg-gray-800 mb-6'></div>
                    
                    {/* Export */}
                    <div className='mt-8'>
                        <div className='text-xs text-gray-400 uppercase mb-4 tracking-wider'>Export Report</div>
                        <Button className='cursor-pointer w-full bg-[#ffcc00] hover:bg-[#ffdd57] text-black font-semibold mb-3'>
                            <Download className='w-4 h-4 mr-2' />
                            Download PDF Report
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant='outline' className='w-full cursor-pointer bg-black border-2 border-yellow-500 text-yellow-500 hover:bg-[#221f0c] hover:text-yellow-500'>
                                    <Grid3x3 className='w-4 h-4 mr-2' />
                                    More Export Options
                                    <ChevronDown className='w-4 h-4 ml-auto' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className='w-56 bg-gray-900 border-gray-700'>
                                <DropdownMenuItem className='text-white hover:bg-gray-800 cursor-pointer'>
                                    <Download className='w-4 h-4 mr-2' />
                                    <div>
                                        <div className='font-semibold'>Export as PDF</div>
                                        <div className='text-xs text-gray-400'>Visual inspection report</div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem className='text-white hover:bg-gray-800 cursor-pointer'>
                                    <Grid3x3 className='w-4 h-4 mr-2' />
                                    <div>
                                        <div className='font-semibold'>Export as CSV</div>
                                        <div className='text-xs text-gray-400'>Raw detection data</div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <p className='text-xs text-center text-gray-400 mt-2'>PDF includes annotated images & findings summary</p>
                    </div>


                </div>
            </div>

            
            
        </div>
    );
}