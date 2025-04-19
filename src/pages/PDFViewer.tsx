import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { findTextPositionInPage } from '@/utils/pdfUtils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

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
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchDocument = async () => {
      if (!documentId) return;
      
      try {
        setLoading(true);
        
        // Fetch document metadata
        const { data: documentData, error: documentError } = await supabase
          .from('policy_documents')
          .select('*')
          .eq('id', documentId)
          .single();
          
        if (documentError) throw documentError;
        
        if (documentData) {
          setDocumentTitle(documentData.file_name);
          
          // Get a signed URL for the document
          const { data: fileData, error: fileError } = await supabase.storage
            .from('policy_documents')
            .createSignedUrl(documentData.file_path, 3600);
            
          if (fileError) throw fileError;
          
          if (fileData?.signedUrl) {
            setpdfUrl(fileData.signedUrl);
            
            if (shouldHighlight && initialPage) {
              setHighlightInfo({
                page: initialPage,
                position: undefined
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching document:', error);
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
  
  const handleSearch = async () => {
    if (!searchText.trim() || !pdfUrl) return;
    
    try {
      for (let i = 1; i <= (numPages || 1); i++) {
        const result = await findTextPositionInPage(pdfUrl, i, searchText);
        if (result.found && result.position) {
          setPageNumber(i);
          setHighlightInfo({
            page: i,
            position: result.position
          });
          return;
        }
      }
      
      alert('Text not found in document');
    } catch (error) {
      console.error('Error searching document:', error);
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
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">{documentTitle || 'Policy Document'}</h1>
      
      <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            variant="outline"
            size="icon"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span>
            Page {pageNumber} of {numPages || '?'}
          </span>
          
          <Button
            onClick={() => changePage(1)}
            disabled={pageNumber >= (numPages || 0)}
            variant="outline"
            size="icon"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
            variant="outline"
            size="icon"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <span>{Math.round(scale * 100)}%</span>
          
          <Button
            onClick={() => setScale(prev => Math.min(2.5, prev + 0.1))}
            variant="outline"
            size="icon"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Search document..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-48"
          />
          <Button onClick={handleSearch} variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div 
        ref={canvasRef}
        className="flex justify-center border rounded-lg p-4 bg-white shadow-sm"
      >
        {loading ? (
          <div className="w-full max-w-[800px] flex flex-col items-center">
            <Skeleton className="h-[1100px] w-full" />
          </div>
        ) : pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<Skeleton className="h-[1100px] w-full max-w-[800px]" />}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={<Skeleton className="h-[1100px] w-full max-w-[800px]" />}
            />
          </Document>
        ) : (
          <div className="flex flex-col items-center justify-center h-[600px]">
            <p className="text-gray-500">Document not found or unable to load</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
