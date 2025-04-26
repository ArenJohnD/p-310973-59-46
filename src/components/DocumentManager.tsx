import React, { useState, useEffect } from 'react';
import { Document, DocumentUpload } from '../types/documents';
import { documentService } from '../lib/documents';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { toast } from './ui/use-toast';
import { Loader2, Upload, Trash2, FileText } from 'lucide-react';

export function DocumentManager() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        loadDocuments();
        verifyBucketSetup();
    }, []);

    const verifyBucketSetup = async () => {
        try {
            const result = await documentService.verifyStorageBucket();
            if (!result) {
                toast({
                    title: 'Storage Setup Issue',
                    description: 'There might be an issue with the storage configuration. Please check the console for details.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Failed to verify storage bucket:', error);
        }
    };

    const loadDocuments = async () => {
        try {
            setIsLoading(true);
            const docs = await documentService.getDocuments();
            setDocuments(docs);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load documents',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast({
                title: 'Error',
                description: 'Please select a file to upload',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);

        try {
            // Extract title from filename (remove extension)
            const fileName = file.name;
            const title = fileName.substring(0, fileName.lastIndexOf('.'));
            
            // For now, we'll use a placeholder content
            // In a real implementation, you might want to extract text from the file
            const content = `Content from ${fileName}`;

            const document: DocumentUpload = {
                title,
                content,
                file,
            };

            await documentService.uploadDocument(document);
            toast({
                title: 'Success',
                description: 'Document uploaded successfully',
            });

            // Reset form
            setFile(null);
            loadDocuments();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload document',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await documentService.deleteDocument(id);
            toast({
                title: 'Success',
                description: 'Document deleted successfully',
            });
            loadDocuments();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete document',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                        className="w-full" 
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

            <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                                                {new Date(doc.created_at).toLocaleDateString()}
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