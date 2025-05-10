import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message, translated_message')
    .order('id', { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ messages: [{ response: 'No messages yet.' }] });

  const { id, message: originalMessage, translated_message } = data[0];
  if (translated_message) return res.status(200).json({ messages: [{ response: translated_message }] });

  try {
    // Hardcode source language (e.g., "es" for Spanish)
    const langpair = "es|en"; // Change "es" to your expected input language
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalMessage)}&langpair=${langpair}`;
    
    const response = await fetch(apiUrl);
    const result = await response.json();

    const translatedMessage = result.responseData?.translatedText || originalMessage;
    await supabase.from('messages').update({ translated_message: translatedMessage }).eq('id', id);

    res.status(200).json({ messages: [{ response: translatedMessage }] });
  } catch (err) {
    res.status(500).json({ 
      error: 'Translation failed', 
      detail: err.message,
      fallback: originalMessage // Return original text if translation fails
    });
  }
}
