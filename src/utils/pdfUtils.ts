
import * as pdfjsLib from 'pdfjs-dist';
import { DocumentSection } from '@/types/chat';

export const extractTextFromPDF = async (pdfUrl: string): Promise<string> => {
  try {
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded with ${pdf.numPages} pages`);
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ');
        
      fullText += `--- PAGE ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`PDF extraction failed: ${error}`);
  }
};

export const extractDocumentSections = (text: string): DocumentSection[] => {
  const sections: DocumentSection[] = [];
  
  const articleRegex = /(?:ARTICLE|Article)\s+([IVX\d]+)(?:\s*[-:]\s*|\s+)(.*?)(?=\n|$)/gi;
  const sectionRegex = /(?:SECTION|Section)\s+(\d+(?:\.\d+)?(?:[A-Za-z])?)\s*[-:.]?\s*(.*?)(?=\n|$)/gi;
  const headingRegex = /(?:^|\n)((?:[A-Z][A-Za-z\s]+|[A-Z\s]+):?)(?=\n|$)/gm;
  const policyRegex = /(?:Policy|POLICY)\s+(?:Number|NUMBER)?\s*[:#]?\s*(\d+(?:\.\d+)?)/gi;
  
  const pageMarkers = text.match(/--- PAGE \d+ ---/g) || [];
  const pageTexts = text.split(/--- PAGE \d+ ---\n/).filter(Boolean);
  
  let currentArticle = '';
  let currentArticleTitle = '';

  pageTexts.forEach((pageText, pageIndex) => {
    const pageNumber = pageIndex + 1;
    
    let articleMatch;
    while ((articleMatch = articleRegex.exec(pageText)) !== null) {
      currentArticle = articleMatch[1];
      currentArticleTitle = articleMatch[2].trim();
      
      let articleContent = pageText.substring(articleMatch.index);
      const nextArticleMatch = new RegExp(articleRegex.source, 'gi');
      nextArticleMatch.lastIndex = articleMatch.index + articleMatch[0].length;
      const nextMatch = nextArticleMatch.exec(pageText);
      if (nextMatch) {
        articleContent = pageText.substring(articleMatch.index, nextMatch.index);
      }
      
      sections.push({
        title: `Article ${currentArticle}: ${currentArticleTitle}`,
        content: articleContent,
        pageNumber,
        articleNumber: currentArticle
      });
    }
    
    articleRegex.lastIndex = 0;
    
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(pageText)) !== null) {
      const sectionId = sectionMatch[1];
      const sectionTitle = sectionMatch[2].trim();
      
      let startIndex = sectionMatch.index;
      let endIndex = pageText.length;
      
      const nextSectionMatch = new RegExp(sectionRegex.source, 'gi');
      nextSectionMatch.lastIndex = startIndex + sectionMatch[0].length;
      const nextMatch = nextSectionMatch.exec(pageText);
      if (nextMatch) {
        endIndex = nextMatch.index;
      }
      
      const content = pageText.substring(startIndex, endIndex).trim();
      
      sections.push({
        title: `Section ${sectionId}: ${sectionTitle}`,
        content,
        pageNumber,
        articleNumber: currentArticle,
        sectionId
      });
    }
    
    sectionRegex.lastIndex = 0;
    
    let policyMatch;
    while ((policyMatch = policyRegex.exec(pageText)) !== null) {
      const policyId = policyMatch[1];
      
      const startPos = Math.max(0, policyMatch.index - 500);
      const endPos = Math.min(pageText.length, policyMatch.index + 1000);
      const policyContext = pageText.substring(startPos, endPos);
      
      const titleMatch = policyContext.match(/(?:Title|TITLE|Subject|SUBJECT):\s*([^\n]+)/i);
      const policyTitle = titleMatch ? titleMatch[1].trim() : `Policy ${policyId}`;
      
      sections.push({
        title: `Policy ${policyId}: ${policyTitle}`,
        content: policyContext,
        pageNumber,
        sectionId: policyId
      });
    }
    
    policyRegex.lastIndex = 0;
    
    if (!sections.some(s => s.pageNumber === pageNumber)) {
      let headingMatch;
      while ((headingMatch = headingRegex.exec(pageText)) !== null) {
        const headingTitle = headingMatch[1].trim();
        
        let startIndex = headingMatch.index;
        let endIndex = pageText.length;
        
        const nextHeadingMatch = new RegExp(headingRegex.source, 'gm');
        nextHeadingMatch.lastIndex = startIndex + headingMatch[0].length;
        const nextMatch = nextHeadingMatch.exec(pageText);
        if (nextMatch) {
          endIndex = nextMatch.index;
        }
        
        const content = pageText.substring(startIndex, endIndex).trim();
        
        sections.push({
          title: headingTitle,
          content,
          pageNumber
        });
      }
      
      if (!sections.some(s => s.pageNumber === pageNumber)) {
        const paragraphs = pageText.split(/\n\s*\n/);
        let currentChunk = '';
        let chunkNumber = 1;
        
        paragraphs.forEach(paragraph => {
          if (currentChunk.length + paragraph.length > 1000) {
            sections.push({
              title: `Page ${pageNumber} - Part ${chunkNumber}`,
              content: currentChunk,
              pageNumber
            });
            chunkNumber++;
            currentChunk = paragraph;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          }
        });
        
        if (currentChunk) {
          sections.push({
            title: `Page ${pageNumber} - Part ${chunkNumber}`,
            content: currentChunk,
            pageNumber
          });
        }
      }
    }
  });
  
  console.log(`Extracted ${sections.length} sections from document`);
  return sections;
};
