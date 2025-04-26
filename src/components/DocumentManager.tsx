import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Loader2, Upload, Trash2, FileText } from 'lucide-react';

export function DocumentManager() {
    // Local state for file selection (purely UI, not connected to backend)
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Dummy static documents for UI display
    const documents = [
        {
            id: '1',
            title: 'Sample Document',
            created_at: new Date().toLocaleDateString(),
        },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // No backend logic, just UI feedback
        setIsUploading(true);
        setTimeout(() => {
            setIsUploading(false);
            setFile(null);
            // No actual upload
        }, 1000);
    };

    const handleDelete = (id: string) => {
        // No backend logic, just UI feedback
        // No actual delete
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-[rgba(49,159,67,1)]" />
                            Document Management
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Upload and manage AI reference documents.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="inline-block bg-gray-100 text-gray-700 rounded px-3 py-1 text-sm font-medium">
                            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => { /* UI only, no backend */ }}
                        >
                            <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-medium mb-4">Upload Document</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                        <label 
                            htmlFor="file-upload" 
                            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                        >
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-2 text-gray-500" />
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">PDF, DOC, DOCX, or TXT</p>
                            </div>
                            <input 
                                id="file-upload" 
                                type="file" 
                                className="hidden" 
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.txt"
                            />
                        </label>
                    </div>
                    {file && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div className="flex items-center">
                                <FileText className="w-5 h-5 text-gray-500 mr-2" />
                                <span className="text-sm font-medium">{file.name}</span>
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setFile(null)}
                            >
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    )}
                    <Button 
                        type="submit" 
                        className="w-full bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white" 
                        disabled={isUploading || !file}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Document
                            </>
                        )}
                    </Button>
                </form>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-lg font-medium mb-4">Uploaded Documents</h3>
                {isLoading ? (
                    <div className="flex justify-center items-center h-32">
                        <Loader2 className="h-6 w-6 animate-spin text-[rgba(49,159,67,1)]" />
                        <span className="ml-3 text-gray-600">Loading documents...</span>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No documents uploaded yet
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map((doc) => (
                            <Card key={doc.id} className="p-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <FileText className="w-5 h-5 text-gray-500 mr-3" />
                                        <div>
                                            <h4 className="font-medium">{doc.title}</h4>
                                            <p className="text-xs text-gray-500">
                                                {doc.created_at}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(doc.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}