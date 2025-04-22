
import { DocumentSection } from '@/types/chat';

export const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection[] => {
  console.log(`Finding best match among ${sections.length} sections for query: "${query}"`);
  
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
  
  // Identify important keywords that should have higher weight in matching
  const importantKeywords = [
    'policy', 'procedure', 'regulation', 'rule', 'guideline', 
    'requirement', 'mandatory', 'prohibited', 'permission', 'approval',
    'student', 'faculty', 'staff', 'admin', 'academic', 'conduct', 'discipline',
    'degree', 'course', 'program', 'curriculum', 'grade', 'admission',
    'graduation', 'scholarship', 'financial', 'attendance', 'enrollment',
    'registration', 'withdraw', 'tuition', 'fee', 'payment', 'deadline',
    'application', 'transfer', 'credit', 'exam', 'test', 'assessment'
  ];
  
  // Assign weights to query tokens, with higher weights for important keywords
  const weightedQueryTokens = queryTokens.map(token => ({
    token,
    weight: importantKeywords.includes(token) ? 2.0 : 1.0
  }));
  
  // Score each section based on multiple factors
  const scoredSections = sections.map(section => {
    // Normalize content and title for consistent matching
    const contentNormalized = section.content.toLowerCase().replace(/[^\w\s]/g, '');
    const titleNormalized = section.title.toLowerCase().replace(/[^\w\s]/g, '');
    
    let score = 0;
    
    // Give high boost if query tokens appear in title
    weightedQueryTokens.forEach(({ token, weight }) => {
      if (titleNormalized.includes(token)) {
        score += 15 * weight; // Higher weight for title matches
        
        // Extra boost for exact phrase match in title
        if (titleNormalized.includes(queryNormalized)) {
          score += 40;
        }
      }
    });
    
    // Score based on token frequency in content
    weightedQueryTokens.forEach(({ token, weight }) => {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = (section.content.match(regex) || []).length;
      
      if (matches > 0) {
        // Logarithmic scaling for multiple matches to avoid overvaluing repetition
        score += Math.min(20, 5 + 3 * Math.log2(matches + 1)) * weight;
      }
    });
    
    // Boost if section has structure (article/section numbers)
    if (section.articleNumber && section.sectionId) {
      score *= 1.25; // 25% boost for structured content
    }
    
    // Significant boost for exact phrase match in content
    if (contentNormalized.includes(queryNormalized)) {
      score += 30;
    }
    
    // Add proximity score for multi-token queries
    if (queryTokens.length > 1) {
      const proximityBonus = calculateProximityScore(contentNormalized, queryTokens);
      score += proximityBonus;
    }
    
    // Small bonus for shorter, more focused sections (avoid massive text blocks)
    if (section.content.length < 1000 && section.content.length > 100) {
      score += 5;
    }
    
    return { section, score };
  });
  
  // Sort by score in descending order
  scoredSections.sort((a, b) => b.score - a.score);
  
  // Filter out low-scoring sections and take top results
  const significantMatches = scoredSections
    .filter(item => item.score > 10) // Higher threshold for relevance
    .slice(0, 8) // Take more matches for better context
    .map(item => {
      console.log(`Match: "${item.section.title}" with score ${item.score.toFixed(2)}`);
      return item.section;
    });
    
  console.log(`Found ${significantMatches.length} significant matches for query`);
  return significantMatches;
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
  
  // Score based on proximity window size
  if (minWindow < 50) {
    proximityScore = 25; // Very close tokens get highest score
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
