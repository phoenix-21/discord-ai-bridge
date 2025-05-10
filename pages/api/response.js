import { supabase } from '../../lib/supabaseClient';

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
      if (!text || typeof text !== 'string') return false;
      const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
      const wordCount = text.split(/\s+/).length;
      if (wordCount === 0) return false;
      
      const englishWordCount = englishWords.filter(word => 
        new RegExp(`\\b${word}\\b`, 'i').test(text)
      ).length;
      return (englishWordCount / wordCount) > 0.3;
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

    // Step 2: Use translation endpoint which also detects language
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=auto|en&key=${MYMEMORY_API_KEY}`;
    
    const translateResponse = await fetch(translateUrl);
    if (!translateResponse.ok) {
      throw new Error(`Translation API failed with status ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json().catch(e => {
      console.error('JSON parse error:', e);
      throw new Error('Invalid API response format');
    });

    // Get detected language and translation
    const detectedLang = translateResult.responseData?.detectedSourceLanguage;
    const translatedText = translateResult.responseData?.translatedText || originalMessage;

    // Validate detected language
    const validLang = detectedLang && SUPPORTED_LANGUAGES.has(detectedLang.toLowerCase()) 
      ? detectedLang.toLowerCase() 
      : 'unknown';

    // If detected as English but our initial check missed it, trust the API more
    if (validLang === 'en') {
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

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: validLang,
        detection_confidence: validLang !== 'unknown' ? 'medium' : 'low'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: validLang,
        detection_confidence: validLang !== 'unknown' ? 'medium' : 'low'
      }]
    });
  } catch (err) {
    console.error('Translation error:', err);
    // Fallback - store original message and unknown language
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
