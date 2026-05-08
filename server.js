import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_crash_if_unused',
  });
} catch (e) {
  console.warn("OpenAI could not initialize. Missing credentials.");
}

const translateToTelugu = async (text) => {
  if (!text) return '';
  try {
    const words = text.split(' ');
    const transliteratedWords = await Promise.all(words.map(async (word) => {
      if (/^[a-zA-Z]+$/.test(word)) {
        const response = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=te-t-i0-und&num=1`);
        const data = await response.json();
        if (data[0] === 'SUCCESS' && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
          return data[1][0][1][0];
        }
      }
      return word;
    }));
    return transliteratedWords.join(' ');
  } catch (e) {
    console.error("Transliteration Error:", e);
    return text; // Fallback to raw text if error
  }
};

app.post('/api/telugu-correct', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.json({ correctedText: '' });
    }

    // Step 1: If English characters detected, do Google Transliteration
    let preProcessedText = text;
    if (/[a-zA-Z]/.test(text)) {
      preProcessedText = await translateToTelugu(text);
    }

    // Check strict OpenAI config requirement
    if (!process.env.OPENAI_API_KEY) {
       console.warn("Server Warning: OPENAI_API_KEY is not configured in .env. Returning transliteration only.");
       return res.json({ correctedText: preProcessedText });
    }

    // Step 2 & 3: Send Telugu to OpenAI for syntax & ottulu correction
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost effective, reliable linguist model
      temperature: 0.1, // Strict factual grammar correction
      messages: [
        {
          role: "system",
          content: "You are an expert Telugu language corrector. Convert the given text into proper Telugu with accurate spelling, correct ottulu, and natural formatting. Do not include English words. Output only Telugu text."
        },
        {
          role: "user",
          content: preProcessedText
        }
      ],
    });

    const finalResult = aiResponse.choices[0].message.content?.trim();
    if (!finalResult) {
      throw new Error("Empty AI Response");
    }

    return res.json({ correctedText: finalResult });

  } catch (error) {
    console.error("Backend AI Correction Error:", error);
    // On failure => Transliteration Fallback without breaking UI
    const fallbackText = req.body?.text ? await translateToTelugu(req.body.text) : '';
    return res.status(500).json({ error: "Correction failed", fallbackText });
  }
});

// Added: WhatsApp Notification API via AiSensy
app.post('/api/whatsapp', async (req, res) => {
  try {
    const { phone, pdfUrl, name, amount } = req.body;
    
    if (!phone || !pdfUrl) {
      return res.status(400).json({ success: false, message: 'Missing required fields: phone or pdfUrl' });
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const AISENSY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDIxYzNlMWU1NmZhMGRmMWY3NWM2MSIsIm5hbWUiOiJTVlNCQiIsImFwcE5hbWUiOiJBaVNlbnN5IiwiY2xpZW50SWQiOiI2OWQyMWMzZTFlNTZmYTBkZjFmNzVjNWMiLCJhY3RpdmVQbGFuIjoiRlJFRV9GT1JFVkVSIiwiaWF0IjoxNzc1NjcwMTk3fQ.1NcXyQZeceq65ILMv6-ZVuG5pbcVOqn_189Bu1WehIs';

    const payload = {
      apiKey: AISENSY_KEY,
      campaignName: "namesthe",
      destination: "+91" + cleanPhone,
      userName: name || "Devotee Name",
      media: {
        url: pdfUrl,
        filename: "SVSBB_Chanda_Receipt.pdf"
      },
      templateParams: [
        name || "Devotee",
        String(amount || "1000")
      ]
    };

    console.log(`Sending WhatsApp via AiSensy to 91${cleanPhone}...`);

    const response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("AiSensy API Response:", data);

    if (!response.ok || data.success === false) {
       throw new Error(data.message || 'AiSensy backend rejected the request');
    }

    return res.json({ success: true, data });

  } catch (error) {
    console.error("WhatsApp Delivery Failed:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Node backend securely running and proxying AI on http://localhost:${PORT}`);
});
