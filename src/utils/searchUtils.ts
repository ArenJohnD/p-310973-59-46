
import { DocumentSection } from '@/types/chat';

export const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection[] => {
  console.log(`Finding best match among ${sections.length} sections for query: "${query}"`);
  
  // Early exit if no sections or empty query
  if (!sections.length || !query.trim()) {
    console.log("No sections to search or empty query");
    return [];
  }
  
  // Normalize the query for consistent matching
  const queryNormalized = query.toLowerCase().replace(/[^\w\s]/g, '');
  const queryTokens = queryNormalized
    .split(/\s+/)
    .filter(word => word.length > 2)
    .map(word => word.trim());
    
  if (queryTokens.length === 0) {
    console.log("No valid query tokens found after normalization");
    return [];
  }
  
  console.log(`Query tokens: [${queryTokens.join(', ')}]`);
  
  // Extract question type to improve matching
  const questionType = detectQuestionType(query);
  console.log(`Detected question type: ${questionType}`);
  
  // Identify important keywords that should have higher weight in matching
  const importantKeywords = [
    'policy', 'procedure', 'regulation', 'rule', 'guideline', 
    'requirement', 'mandatory', 'prohibited', 'permission', 'approval',
    'student', 'faculty', 'staff', 'admin', 'academic', 'conduct', 'discipline',
    'degree', 'course', 'program', 'curriculum', 'grade', 'admission',
    'graduation', 'scholarship', 'financial', 'attendance', 'enrollment',
    'registration', 'withdraw', 'tuition', 'fee', 'payment', 'deadline',
    'application', 'transfer', 'credit', 'exam', 'test', 'assessment',
    // Add more domain-specific keywords for education policies
    'absence', 'uniform', 'dress code', 'behavior', 'violation', 
    'sanction', 'penalty', 'dismissal', 'suspension', 'expulsion',
    'grievance', 'appeal', 'complaint', 'guidance', 'counseling'
  ];
  
  // Assign weights to query tokens, with higher weights for important keywords
  const weightedQueryTokens = queryTokens.map(token => ({
    token,
    weight: importantKeywords.includes(token) ? 2.5 : 1.0
  }));
  
  // Add exact phrase matching for better precision
  const exactPhrases = extractExactPhrases(query);
  if (exactPhrases.length > 0) {
    console.log(`Extracted exact phrases: [${exactPhrases.join(', ')}]`);
  }
  
  // Score each section based on multiple factors
  const scoredSections = sections.map(section => {
    // Normalize content and title for consistent matching
    const contentNormalized = section.content.toLowerCase().replace(/[^\w\s]/g, '');
    const titleNormalized = section.title.toLowerCase().replace(/[^\w\s]/g, '');
    
    let score = 0;
    
    // Exact phrase matching (highest priority)
    for (const phrase of exactPhrases) {
      const phraseNormalized = phrase.toLowerCase();
      if (contentNormalized.includes(phraseNormalized)) {
        score += 50; // Heavy bonus for exact phrase match
        // Even higher if it appears in the title
        if (titleNormalized.includes(phraseNormalized)) {
          score += 30;
        }
      }
    }
    
    // Question type matching
    if (questionType && sectionMatchesQuestionType(section, questionType)) {
      score += 20; // Significant boost if section matches question type
    }
    
    // Give high boost if query tokens appear in title
    weightedQueryTokens.forEach(({ token, weight }) => {
      if (titleNormalized.includes(token)) {
        score += 20 * weight; // Higher weight for title matches
        
        // Extra boost for exact phrase match in title
        if (titleNormalized.includes(queryNormalized)) {
          score += 40;
        }
      }
    });
    
    // Score based on token frequency and position in content
    weightedQueryTokens.forEach(({ token, weight }) => {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = (section.content.match(regex) || []).length;
      
      if (matches > 0) {
        // Logarithmic scaling for multiple matches to avoid overvaluing repetition
        score += Math.min(25, 8 + 4 * Math.log2(matches + 1)) * weight;
        
        // Check if token appears in first paragraph (likely more relevant)
        const firstParagraph = section.content.split('\n\n')[0] || '';
        if (firstParagraph.toLowerCase().includes(token)) {
          score += 5 * weight;
        }
      }
    });
    
    // Boost if section has structure (article/section numbers)
    if (section.articleNumber && section.sectionId) {
      score *= 1.3; // 30% boost for structured content
    }
    
    // Significant boost for exact phrase match in content
    if (contentNormalized.includes(queryNormalized)) {
      score += 35;
    }
    
    // Check for regex patterns that indicate policy statements or definitions
    if (/shall|must|required|prohibited|not allowed|mandatory/i.test(section.content)) {
      if (queryTokens.some(token => 
          /rule|policy|allowed|can|cannot|restriction/i.test(token))) {
        score += 15; // Boost for policy-related content when query asks about rules
      }
    }
    
    // Add proximity score for multi-token queries
    if (queryTokens.length > 1) {
      const proximityBonus = calculateProximityScore(contentNormalized, queryTokens);
      score += proximityBonus;
    }
    
    // Consider document metadata and length characteristics
    if (section.fileName && isRelevantDocType(section.fileName, query)) {
      score *= 1.2; // Boost sections from relevant document types
    }
    
    // Small bonus for shorter, more focused sections (avoid massive text blocks)
    if (section.content.length < 1000 && section.content.length > 100) {
      score += 8;
    } else if (section.content.length > 3000) {
      score *= 0.85; // Slight penalty for extremely long sections
    }
    
    return { section, score };
  });
  
  // Sort by score in descending order
  scoredSections.sort((a, b) => b.score - a.score);
  
  // Log top scores for debugging
  const topScores = scoredSections.slice(0, 5).map(item => 
    `"${item.section.title.substring(0, 30)}..." (score: ${item.score.toFixed(2)})`
  );
  console.log("Top scoring sections:");
  topScores.forEach(score => console.log(`- ${score}`));
  
  // Filter out low-scoring sections and take top results
  const significantMatches = scoredSections
    .filter(item => item.score > 15) // Higher threshold for relevance
    .slice(0, 8) // Take more matches for better context
    .map(item => {
      console.log(`Match: "${item.section.title}" with score ${item.score.toFixed(2)}`);
      return item.section;
    });
    
  console.log(`Found ${significantMatches.length} significant matches for query`);
  return significantMatches;
};

// Helper function to detect question type
const detectQuestionType = (query: string): string | null => {
  const lowerQuery = query.toLowerCase();
  
  if (/what|definition|describe|explain|tell me about/i.test(lowerQuery)) {
    return 'definition';
  } else if (/how|process|procedure|steps|way to/i.test(lowerQuery)) {
    return 'process';
  } else if (/when|date|deadline|schedule|time/i.test(lowerQuery)) {
    return 'timing';
  } else if (/why|reason|purpose|rationale/i.test(lowerQuery)) {
    return 'reason';
  } else if (/who|person|department|office|contact/i.test(lowerQuery)) {
    return 'person';
  } else if (/where|location|place|campus|building/i.test(lowerQuery)) {
    return 'location';
  } else if (/can|allow|permit|may|possible/i.test(lowerQuery)) {
    return 'permission';
  } else if (/requirement|criteria|eligible|qualify/i.test(lowerQuery)) {
    return 'requirement';
  } else if (/penalty|sanction|punishment|consequence|disciplinary/i.test(lowerQuery)) {
    return 'penalty';
  }
  
  return null;
};

// Helper function to check if section matches question type
const sectionMatchesQuestionType = (section: DocumentSection, questionType: string): boolean => {
  const content = section.content.toLowerCase();
  const title = section.title.toLowerCase();
  
  switch (questionType) {
    case 'definition':
      return /define|definition|mean|refer|called/i.test(content) || 
             /definition|glossary|terms/i.test(title);
    case 'process':
      return /process|procedure|steps|follow|guideline|how to/i.test(content) ||
             /process|procedure|guideline|protocol/i.test(title);
    case 'timing':
      return /date|deadline|schedule|period|semester|week|month|day|time/i.test(content) ||
             /schedule|calendar|deadline|date/i.test(title);
    case 'reason':
      return /because|reason|purpose|in order to|objective/i.test(content) ||
             /purpose|objective|rationale/i.test(title);
    case 'person':
      return /department|office|director|dean|president|coordinator|counselor|staff/i.test(content) ||
             /department|office|personnel|staff/i.test(title);
    case 'location':
      return /building|room|hall|campus|location|area|facility/i.test(content) ||
             /location|venue|facilities/i.test(title);
    case 'permission':
      return /permit|allow|may|can|authorize|approve/i.test(content) ||
             /permission|authorization|approval/i.test(title);
    case 'requirement':
      return /require|must|should|need|necessary|mandatory/i.test(content) ||
             /requirement|prerequisite|criteria/i.test(title);
    case 'penalty':
      return /penalty|sanction|disciplinary|punish|violation|offense/i.test(content) ||
             /penalty|sanction|violation|discipline/i.test(title);
    default:
      return false;
  }
};

// Helper function to extract exact phrases from quoted text in query
const extractExactPhrases = (query: string): string[] => {
  const phrases: string[] = [];
  const quoteRegex = /"([^"]*)"/g;
  
  let match;
  while ((match = quoteRegex.exec(query)) !== null) {
    if (match[1] && match[1].trim().length > 0) {
      phrases.push(match[1].trim());
    }
  }
  
  // If no quoted phrases but query has more than 3 words, consider the whole query as a phrase
  if (phrases.length === 0) {
    const words = query.trim().split(/\s+/);
    if (words.length >= 3) {
      phrases.push(query.trim());
    }
  }
  
  return phrases;
};

// Check if document type is relevant to query
const isRelevantDocType = (fileName: string, query: string): boolean => {
  const lowerFileName = fileName.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Check for student handbook when asking about student policies
  if (/student|attendance|uniform|behavior|conduct/i.test(lowerQuery) && 
      /handbook|manual|guide|student/i.test(lowerFileName)) {
    return true;
  }
  
  // Check for academic policies when asking about academic matters
  if (/academic|course|grade|credit|enrollment|registration/i.test(lowerQuery) && 
      /academic|policy|regulation/i.test(lowerFileName)) {
    return true;
  }
  
  // Check for financial documents when asking about fees
  if (/fee|payment|tuition|financial|scholarship/i.test(lowerQuery) && 
      /fee|financ|payment|tuition/i.test(lowerFileName)) {
    return true;
  }
  
  // Generic policy match
  if (/policy|rule|regulation/i.test(lowerQuery) && 
      /policy|rule|regulation/i.test(lowerFileName)) {
    return true;
  }
  
  return false;
};

export const calculateProximityScore = (text: string, queryTokens: string[]): number => {
  let proximityScore = 0;
  
  // Find positions of all tokens in the text
  const positions: Record<string, number[]> = {};
  
  queryTokens.forEach(token => {
    positions[token] = [];
    let pos = text.indexOf(token);
    while (pos !== -1) {
      positions[token].push(pos);
      pos = text.indexOf(token, pos + 1);
    }
  });
  
  // Check if all tokens are present
  const allTokensPresent = queryTokens.every(token => positions[token].length > 0);
  if (!allTokensPresent) return 0;
  
  // Create a list of all token positions
  const allPositions: {token: string, pos: number}[] = [];
  Object.entries(positions).forEach(([token, poses]) => {
    poses.forEach(pos => {
      allPositions.push({ token, pos });
    });
  });
  
  // Sort by position
  allPositions.sort((a, b) => a.pos - b.pos);
  
  // Find minimum window that contains all tokens
  let minWindow = Number.MAX_SAFE_INTEGER;
  
  for (let i = 0; i < allPositions.length; i++) {
    const tokensInWindow = new Set<string>();
    tokensInWindow.add(allPositions[i].token);
    
    for (let j = i + 1; j < allPositions.length; j++) {
      tokensInWindow.add(allPositions[j].token);
      
      if (tokensInWindow.size === queryTokens.length) {
        const windowSize = allPositions[j].pos - allPositions[i].pos + 1;
        minWindow = Math.min(minWindow, windowSize);
        break;
      }
    }
  }
  
  // Score based on proximity window size - smaller windows get higher scores
  if (minWindow < 30) {
    proximityScore = 30; // Very close tokens get highest score
  } else if (minWindow < 60) {
    proximityScore = 25;
  } else if (minWindow < 100) {
    proximityScore = 20;
  } else if (minWindow < 200) {
    proximityScore = 15;
  } else if (minWindow < 500) {
    proximityScore = 10;
  } else if (minWindow < 1000) {
    proximityScore = 5;
  }
  
  return proximityScore;
};
