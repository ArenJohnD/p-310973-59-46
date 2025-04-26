import React, { useState, useEffect } from 'react';
import { Document, DocumentUpload } from '../types/documents';
import { documentService } from '../lib/documents';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { toast } from './ui/use-toast';

export function DocumentManager() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            const docs = await documentService.getDocuments();
            setDocuments(docs);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load documents',
                variant: 'destructive',
            });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const document: DocumentUpload = {
                title,
                content,
                file: file || undefined,
            };

            await documentService.uploadDocument(document);
            toast({
                title: 'Success',
                description: 'Document uploaded successfully',
            });

            // Reset form
            setTitle('');
            setContent('');
            setFile(null);
            loadDocuments();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to upload document',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
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
            <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Upload Document</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Content</label>
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            required
                            rows={5}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">File (Optional)</label>
                        <Input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.txt"
                        />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Uploading...' : 'Upload Document'}
                    </Button>
                </form>
            </Card>

            <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Uploaded Documents</h2>
                <div className="space-y-4">
                    {documents.map((doc) => (
                        <Card key={doc.id} className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold">{doc.title}</h3>
                                    <p className="text-sm text-gray-500">
                                        {new Date(doc.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(doc.id)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </Card>
        </div>
    );
} 