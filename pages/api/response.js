import { supabase } from '../../lib/supabaseClient';

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

    // Improved language detection
    async function detectLanguage(text) {
      try {
        // First try MyMemory's detection
        const detectUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=|en&key=${MYMEMORY_API_KEY}`;
        const detectResponse = await fetch(detectUrl);
        const detectResult = await detectResponse.json();
        
        // Check multiple possible response formats
        const detectedLang = detectResult.responseData?.detectedLanguage?.language || 
                           detectResult.responseData?.match?.sourceLanguage ||
                           detectResult.responseData?.detectedSourceLanguage;
        
        // Validate it's a 2-letter code
        if (detectedLang && /^[a-z]{2}$/i.test(detectedLang)) {
          return detectedLang.toLowerCase();
        }

        // Fallback to simple English detection
        const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
        const isLikelyEnglish = englishWords.some(word => 
          new RegExp(`\\b${word}\\b`, 'i').test(text)
        );
        if (isLikelyEnglish) return 'en';

        return null;
      } catch (e) {
        console.error('Detection failed:', e);
        return null;
      }
    }

    // Detect language with improved function
    let detectedLang = await detectLanguage(originalMessage);

    // If we still can't detect, use 'auto' as fallback
    const sourceLang = detectedLang || 'auto';

    // If detected as English, return original
    if (detectedLang === 'en') {
      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en'
        }]
      });
    }

    // Translate using detected language or auto-detection
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    // Get final translation and detected language
    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;
    const finalDetectedLang = translateResult.responseData?.detectedSourceLanguage || detectedLang || 'unknown';

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedMessage,
        original_language: finalDetectedLang
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedMessage, 
        original_language: finalDetectedLang
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
