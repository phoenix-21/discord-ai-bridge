import { supabase } from '../../lib/supabaseClient';

// List of supported language codes for MyMemory
const SUPPORTED_LANGUAGES = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 
  'ar', 'nl', 'pl', 'sv', 'fi', 'da', 'no', 'he', 'hi', 'th'
]);

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

    // Improved language detection with multiple fallbacks
    async function detectLanguage(text) {
      try {
        // Try MyMemory detection first
        const detectUrl = `https://api.mymemory.translated.net/detect?q=${encodeURIComponent(text)}&key=${MYMEMORY_API_KEY}`;
        const detectResponse = await fetch(detectUrl);
        const detectResult = await detectResponse.json();
        
        // Check various response formats
        let detectedLang = detectResult.responseData?.detectedLanguage?.language ||
                         detectResult.responseData?.matches?.[0]?.language ||
                         detectResult.responseData?.detectedSourceLanguage;

        // Validate it's a supported 2-letter code
        if (detectedLang && SUPPORTED_LANGUAGES.has(detectedLang.toLowerCase())) {
          return detectedLang.toLowerCase();
        }

        // Fallback to simple English detection
        const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
        const isLikelyEnglish = englishWords.some(word => 
          new RegExp(`\\b${word}\\b`, 'i').test(text)
        );
        if (isLikelyEnglish) return 'en';

        // If still not detected, try a translation with generic language pair
        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=es|en&key=${MYMEMORY_API_KEY}`;
        const translateResponse = await fetch(translateUrl);
        const translateResult = await translateResponse.json();
        
        const finalLang = translateResult.responseData?.detectedSourceLanguage;
        if (finalLang && SUPPORTED_LANGUAGES.has(finalLang.toLowerCase())) {
          return finalLang.toLowerCase();
        }

        return null;
      } catch (e) {
        console.error('Language detection failed:', e);
        return null;
      }
    }

    // Detect language with our improved function
    let detectedLang = await detectLanguage(originalMessage);

    // If we can't detect, default to Spanish (most common case) but indicate uncertainty
    const sourceLang = detectedLang || 'es';
    const isLanguageCertain = !!detectedLang;

    // If detected as English, return original
    if (detectedLang === 'en') {
      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en',
          detection_confidence: 'high'
        }]
      });
    }

    // Translate using detected language
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    // Get the final translation and detected language
    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;
    const finalDetectedLang = translateResult.responseData?.detectedSourceLanguage || sourceLang;

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedMessage,
        original_language: finalDetectedLang,
        detection_confidence: isLanguageCertain ? 'high' : 'low'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedMessage, 
        original_language: finalDetectedLang,
        detection_confidence: isLanguageCertain ? 'high' : 'low'
      }]
    });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage
    });
  }
}
