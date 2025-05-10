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
  if (translated_message) return res.status(200).json({ messages: [{ response: translated_message }] });

  try {
    // Replace with your MyMemory API key
    const MYMEMORY_API_KEY = "803876a9e4f30ab69842"; // 👈 Get it from the link above
    const langpair = "es|en"; // Example: Spanish → English (change "es" to your source language)
    
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${langpair}&key=${MYMEMORY_API_KEY}`;
    const response = await fetch(apiUrl);
    const result = await response.json();

    const translatedMessage = result.responseData?.translatedText || originalMessage;
    await supabase.from('messages').update({ translated_message: translatedMessage }).eq('id', id);

    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage // Return original if translation fails
    });
  }
}
