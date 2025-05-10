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

    // Detect the language
    const detectUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=|en&key=${MYMEMORY_API_KEY}`;
    const detectResponse = await fetch(detectUrl);
    const detectResult = await detectResponse.json();
    let detectedLang = detectResult.responseData?.match?.lang || detectResult.responseData?.detectedSourceLanguage || null;

    // Validate the detected language (must be 2-letter ISO code)
    const validLangCodes = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar']; // Add more as needed
    if (!detectedLang || !validLangCodes.includes(detectedLang)) {
      detectedLang = 'auto'; // Let MyMemory handle auto-detection during translation
    }

    // If the message is already in English, no translation needed
    if (detectedLang === 'en') {
      return res.status(200).json({ 
        messages: [{ 
          response: originalMessage, 
          original_language: 'en'
        }]
      });
    }

    // Translate using detected language or auto-detection
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;
    const finalDetectedLang = translateResult.responseData?.detectedSourceLanguage || detectedLang || 'unknown';

    // Store both the translation and detected language
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
