
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2, FileText, MessageSquare, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ChatBot } from "@/components/ChatBot";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { findTextPositionInPage } from "@/utils/pdfUtils";

interface PolicyCategory {
  title: string;
}

interface PolicyDocument {
  id: string;
  file_name: string;
  file_path: string;
}

const PDFViewer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, refreshAdminStatus } = useAuth();
  const [category, setCategory] = useState<PolicyCategory | null>(null);
  const [document, setDocument] = useState<PolicyDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [highlightPosition, setHighlightPosition] = useState<any>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const highlightPage = searchParams.get('page');
  const shouldHighlight = searchParams.get('highlight') === 'true';
  const searchText = searchParams.get('text');

  useEffect(() => {
    refreshAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);
  
  useEffect(() => {
    if (pdfUrl && shouldHighlight && highlightPage && searchText) {
      highlightTextInPdf(parseInt(highlightPage, 10), searchText);
    }
  }, [pdfUrl, shouldHighlight, highlightPage, searchText]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch category information
      const { data: categoryData, error: categoryError } = await supabase
        .from('policy_categories')
        .select('title')
        .eq('id', id)
        .single();
      
      if (categoryError) throw categoryError;
      setCategory(categoryData);
      
      // Fetch document information
      const { data: documentData, error: documentError } = await supabase
        .from('policy_documents')
        .select('id, file_name, file_path')
        .eq('category_id', id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (documentError) throw documentError;
      
      if (documentData && documentData.length > 0) {
        setDocument(documentData[0]);
        
        // Get download URL for the PDF
        const { data: fileData, error: fileError } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(documentData[0].file_path, 3600);
        
        if (fileError) throw fileError;
        
        setPdfUrl(fileData?.signedUrl || null);
      } else {
        setDocument(null);
        setPdfUrl(null);
      }
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load policy data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const highlightTextInPdf = async (pageNum: number, text: string) => {
    if (!pdfUrl) return;
    
    try {
      const result = await findTextPositionInPage(pdfUrl, pageNum, text);
      if (result.found && result.position) {
        setHighlightPosition(result.position);
        
        // Handle iframe load event to apply highlight
        const iframe = iframeRef.current;
        if (iframe) {
          iframe.onload = () => {
            setTimeout(() => {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                // Create highlight overlay
                const highlightOverlay = document.createElement('div');
                highlightOverlay.style.position = 'absolute';
                highlightOverlay.style.left = `${result.position.startX}px`;
                highlightOverlay.style.top = `${result.position.startY}px`;
                highlightOverlay.style.width = `${result.position.endX - result.position.startX}px`;
                highlightOverlay.style.height = '20px';
                highlightOverlay.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
                highlightOverlay.style.zIndex = '1000';
                
                // Add to iframe document
                iframeDoc.body.appendChild(highlightOverlay);
              }
            }, 1500); // Give PDF time to render
          };
        }
      } else {
        console.log("Text position not found");
      }
    } catch (error) {
      console.error("Error highlighting text:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Categories
        </Button>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            <section className="text-center mb-8">
              <h1 className="text-black text-3xl font-bold mb-2">
                {category?.title} Document
              </h1>
              {isAdmin && (
                <div className="mt-4">
                  <p className="text-sm text-green-600 bg-green-50 p-2 rounded inline-block">
                    Admin Mode: To manage files, go to Admin Dashboard
                  </p>
                </div>
              )}
            </section>
            
            <div className="mb-4 flex justify-center gap-4">
              {isAdmin && (
                <Button 
                  onClick={() => navigate('/admin')}
                  className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
                >
                  Go to Admin Dashboard
                </Button>
              )}
              
              {pdfUrl && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <MessageSquare className="mr-2 h-4 w-4" /> Ask About This Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <div className="py-4">
                      <h2 className="text-xl font-semibold text-center mb-4">
                        Ask about {category?.title}
                      </h2>
                      <ChatBot />
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            
            {pdfUrl ? (
              <div className="border rounded-lg bg-gray-50 overflow-hidden">
                <div className="p-4 bg-gray-100 border-b flex justify-between items-center">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-700 mr-2" />
                    <h3 className="font-medium">{document?.file_name}</h3>
                  </div>
                  <div className="flex gap-2">
                    {highlightPage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-yellow-100 border-yellow-300 text-yellow-800"
                      >
                        <Search className="h-4 w-4 mr-1" /> Text Highlighted on Page {highlightPage}
                      </Button>
                    )}
                    <Button
                      onClick={() => window.open(pdfUrl, '_blank')}
                      variant="outline"
                      size="sm"
                    >
                      Open in New Tab
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <iframe
                    ref={iframeRef}
                    src={`${pdfUrl}${highlightPage ? '#page=' + highlightPage : ''}`}
                    className="w-full min-h-[70vh]"
                    title={`${category?.title} Document`}
                  />
                  {highlightPosition && (
                    <canvas 
                      ref={canvasRef} 
                      className="absolute top-0 left-0 pointer-events-none"
                      style={{
                        zIndex: 10,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center border rounded-lg bg-gray-50 min-h-[70vh] p-8">
                <div className="text-center">
                  <p className="text-xl font-medium text-gray-700 mb-4">No Document Available</p>
                  <p className="text-gray-500 max-w-md mx-auto">
                    {isAdmin 
                      ? "Go to the Admin Dashboard to upload a PDF document for this category."
                      : "There is no document available for this category yet."}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PDFViewer;
