import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);

function getAiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(rolePreset: string, workspaceSummary?: string): string {
  const roleMap: Record<string, string> = {
    operations:
      'You are NEXUS Operations Copilot, a senior chief-of-staff and business operations analyst. Provide concise, actionable insights grounded in the user workspace metrics, prioritizing bottlenecks, deadlines, and cash-flow health.',
    finance:
      'You are NEXUS Financial Auditor, an institutional FP&A advisor. Focus on net profit margins, expense categories, budget variances, runway discipline, and anomaly detection.',
    project:
      'You are NEXUS Delivery Strategist, a principal PMO lead. Focus on critical-path tasks, overdue risk mitigation, team workload balance, and milestone sequencing.',
    fast:
      'You are NEXUS Quick Assistant. Give crisp, direct, bulleted answers in under 120 words.',
  };

  const base = roleMap[rolePreset] || roleMap.operations;
  if (workspaceSummary && typeof workspaceSummary === 'string') {
    const safeSummary = workspaceSummary.slice(0, 6000);
    return `${base}\n\nCurrent Workspace Context (live snapshot):\n${safeSummary}`;
  }
  return base;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const configured = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({ ok: true, geminiConfigured: configured });
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const { messages, rolePreset = 'operations', modelTier = 'balanced', workspaceSummary, image } = req.body ?? {};

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required.' });
        return;
      }

      const sanitizedMessages = messages
        .filter(
          (m: unknown): m is { role: 'user' | 'model'; text: string } =>
            typeof m === 'object' &&
            m !== null &&
            ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'model') &&
            typeof (m as { text?: unknown }).text === 'string' &&
            (m as { text: string }).text.trim().length > 0
        )
        .slice(-24)
        .map((m) => ({
          role: m.role,
          text: m.text.slice(0, 8000),
        }));

      if (sanitizedMessages.length === 0) {
        res.status(400).json({ error: 'At least one valid message is required.' });
        return;
      }

      const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
      if (lastMessage.role !== 'user') {
        res.status(400).json({ error: 'The latest message must come from the user.' });
        return;
      }

      const isFast = modelTier === 'fast' || rolePreset === 'fast';
      const selectedModel = isFast ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
      const thinkingLevel =
        modelTier === 'deep' || modelTier === 'complex'
          ? ThinkingLevel.HIGH
          : modelTier === 'fast'
            ? ThinkingLevel.LOW
            : ThinkingLevel.MEDIUM;

      const history = sanitizedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const chat = ai.chats.create({
        model: selectedModel,
        history,
        config: {
          systemInstruction: buildSystemInstruction(String(rolePreset), workspaceSummary),
          ...(isFast ? {} : { thinkingConfig: { thinkingLevel } }),
        },
      });

      const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (
        image &&
        typeof image === 'object' &&
        typeof image.base64 === 'string' &&
        typeof image.mimeType === 'string' &&
        ALLOWED_IMAGE_MIMES.has(image.mimeType)
      ) {
        userParts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.base64.slice(0, 10_000_000),
          },
        });
      }
      userParts.push({ text: lastMessage.text });

      const response = await chat.sendMessage({
        message: userParts.length === 1 ? lastMessage.text : userParts,
      });

      res.json({
        text: response.text ?? 'No response generated.',
        modelUsed: selectedModel,
        requestedTier: modelTier,
        note:
          (modelTier === 'deep' || modelTier === 'complex')
            ? 'Routed to gemini-4-hydrogen with high reasoning depth (free-tier compatible).'
            : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error calling Gemini chat.';
      console.error('Gemini chat error:', err);
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/gemini/analyze-image', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const { imageBase64, mimeType, prompt, mode = 'receipt' } = req.body ?? {};
      if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
        res.status(400).json({ error: 'Image data is required.' });
        return;
      }
      if (typeof mimeType !== 'string' || !ALLOWED_IMAGE_MIMES.has(mimeType)) {
        res.status(400).json({ error: 'Unsupported image format. Please upload PNG, JPEG, or WebP.' });
        return;
      }

      const imagePart = {
        inlineData: {
          mimeType,
          data: imageBase64.slice(0, 10_000_000),
        },
      };

      if (mode === 'receipt') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              imagePart,
              {
                text:
                  typeof prompt === 'string' && prompt.trim()
                    ? prompt.slice(0, 1000)
                    : 'Extract invoice or receipt details from this image for expense ledger entry. Return structured JSON.',
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                vendor: { type: Type.STRING, description: 'Vendor or merchant name.' },
                date: { type: Type.STRING, description: 'ISO YYYY-MM-DD date if visible, else today.' },
                totalAmount: { type: Type.NUMBER, description: 'Total numerical amount.' },
                currency: { type: Type.STRING, description: '3-letter currency code such as USD.' },
                category: {
                  type: Type.STRING,
                  description: 'Best matching category: Cloud & Infrastructure, Payroll & Contractors, Software & SaaS, Marketing & Growth, Office & Operations, or Travel & Events.',
                },
                description: { type: Type.STRING, description: 'Concise ledger description summarizing items.' },
                lineItems: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Short bullet list of extracted line items.',
                },
                confidence: { type: Type.STRING, description: 'High, Medium, or Low.' },
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({
          mode: 'receipt',
          modelUsed: 'gemini-4-hydrogen',
          extracted: parsed,
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            imagePart,
            {
              text:
                typeof prompt === 'string' && prompt.trim()
                  ? prompt.slice(0, 1500)
                  : 'Analyze this business document or photo thoroughly. Summarize key data points, risks, and recommended operational next steps.',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      res.json({
        mode,
        modelUsed: 'gemini-4-hydrogen',
        analysis: response.text ?? 'Unable to extract analysis.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image analysis failed.';
      console.error('Gemini analyze-image error:', err);
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/gemini/tts', async (req: Request, res: Response) => {
    const ai = getAiClient('v1beta');
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const { text, voiceName = 'Kore', style = 'Clear, composed executive operations briefing' } = req.body ?? {};
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const safeVoice = ALLOWED_VOICES.has(voiceName) ? voiceName : 'Kore';
      const safeText = text.trim().slice(0, 1800);

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: safeText,
                speechMetadata: {
                  style: String(style).slice(0, 160),
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: safeVoice,
              },
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ error: 'No audio data returned by Gemini TTS.' });
        return;
      }

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
        modelUsed: 'gemini-3.8-flash-tts',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speech synthesis failed.';
      console.error('Gemini TTS error:', err);
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NEXUS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NEXUS server:', err);
  process.exit(1);
});
