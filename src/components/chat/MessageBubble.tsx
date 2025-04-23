
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { Message, Citation } from '@/types/chat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface MessageBubbleProps {
  message: Message;
  citations?: Citation[];
  onCitationClick?: (citation: Citation) => void;
}

export const MessageBubble = ({ message, citations = [], onCitationClick }: MessageBubbleProps) => {
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLinkClick = (href: string) => {
    if (href.startsWith('citation-')) {
      const citationId = href;
      const citation = citations.find(c => c.id === citationId);
      if (citation) {
        if (onCitationClick) {
          onCitationClick(citation);
        } else {
          setSelectedCitation(citation);
        }
      }
      return true; // Prevent default link behavior
    }
    return false; // Use default link behavior
  };

  const handleViewDocument = async (citation?: Citation | null) => {
    const citationToUse = citation ?? selectedCitation;
    if (!citationToUse || !citationToUse.documentId) return;

    try {
      setIsLoading(true);

      // Get the file path from reference_documents table
      const { data: documentData, error: documentError } = await supabase
        .from('reference_documents')
        .select('file_path, file_name')
        .eq('id', citationToUse.documentId)
        .single();

      if (documentError) throw documentError;

      if (documentData) {
        // Get a signed URL for the document
        const { data: fileData, error: fileError } = await supabase.storage
          .from('policy_documents')
          .createSignedUrl(documentData.file_path, 3600);

        if (fileError) throw fileError;

        if (fileData?.signedUrl) {
          // Open the document in a new tab
          window.open(fileData.signedUrl, '_blank');
          // Close the dialog if triggered from modal
          setSelectedCitation(null);
        } else {
          throw new Error("Couldn't generate URL for the document");
        }
      } else {
        throw new Error("Document not found");
      }
    } catch (error) {
      console.error("Error opening document:", error);
      toast({
        title: "Error",
        description: "Failed to open the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Find the first valid citation with a document
  const firstCitation = citations?.find(c => c.documentId);

  // Determine if there are any citations with a document
  const hasCitationsWithDocument = citations && citations.length > 0 && firstCitation?.documentId;

  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-[20px] px-4 py-3 ${message.sender === "user"
          ? "bg-[rgba(49,159,67,0.1)] text-black"
          : "bg-[rgba(49,159,67,1)] text-white"
          }`}
      >
        {message.sender === "bot" ? (
          <div className="markdown-content">
            <ReactMarkdown
              className="text-[16px] whitespace-pre-line"
              components={{
                a: ({ href, children }) => {
                  if (href && handleLinkClick(href)) {
                    return (
                      <Button
                        variant="link"
                        className="p-0 h-auto font-semibold underline text-blue-200"
                        onClick={() => {
                          const citation = citations.find(c => c.id === href);
                          if (citation && onCitationClick) {
                            onCitationClick(citation);
                          } else if (citation) {
                            setSelectedCitation(citation);
                          }
                        }}
                      >
                        {children}
                      </Button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline flex items-center">
                      {children}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  );
                }
              }}
            >
              {message.text}
            </ReactMarkdown>

            {/* Show appended 'View Source Document' hyperlink at end of message if there are citations */}
            {hasCitationsWithDocument && (
              <div className="mt-4 flex flex-col gap-1">
                <Button
                  variant="link"
                  className="p-0 h-auto underline font-semibold flex items-center text-sm text-blue-200"
                  onClick={() => handleViewDocument(firstCitation)}
                  disabled={isLoading}
                  aria-label="View Source Document"
                  title={`View ${firstCitation.fileName || "Policy Document"} in full`}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  {isLoading ? "Loading..." : "View Source Document"}
                  {firstCitation.fileName ? (
                    <span className="ml-1">
                      ({firstCitation.fileName}{firstCitation.position?.startPage ? `, p.${firstCitation.position.startPage}` : ''})
                    </span>
                  ) : null}
                  <ExternalLink className="h-4 w-4 ml-1" />
                </Button>
                {citations.length > 1 && (
                  <span className="text-xs text-inherit opacity-80 ml-1">
                    This answer may contain references from multiple source documents.
                  </span>
                )}
              </div>
            )}

          </div>
        ) : (
          <p className="text-[16px] whitespace-pre-line">{message.text}</p>
        )}
        <p className="text-[12px] opacity-70 mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {selectedCitation && (
        <Dialog open={!!selectedCitation} onOpenChange={() => setSelectedCitation(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedCitation.reference}</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {selectedCitation.documentId ? (
                <div className="flex flex-col gap-2">
                  <p>This citation can be found in:</p>
                  <p className="font-semibold">{selectedCitation.fileName || "Policy Document"}</p>
                  {selectedCitation.position && (
                    <p>Page: {selectedCitation.position.startPage}</p>
                  )}

                  <Button
                    onClick={() => handleViewDocument(selectedCitation)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "View Document"} <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p>No detailed location information is available for this citation.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
