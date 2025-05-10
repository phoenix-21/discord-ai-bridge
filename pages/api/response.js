import { supabase } from '../../lib/supabaseClient';

// Enhanced language detection configuration
const LANGUAGE_DETECTION = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'], // English
  de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich'], // German
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

// Special characters for different scripts
const SCRIPT_REGEX = {
  cjk: /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/,
  arabic: /[\u0600-\u06FF]/,
  hangul: /[\uac00-\ud7af]/,
  devanagari: /[\u0900-\u097F]/,
  cyrillic: /[\u0400-\u04FF]/
};

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages.' }] });

  const { id, message: originalMessage, translated_message } = data[0];
  
  if (translated_message) {
    return res.status(200).json({ 
      messages: [{ 
        response: translated_message, 
        original_language: 'unknown'
      }]
    });
  }

  try {
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842";

    // Enhanced language detection for mixed content
    function detectLanguageSegments(text) {
      if (!text) return [];
      
      // Split by language boundaries (punctuation, line breaks, etc.)
      const segments = text.split(/([.!?]\s+|[\n\r]+)/)
        .filter(segment => segment.trim().length > 0);
      
      return segments.map(segment => {
        // Check for script-based languages first
        for (const [script, lang] of [
          ['arabic', 'ar'],
          ['hangul', 'ko'],
          ['devanagari', 'hi'],
          ['cyrillic', 'ru']
        ]) {
          if (SCRIPT_REGEX[script].test(segment)) {
            return { text: segment, lang };
          }
        }
        
        // Check for CJK
        if (SCRIPT_REGEX.cjk.test(segment)) {
          const chineseChars = (segment.match(/[\u4e00-\u9fff]/g) || []).length;
          const japaneseChars = (segment.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
          return { 
            text: segment, 
            lang: chineseChars > japaneseChars ? 'zh' : 'ja'
          };
        }

        // Word-based detection for other languages
        const textLower = segment.toLowerCase();
        let bestMatch = { lang: null, score: 0 };
        
        for (const [lang, words] of Object.entries(LANGUAGE_DETECTION)) {
          const score = words.filter(word => 
            new RegExp(`\\b${word}\\b`).test(textLower)
          ).length;
          
          if (score > bestMatch.score) {
            bestMatch = { lang, score };
          }
        }
        
        return {
          text: segment,
          lang: bestMatch.score >= 3 ? bestMatch.lang : 'en' // Default to English if uncertain
        };
      });
    }

    // Process mixed-language content
    const languageSegments = detectLanguageSegments(originalMessage);
    
    // Group consecutive segments of same language
    const groupedSegments = [];
    let currentGroup = null;
    
    for (const segment of languageSegments) {
      if (!currentGroup || currentGroup.lang !== segment.lang) {
        currentGroup = { lang: segment.lang, text: segment.text };
        groupedSegments.push(currentGroup);
      } else {
        currentGroup.text += ' ' + segment.text;
      }
    }

    // Process each language group
    const processedSegments = await Promise.all(
      groupedSegments.map(async ({ lang, text }) => {
        // If English, return as-is
        if (lang === 'en') {
          return { text, lang };
        }
        
        // Translate non-English segments
        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${lang}|en&key=${MYMEMORY_API_KEY}`;
        const translateResponse = await fetch(translateUrl);
        
        if (!translateResponse.ok) {
          console.error(`Translation failed for ${lang}:`, text);
          return { text, lang };
        }
        
        const translateResult = await translateResponse.json();
        return {
          text: translateResult.responseData?.translatedText || text,
          lang
        };
      })
    );

    // Combine results
    const translatedText = processedSegments.map(s => s.text).join(' ');
    const detectedLangs = [...new Set(groupedSegments.map(s => s.lang))].join(',');
    
    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: detectedLangs
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: detectedLangs
      }]
    });
  } catch (err) {
    console.error('Translation error:', err);
    // Fallback - store original message
    await supabase
      .from('messages')
      .update({ 
        translated_message: originalMessage,
        original_language: 'mixed'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: originalMessage, 
        original_language: 'mixed'
      }]
    });
  }
}
