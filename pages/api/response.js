import { supabase } from '../../lib/supabaseClient';

// Enhanced language detection configuration
const ENGLISH_WORDS = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'];
const LANGUAGE_DETECTION = {
  es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se'],
  fr: ['le', 'la', 'de', 'un', 'à', 'être', 'et', 'en', 'avoir', 'que'],
  de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich']
};
const DEFAULT_SOURCE_LANG = 'es'; // Fallback language

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

    // Improved English detection function
    function isEnglish(text) {
      if (!text || typeof text !== 'string') return false;
      
      const textLower = text.toLowerCase();
      const wordCount = text.split(/\s+/).length;
      if (wordCount === 0) return false;
      
      const englishWordCount = ENGLISH_WORDS.filter(word => 
        new RegExp(`\\b${word}\\b`).test(textLower)
      ).length;
      
      // Consider it English if at least 30% of words are English common words
      return (englishWordCount / wordCount) > 0.3;
    }

    // Step 1: Check if message is English
    if (isEnglish(originalMessage)) {
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

    // Step 2: For non-English messages, detect source language
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
      
      return bestMatch.score >= 3 ? bestMatch.lang : null;
    }

    const detectedLang = detectLanguage(originalMessage);
    const sourceLang = detectedLang || DEFAULT_SOURCE_LANG;

    // Step 3: Translate non-English to English
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${sourceLang}|en&key=${MYMEMORY_API_KEY}`;
    
    const translateResponse = await fetch(translateUrl);
    if (!translateResponse.ok) {
      throw new Error(`API request failed with status ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.responseData?.translatedText || originalMessage;

    // Store results
    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: sourceLang
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: sourceLang
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
      messages:[{ 
        response: originalMessage, 
        original_language: 'unknown'
      }]
    });
  }
}
