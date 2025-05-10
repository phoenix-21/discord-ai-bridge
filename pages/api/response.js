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
  
  // If we already have a translation in the database, return it
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

    // First check if existing translations are already in English
    const checkUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=|en&key=${MYMEMORY_API_KEY}`;
    const checkResponse = await fetch(checkUrl);
    const checkResult = await checkResponse.json();

    // Check if any existing translations target English
    const hasEnglishTranslation = checkResult.matches?.some(match => 
      match.target && (match.target.startsWith('en-US') || match.target.startsWith('en-GB'))
    );

    // If English translation exists, use the best match
    if (hasEnglishTranslation) {
      const bestMatch = checkResult.matches.reduce((best, current) => 
        (current.match > (best?.match || 0)) ? current : best, null);
      
      const translatedText = bestMatch?.translation || originalMessage;
      const sourceLang = bestMatch?.source?.split('-')[0] || 'unknown';

      await supabase
        .from('messages')
        .update({ 
          translated_message: translatedText,
          original_language: sourceLang
        })
        .eq('id', id);

      return res.status(200).json({ 
        messages: [{ 
          response: translatedText, 
          original_language: sourceLang
        }]
      });
    }

    // If no English translation exists, perform translation
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=auto|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    const translatedText = translateResult.responseData?.translatedText || originalMessage;
    const sourceLang = translateResult.responseData?.detectedSourceLanguage || 'unknown';

    // Store the new translation
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
      messages: [{ 
        response: originalMessage, 
        original_language: 'unknown'
      }]
    });
  }
}
