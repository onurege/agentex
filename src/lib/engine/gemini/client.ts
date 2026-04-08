// ============================================================
// Gemini Client — SDK initialization (SERVER-ONLY)
// ============================================================
//
// This module is only imported from the API route (src/app/api/gemini/).
// It must never be imported from client-side code.
//
// The API key is read from GEMINI_API_KEY (no NEXT_PUBLIC_ prefix),
// which ensures it stays server-side and is never bundled into
// the client JavaScript.
// ============================================================

import { GoogleGenAI } from "@google/genai";

// --- Configuration ---

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

function getConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const model = process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "gemini-2.0-flash";

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. " +
        "Set it in .env.local or switch to provider=mock.",
    );
  }

  return { apiKey, model };
}

// --- Client Singleton ---

let _client: GoogleGenAI | null = null;
let _model: string = "";

function getClient(): { client: GoogleGenAI; model: string } {
  if (!_client) {
    const config = getConfig();
    _client = new GoogleGenAI({ apiKey: config.apiKey });
    _model = config.model;
  }
  return { client: _client, model: _model };
}

// --- Generate with JSON output ---

/**
 * Send a prompt to Gemini and get a structured JSON response.
 * Uses responseMimeType: "application/json" for reliable parsing.
 *
 * SERVER-ONLY: This function must only be called from API routes.
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
  const { client, model } = getClient();

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const text = response.text ?? "";

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. Model: ${model}. ` +
        `Response (first 500 chars): ${text.slice(0, 500)}`,
    );
  }
}
