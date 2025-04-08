
import { DocumentSection } from '@/types/chat';

export const findBestMatch = (query: string, sections: DocumentSection[]): DocumentSection[] => {
  const queryNormalized = query.toLowerCase().replace(/[^\w\s]/g, '');
  const queryTokens = queryNormalized
    .split(/\s+/)
    .filter(word => word.length > 2)
    .map(word => word.trim());
    
  if (queryTokens.length === 0) return [];
  
  const importantKeywords = [
    'policy', 'procedure', 'regulation', 'rule', 'guideline', 
    'requirement', 'mandatory', 'prohibited', 'permission', 'approval',
    'student', 'faculty', 'staff', 'admin', 'academic', 'conduct', 'discipline'
  ];
  
  const weightedQueryTokens = queryTokens.map(token => ({
    token,
    weight: importantKeywords.includes(token) ? 2.0 : 1.0
  }));
  
  const scoredSections = sections.map(section => {
    const contentNormalized = section.content.toLowerCase().replace(/[^\w\s]/g, '');
    const titleNormalized = section.title.toLowerCase().replace(/[^\w\s]/g, '');
    
    let score = 0;
    
    weightedQueryTokens.forEach(({ token, weight }) => {
      if (titleNormalized.includes(token)) {
        score += 10 * weight;
        
        if (titleNormalized.includes(queryNormalized)) {
          score += 30;
        }
      }
    });
    
    weightedQueryTokens.forEach(({ token, weight }) => {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      const matches = (section.content.match(regex) || []).length;
      
      if (matches > 0) {
        score += Math.min(15, 5 + 2 * Math.log2(matches + 1)) * weight;
      }
    });
    
    if (section.articleNumber && section.sectionId) {
      score *= 1.2;
    }
    
    if (contentNormalized.includes(queryNormalized)) {
      score += 20;
    }
    
    if (queryTokens.length > 1) {
      const proximityBonus = calculateProximityScore(contentNormalized, queryTokens);
      score += proximityBonus;
    }
    
    return { section, score };
  });
  
  scoredSections.sort((a, b) => b.score - a.score);
  
  const significantMatches = scoredSections
    .filter(item => item.score > 5)
    .slice(0, 5)
    .map(item => item.section);
    
  console.log(`Found ${significantMatches.length} significant matches for query`);
  return significantMatches;
};

export const calculateProximityScore = (text: string, queryTokens: string[]): number => {
  let proximityScore = 0;
  
  const positions: Record<string, number[]> = {};
  
  queryTokens.forEach(token => {
    positions[token] = [];
    let pos = text.indexOf(token);
    while (pos !== -1) {
      positions[token].push(pos);
      pos = text.indexOf(token, pos + 1);
    }
  });
  
  const allTokensPresent = queryTokens.every(token => positions[token].length > 0);
  if (!allTokensPresent) return 0;
  
  const allPositions: {token: string, pos: number}[] = [];
  Object.entries(positions).forEach(([token, poses]) => {
    poses.forEach(pos => {
      allPositions.push({ token, pos });
    });
  });
  
  allPositions.sort((a, b) => a.pos - b.pos);
  
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
  
  if (minWindow < 100) {
    proximityScore = 15;
  } else if (minWindow < 300) {
    proximityScore = 10;
  } else if (minWindow < 600) {
    proximityScore = 5;
  }
  
  return proximityScore;
};
