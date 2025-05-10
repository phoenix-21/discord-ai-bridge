import { supabase } from '../../lib/supabaseClient';

// Enhanced language detection configuration
const ENGLISH_WORDS = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
const GERMAN_WORDS = ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich'];
const SPANISH_WORDS = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se'];
const FRENCH_WORDS = ['le', 'la', 'de', 'un', 'à', 'être', 'et', 'en', 'avoir', 'que'];

const LANGUAGE_DETECTION = {
  en: ENGLISH_WORDS,
  de: GERMAN_WORDS,
  es: SPANISH_WORDS,
  fr: FRENCH_WORDS
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

    // Improved language detection function
    function detectLanguage(text) {
      if (!text || typeof text !== 'string') return null;
      
      const textLower = text.toLowerCase();
      let bestMatch = { lang: null, score: 0 };
      
      for (const [lang, words] of Object.entries(LANGUAGE_DETECTION)) {
        const score = words.filter(word => 
          new RegExp(`\\b${word}\\b`).test(textLower)
        ).length;
        
        if (score > bestMatch.score) {
          bestMatch = { lang, score };
        }
      }
      
      // Only return if we have reasonable confidence (at least 3 matches)
      return bestMatch.score >= 3 ? bestMatch.lang : null;
    }

    // Step 1: Detect language
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

    // Step 3: For non-English messages (German, Spanish, French), translate to English
    let sourceLang = detectedLang;
    let translationNeeded = true;

    // If we couldn't detect the language, try to determine if it's English
    if (!sourceLang) {
      const englishWordCount = ENGLISH_WORDS.filter(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(originalMessage)
      ).length;
      const wordCount = originalMessage.split(/\s+/).length || 1;
      
      if ((englishWordCount / wordCount) > 0.3) {
        sourceLang = 'en';
        translationNeeded = false;
      } else {
        // Fallback to most common languages we want to translate
        sourceLang = 'de'; // Default to German if uncertain
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
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    
    const translateResponse = await fetch(translateUrl);
    if (!translateResponse.ok) {
      throw new Error(`API request failed with status ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.responseData?.translatedText || originalMessage;
    const finalSourceLang = translateResult.responseData?.detectedSourceLanguage || sourceLang;

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
