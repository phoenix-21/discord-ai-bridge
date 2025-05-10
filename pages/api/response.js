import { supabase } from '../../lib/supabaseClient';

const LANGUAGE_CLUES = {
  en: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I'], // English
  de: ['der', 'die', 'das', 'und', 'in', 'den', 'von', 'zu', 'mit', 'sich'], // German
  ar: ['ال', 'في', 'من', 'على', 'أن', 'هو', 'إلى', 'كان', 'هذا', 'مع'], // Arabic
  pt: ['o', 'a', 'de', 'e', 'que', 'em', 'do', 'da', 'para', 'com'], // Portuguese
  hi: ['और', 'से', 'है', 'की', 'में', 'हैं', 'को', 'पर', 'यह', 'था'], // Hindi
  it: ['il', 'la', 'di', 'e', 'che', 'in', 'un', 'a', 'per', 'con'], // Italian
  ko: ['이', '그', '에', '를', '의', '은', '는', '과', '와', '하다'], // Korean
  tl: ['ang', 'ng', 'sa', 'na', 'ay', 'at', 'mga', 'si', 'ito', 'ni'], // Filipino (Tagalog)
  zh: ['的', '一', '是', '在', '不', '了', '有', '和', '人', '这'], // Chinese
  ja: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'し', 'て', 'ます'], // Japanese
  ru: ['и', 'в', 'не', 'на', 'я', 'что', 'он', 'с', 'по', 'как'], // Russian
  es: ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se']  // Spanish
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
        original_language: 'mixed'
      }]
    });
  }

  try {
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842";

    // Simple language detector
    function detectLanguage(text) {
      if (!text) return 'en';
      
      const textLower = text.toLowerCase();
      let bestMatch = { lang: 'en', score: 0 };
      
      for (const [lang, words] of Object.entries(LANGUAGE_CLUES)) {
        const score = words.filter(word => textLower.includes(word)).length;
        if (score > bestMatch.score) {
          bestMatch = { lang, score };
        }
      }
      return bestMatch.lang;
    }

    // Split into sentences
    const sentences = originalMessage.split(/(?<=[.!?])\s+/);
    const processedSentences = [];

    for (const sentence of sentences) {
      const lang = detectLanguage(sentence);
      
      if (lang === 'en') {
        processedSentences.push(sentence);
        continue;
      }

      // Translate non-English sentences
      const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=${lang}|en&key=${MYMEMORY_API_KEY}`;
      const response = await fetch(translateUrl);
      const result = await response.json();
      
      processedSentences.push(result.responseData?.translatedText || sentence);
    }

    const translatedText = processedSentences.join(' ');

    await supabase
      .from('messages')
      .update({ 
        translated_message: translatedText,
        original_language: 'mixed'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: translatedText, 
        original_language: 'mixed'
      }]
    });

  } catch (err) {
    console.error('Translation error:', err);
    await supabase
      .from('messages')
      .update({ 
        translated_message: originalMessage,
        original_language: 'mixed'
      })
      .eq('id', id);

    res.status(200).json({ 
      messages: [{ 
        response: originalMessage, 
        original_language: 'mixed'
      }]
    });
  }
}
