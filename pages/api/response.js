import { supabase } from '../../lib/supabaseClient';

// Language detection configuration (without German)
const LANGUAGE_DETECTION = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'],
  ar: ['ال', 'في', 'من', 'على', 'أن', 'هو', 'إلى', 'كان', 'هذا', 'مع'],
  pt: ['o', 'a', 'de', 'e', 'que', 'em', 'do', 'da', 'para', 'com'],
  hi: ['और', 'से', 'है', 'की', 'में', 'हैं', 'को', 'पर', 'यह', 'था'],
  it: ['il', 'la', 'di', 'e', 'che', 'in', 'un', 'a', 'per', 'con'],
  ko: ['이', '그', '에', '를', '의', '은', '는', '과', '와', '하다'],
  tl: ['ang', 'ng', 'sa', 'na', 'ay', 'at', 'mga', 'si', 'ito', 'ni'],
  zh: ['的', '一', '是', '在', '不', '了', '有', '和', '人', '这'],
  ja: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'し', 'て', 'ます'],
  ru: ['и', 'в', 'не', 'на', 'я', 'что', 'он', 'с', 'по', 'как'],
  es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se']
};

// Special characters regex
const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
const ARABIC_REGEX = /[\u0600-\u06FF]/;
const HANGUL_REGEX = /[\uac00-\ud7af]/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

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

    function detectLanguage(text) {
      if (!text || typeof text !== 'string') return null;
      
      // Check for special scripts first
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
        
        const score = words.filter(word => 
          new RegExp(`\\b${word}\\b`).test(textLower)
        ).length;
        
        if (score > bestMatch.score) {
          bestMatch = { lang, score };
        }
      }
      
      return bestMatch.score >= 3 ? bestMatch.lang : null;
    }

    // Step 1: Detect language (won't detect German)
    const detectedLang = detectLanguage(originalMessage);
    
    // Step 2: If message is English, return as-is
    if (detectedLang === 'en') {
      await supabase
        .from('messages')
        .update({ 
          translated_message: originalMessage,
          original_language: 'en'
        })
        .eq('id', id);

      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en'
        }]
      });
    }

    // Step 3: For non-English messages or undetected messages (including German)
    let sourceLang = detectedLang;
    let translationNeeded = true;

    // Additional English check if detection failed
    if (!sourceLang) {
      const englishWordCount = LANGUAGE_DETECTION.en.filter(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(originalMessage)
      ).length;
      const wordCount = originalMessage.split(/\s+/).length || 1;
      
      if ((englishWordCount / wordCount) > 0.3) {
        sourceLang = 'en';
        translationNeeded = false;
      } else {
        // If we can't detect, default to German ('de') since that's what we want to translate
        sourceLang = 'de';
      }
    }

    // If no translation needed (it's English)
    if (!translationNeeded) {
      await supabase
        .from('messages')
        .update({ 
          translated_message: originalMessage,
          original_language: 'en'
        })
        .eq('id', id);

      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en'
        }]
      });
    }

    // Step 4: Translate to English
    // Use detected language if available, otherwise default to German
    const langPair = sourceLang ? `${sourceLang}|en` : 'de|en';
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${langPair}&key=${MYMEMORY_API_KEY}`;
    
    const translateResponse = await fetch(translateUrl);
    if (!translateResponse.ok) {
      throw new Error(`API request failed with status ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.responseData?.translatedText || originalMessage;
    const finalSourceLang = translateResult.responseData?.detectedSourceLanguage || sourceLang || 'de';

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: finalSourceLang
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: finalSourceLang
      }]
    });
  } catch (err) {
    console.error('Translation error:', err);
    // Fallback - store original message
    await supabase
      .from('messages')
      .update({ 
        translated_message: originalMessage,
        original_language: 'unknown'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: originalMessage, 
        original_language: 'unknown'
      }]
    });
  }
}
