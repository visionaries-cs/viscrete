'use client';


import { useParams } from 'next/navigation';




export default function ResultPage() {
    const params = useParams();
    const jobId = params.job_id;

    return (
        <div className='flex min-h-screen overflow-hidden'>
            <h1>Result Page</h1>
            <p>Job ID: {jobId}</p>
            
        </div>
    );
}