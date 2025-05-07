import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [responseId, setResponseId] = useState(null);
  const [loading, setLoading] = useState(false);

  const submitPrompt = async () => {
    setLoading(true);
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    setResponseId(data.id);
    setLoading(false);
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>OpenAI Prompt Submitter</h1>
      <textarea
        rows={5}
        placeholder="Enter your prompt here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
      />
      <br />
      <button
        onClick={submitPrompt}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          backgroundColor: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
        }}
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Submit Prompt'}
      </button>

      {responseId && (
        <p style={{ marginTop: '1rem' }}>
          Prompt submitted! Access your response at:<br />
          <code>/api/response?id={responseId}</code>
        </p>
      )}
    </main>
  );
}
