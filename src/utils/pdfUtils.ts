
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist';

interface TextPositionResult {
  found: boolean;
  position?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
}

/**
 * Find text position in a PDF page
 * 
 * @param pdfUrl URL of the PDF document
 * @param pageNum Page number to search (1-based)
 * @param searchText Text to search for
 * @returns Object containing whether text was found and its position
 */
export async function findTextPositionInPage(
  pdfUrl: string, 
  pageNum: number, 
  searchText: string
): Promise<TextPositionResult> {
  try {
    const loadingTask = getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    
    // PDF page numbers are 1-based but methods require 0-based
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const searchTextLower = searchText.toLowerCase();
    
    // Iterate through text items to find a match
    for (const item of textContent.items) {
      const textItem = item as any;
      if (!textItem.str) continue;
      
      const itemText = textItem.str.toLowerCase();
      if (itemText.includes(searchTextLower)) {
        // Found a match, extract position
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Calculate position based on the transform and font size
        const tx = textItem.transform[4];
        const ty = textItem.transform[5];
        
        // Create a simple bounding box
        return {
          found: true,
          position: {
            startX: tx,
            startY: viewport.height - ty, // PDF coordinates are from bottom left
            endX: tx + (textItem.width || 100), // Width or default
            endY: viewport.height - ty + (textItem.height || 15) // Height or default
          }
        };
      }
    }
    
    // Text not found
    return { found: false };
  } catch (error) {
    console.error('Error finding text position:', error);
    return { found: false };
  }
}
