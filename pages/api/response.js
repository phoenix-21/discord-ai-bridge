import { supabase } from '../../lib/supabaseClient';
import fetch from 'node-fetch'; // Make sure this is installed

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Supabase fetch error:", error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!data?.length) {
    return res.status(200).json({
      messages: [{ response: 'No messages.', original_language: 'unknown' }]
    });
  }

  const { id, message: originalMessage, translated_message } = data[0];
  console.log("Original message:", originalMessage);

  if (translated_message) {
    return res.status(200).json({
      messages: [{ response: translated_message, original_language: 'unknown' }]
    });
  }

  const MYMEMORY_API_KEY = "803876a9e4f30ab69842";
  let detectedLang = 'unknown';

  try {
    // Language detection
    try {
      const detectRes = await fetch("https://languagedetectapi.com/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalMessage })
      });

      const detectJson = await detectRes.json();
      detectedLang = detectJson.language || 'unknown';
      console.log("Detected language:", detectedLang);
    } catch (detectErr) {
      console.warn("Language detection failed:", detectErr.message);
    }

    // Skip translation if English or unknown
    if (detectedLang === 'unknown' || detectedLang === 'en') {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ original_language: detectedLang })
        .eq('id', id);

      if (updateError) {
        console.error("Supabase update error (no translation):", updateError.message);
      }

      return res.status(200).json({
        messages: [{ response: originalMessage, original_language: detectedLang }]
      });
    }

    // Translate using MyMemory
    const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${detectedLang}|en&key=${MYMEMORY_API_KEY}`;
    console.log("Translation API URL:", translateUrl);

    const translateRes = await fetch(translateUrl);
    const translateJson = await translateRes.json();
    console.log("Translation API raw response:", translateJson);

    const translatedMessage = translateJson.responseData?.translatedText || originalMessage;
    console.log("Final translated message:", translatedMessage);

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        translated_message: translatedMessage,
        original_language: detectedLang
      })
      .eq('id', id);

    if (updateError) {
      console.error("Supabase update error:", updateError.message);
    }

    return res.status(200).json({
      messages: [{ response: translatedMessage, original_language: detectedLang }]
    });

  } catch (err) {
    console.error("Translation error:", err.message);
    return res.status(500).json({
      error: 'Translation failed',
      detail: err.message,
      fallback: originalMessage
    });
  }
}
