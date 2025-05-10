import { supabase } from '../../lib/supabaseClient';
import fetch from 'node-fetch'; // Make sure this is installed in your project

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

  const MYMEMORY_API_KEY = "803876a9e4f30ab69842";
  let detectedLang = 'unknown';

  try {
    // Detect language using languagedetectapi.com
    try {
      const detectResponse = await fetch("https://languagedetectapi.com/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalMessage })
      });

      const detectResult = await detectResponse.json();
      detectedLang = detectResult.language || 'unknown';
    } catch (detectErr) {
      console.warn("Language detection failed:", detectErr.message);
    }

    // Skip translation if detection failed or message is already in English
    if (detectedLang === 'unknown' || detectedLang === 'en') {
      return res.status(200).json({
        messages: [{
          response: originalMessage,
          original_language: detectedLang
        }]
      });
    }

    // Translate message from detectedLang to English
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
    const translateResponse = await fetch(translateUrl);
    const translateResult = await translateResponse.json();

    const translatedMessage = translateResult.responseData?.translatedText || originalMessage;

    // Save translated message to Supabase
    await supabase
      .from('messages')
      .update({ translated_message: translatedMessage })
      .eq('id', id);

    res.status(200).json({
      messages: [{
        response: translatedMessage,
        original_language: detectedLang
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
