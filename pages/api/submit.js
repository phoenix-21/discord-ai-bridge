export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Or use gpt-3.5-turbo if needed
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 450,
      }),
    });

    const data = await openaiRes.json();

    const id = Date.now().toString();
    global.responses = global.responses || {};
    global.responses[id] = data;

    res.status(200).json({ id });
  } catch (err) {
    console.error('OpenAI request failed:', err);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
}
