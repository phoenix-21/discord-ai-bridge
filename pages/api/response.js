// Updated German detection configuration
const LANGUAGE_DETECTION = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'],
  de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich', 
       'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'sie', 'Sie', // pronouns
       'nicht', 'auch', 'auf', 'für', 'ist', 'bin', 'sind', 'war', 'hat', // verbs
       'ein', 'eine', 'einen', 'dem', 'des', 'im', 'am', 'um', 'bei', 'nach' // articles/prepositions
      ],
  ar: ['ال', 'في', 'من', 'على', 'أن', 'هو', 'إلى', 'كان', 'هذا', 'مع'], // Arabic
  pt: ['o', 'a', 'de', 'e', 'que', 'em', 'do', 'da', 'para', 'com'], // Portuguese
  hi: ['और', 'से', 'है', 'की', 'में', 'हैं', 'को', 'पर', 'यह', 'था'], // Hindi
  it: ['il', 'la', 'di', 'e', 'che', 'in', 'un', 'a', 'per', 'con'], // Italian
  ko: ['이', '그', '에', '를', '의', '은', '는', '과', '와', '하다'], // Korean
  tl: ['ang', 'ng', 'sa', 'na', 'ay', 'at', 'mga', 'si', 'ito', 'ni'], // Filipino (Tagalog)
  zh: ['的', '一', '是', '在', '不', '了', '有', '和', '人', '这'], // Chinese
  ja: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'し', 'て', 'ます'], // Japanese
  ru: ['и', 'в', 'не', 'на', 'я', 'что', 'он', 'с', 'по', 'как'], // Russian
  es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se']  // Spanish
};

// ... rest of the imports and constants remain the same

// Modified detectLanguage function
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return null;
  
  // Check for special scripts first (unchanged)
  if (ARABIC_REGEX.test(text)) return 'ar';
  if (HANGUL_REGEX.test(text)) return 'ko';
  if (DEVANAGARI_REGEX.test(text)) return 'hi';
  if (CJK_REGEX.test(text)) {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
    
    if (chineseChars > japaneseChars) return 'zh';
    if (japaneseChars > 0) return 'ja';
  }
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';

  const textLower = text.toLowerCase();
  let bestMatch = { lang: null, score: 0 };
  
  for (const [lang, words] of Object.entries(LANGUAGE_DETECTION)) {
    if (['zh', 'ja', 'ko', 'hi', 'ar'].includes(lang)) continue;
    
    // Improved word matching for German
    const score = words.reduce((count, word) => {
      // Match word boundaries or word with common German suffixes
      const pattern = lang === 'de' 
        ? new RegExp(`(\\b${word}([\\s\\.,!?]|\\b)|${word}(en|er|em|es|e)\\b)`, 'i')
        : new RegExp(`\\b${word}\\b`, 'i');
      return count + (pattern.test(textLower) ? 1 : 0);
    }, 0);
    
    if (score > bestMatch.score) {
      bestMatch = { lang, score };
    }
  }
  
  // Lower threshold for German (2 matches instead of 3)
  if (bestMatch.lang === 'de' && bestMatch.score >= 2) return 'de';
  
  // Keep higher threshold for other languages
  return bestMatch.score >= 3 ? bestMatch.lang : null;
}

// ... rest of the handler function remains the same
