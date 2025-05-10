import { supabase } from '../../lib/supabaseClient';

// Supported languages with common words for detection
const LANGUAGE_DETECTION = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'],
  es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se'],
  fr: ['le', 'la', 'de', 'un', 'à', 'être', 'et', 'en', 'avoir', 'que'],
  de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich']
};

const DEFAULT_SOURCE_LANG = 'es'; // Fallback to Spanish if detection fails

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

    // Improved language detection using word frequency
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
      
      // Only return if we have reasonable confidence
      return bestMatch.score >= 3 ? bestMatch.lang : null;
    }

    // Step 1: Detect language
    const detectedLang = detectLanguage(originalMessage);
    const sourceLang = detectedLang || DEFAULT_SOURCE_LANG;
    const isConfident = !!detectedLang;

    // Step 2: If detected as English, return original
    if (detectedLang === 'en') {
      await supabase
        .from('messages')
        .update({ 
          translated_message: originalMessage,
          original_language: 'en',
          detection_confidence: 'high'
        })
        .eq('id', id);

      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en',
          detection_confidence: 'high'
        }]
      });
    }

    // Step 3: Translate using detected or default language
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    
    const translateResponse = await fetch(translateUrl);
    if (!translateResponse.ok) {
      throw new Error(`API request failed with status ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.responseData?.translatedText || originalMessage;

    // Get final language (may differ from our detection)
    const finalLang = translateResult.responseData?.detectedSourceLanguage || sourceLang;

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: finalLang,
        detection_confidence: isConfident ? 'medium' : 'low'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: finalLang,
        detection_confidence: isConfident ? 'medium' : 'low'
      }]
    });
  } catch (err) {
    console.error('Translation error:', err);
    // Fallback - store original message
    await supabase
      .from('messages')
      .update({ 
        translated_message: originalMessage,
        original_language: 'unknown',
        detection_confidence: 'low'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: originalMessage, 
        original_language: 'unknown',
        detection_confidence: 'low'
      }]
    });
  }
}
