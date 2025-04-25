import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { findTextPositionInPage } from '@/utils/pdfUtils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Set the worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface HighlightInfo {
  page: number;
  position?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

const PDFViewer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const shouldHighlight = searchParams.get('highlight') === 'true';
  
  const [pdfUrl, setpdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [highlightInfo, setHighlightInfo] = useState<HighlightInfo | null>(null);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!documentId) {
          throw new Error("No document ID provided");
        }

        const { data: documentData, error: documentError } = await supabase
          .from('policy_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (documentError) throw documentError;
        if (!documentData) throw new Error("Document not found");

        const { data: fileData, error: fileError } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(documentData.file_path, 3600);

        if (fileError) throw fileError;
        if (!fileData?.signedUrl) throw new Error("Failed to generate document URL");

        setpdfUrl(fileData.signedUrl);
        setDocumentTitle(documentData.file_name);
        
        if (shouldHighlight && initialPage) {
          setHighlightInfo({
            page: initialPage,
            position: undefined
          });
        }
      } catch (error) {
        console.error("Error fetching document:", error);
        setError(error instanceof Error ? error.message : "Failed to load document");
        toast({
          title: "Error",
          description: "Failed to load document",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocument();
  }, [documentId, initialPage, shouldHighlight]);
  
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };
  
  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return newPageNumber >= 1 && newPageNumber <= (numPages || 1) 
        ? newPageNumber 
        : prevPageNumber;
    });
  };
  
  const handleSearch = (value: string) => {
    setSearchText(value);
    setSearchResults([]);
    setCurrentSearchIndex(0);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        // Implement search logic here
        // This is a placeholder for the actual search implementation
        const results = [1, 2, 3]; // Replace with actual search results
        setSearchResults(results);
      }, 500);
    }
  };
  
  const navigateToNextResult = () => {
    if (searchResults.length > 0) {
      setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
      setPageNumber(searchResults[currentSearchIndex]);
    }
  };
  
  const createPdfElementWithHighlight = (document: any, highlightInfo: HighlightInfo) => {
    if (!document || !highlightInfo) return null;
    
    const canvas = document.querySelector(`canvas[data-page-number="${highlightInfo.page}"]`);
    if (!canvas) return null;
    
    const { position } = highlightInfo;
    if (!position) return null;
    
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.left = `${position.startX}px`;
    overlay.style.top = `${position.startY - 5}px`;
    overlay.style.width = `${position.endX - position.startX}px`;
    overlay.style.height = '20px';
    overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
    overlay.style.pointerEvents = 'none';
    
    const pageContainer = canvas.parentElement;
    if (pageContainer) {
      pageContainer.style.position = 'relative';
      pageContainer.appendChild(overlay);
    }
    
    return overlay;
  };
  
  useEffect(() => {
    if (highlightInfo && canvasRef.current) {
      const timeout = setTimeout(() => {
        const overlay = createPdfElementWithHighlight(canvasRef.current, highlightInfo);
        
        return () => {
          if (overlay) overlay.remove();
        };
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [highlightInfo, pageNumber, canvasRef.current]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-xl font-medium text-gray-700">Loading document...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we prepare your document</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-2xl shadow-lg">
          <CardContent className="p-6">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="text-lg">Error</AlertTitle>
              <AlertDescription className="mt-2">{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => window.history.back()} 
              className="w-full bg-primary hover:bg-primary/90"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-6 px-4">
        <Card className="shadow-lg">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-2xl font-bold text-gray-800">
              {documentTitle || "Document Viewer"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
                <Button
                  onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                  disabled={pageNumber <= 1}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-gray-700">
                  Page {pageNumber} of {numPages}
                </span>
                <Button
                  onClick={() => setPageNumber((prev) => Math.min(numPages || prev, prev + 1))}
                  disabled={pageNumber >= (numPages || 1)}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
                <Button
                  onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-100"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-100"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
                <Input
                  type="text"
                  placeholder="Search in document..."
                  value={searchText}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-64 h-9"
                />
                <Button
                  onClick={navigateToNextResult}
                  variant="outline"
                  size="icon"
                  disabled={searchResults.length === 0}
                  className="hover:bg-gray-100"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-center bg-white rounded-lg shadow-sm p-4">
              {pdfUrl && (
                <Document
                  file={pdfUrl}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={
                    <div className="flex justify-center items-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PDFViewer;
