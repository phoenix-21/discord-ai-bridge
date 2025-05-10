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

    // First check if the message is likely English
    function isLikelyEnglish(text) {
      const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
      const wordCount = text.split(/\s+/).length;
      const englishWordCount = englishWords.filter(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(text)
      ).length;
      return (englishWordCount / wordCount) > 0.3; // 30% English words
    }

    // Step 1: Check if message is English
    if (isLikelyEnglish(originalMessage)) {
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

    // Step 2: Try translation with generic language pair to get detection
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=auto|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    // Get detected language from translation response
    let detectedLang = translateResult.responseData?.detectedSourceLanguage;
    
    // Validate the detected language
    if (!detectedLang || !SUPPORTED_LANGUAGES.has(detectedLang.toLowerCase())) {
      detectedLang = null;
    }

    // Step 3: If we got a valid detection, use it for a more accurate translation
    let finalTranslation = translateResult.responseData?.translatedText || originalMessage;
    let finalLang = detectedLang || 'unknown';
    let confidence = detectedLang ? 'medium' : 'low';

    if (detectedLang && detectedLang !== 'en') {
      // Retry with the detected language for better quality
      const refinedUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
      const refinedResponse = await fetch(refinedUrl);
      const refinedResult = await refinedResponse.json();
      
      if (refinedResult.responseData?.translatedText) {
        finalTranslation = refinedResult.responseData.translatedText;
        confidence = 'high';
      }
    }

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: finalTranslation,
        original_language: finalLang,
        detection_confidence: confidence
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: finalTranslation, 
        original_language: finalLang,
        detection_confidence: confidence
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
