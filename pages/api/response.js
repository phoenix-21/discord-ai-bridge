import { supabase } from '../../lib/supabaseClient';

// Special characters for CJK and Arabic scripts
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

    // Simple script-based language detection (no German specific logic)
    function detectScript(text) {
      if (!text || typeof text !== 'string') return null;
      
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
      
      return null; // Let MyMemory handle other languages
    }

    const detectedScript = detectScript(originalMessage);
    
    // If message is in a script we can't auto-detect, let MyMemory handle it
    const sourceLang = detectedScript || 'auto';

    // Translate to English
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
