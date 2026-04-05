import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Try to get the API key from standard Vite env vars first (VITE_GEMINI_API_KEY)
// Fallback to exactly process.env.GEMINI_API_KEY mapped via vite.config.ts 'define'
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export interface GeminiResponse {
  original_word: string;
  corrected_word?: string;
  translation?: string;
  category: string;
  has_error: boolean;
  suggestion_message?: string;
  example_sentence?: string;
  example_translation?: string;
  explanation?: string;
}

export interface ReverseTranslationResponse {
  english_word: string;
  arabic_translation: string;
  example_sentence: string;
  example_translation: string;
  category: string;
}

export async function translateArabicToEnglish(arabicWord: string): Promise<ReverseTranslationResponse> {
  const prompt = `
    Translate the following Arabic word or phrase into a single, common English word.
    Arabic: "${arabicWord}"

    Tasks:
    1. Provide the most accurate and common English translation.
    2. Provide a clear Arabic translation for the English word (can be the original or a refined version).
    3. Provide a simple example sentence in English using the word.
    4. Provide the Arabic translation of the example sentence.
    5. Categorize the word into a general category (e.g., Home, Food, Travel, Work, Education, Nature, Technology, Health, etc.).

    Return the result strictly as a JSON object matching the schema.
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          english_word: { type: SchemaType.STRING },
          arabic_translation: { type: SchemaType.STRING },
          example_sentence: { type: SchemaType.STRING },
          example_translation: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
        },
        required: ["english_word", "arabic_translation", "example_sentence", "example_translation", "category"],
      },
    },
  });

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  if (!text) {
    throw new Error("No response from Gemini API");
  }

  return JSON.parse(text) as ReverseTranslationResponse;
}

export async function processWord(word: string, translation?: string): Promise<GeminiResponse> {
  const prompt = `
    Analyze the following English word and its optional Arabic translation.     
    Word: "${word}"
    Translation: "${translation || ''}"

    Tasks:
    1. Check the spelling of the English word. If it's misspelled, provide the correct spelling.
    2. Check the Arabic translation. If it's incorrect or missing, provide a correct one.
    3. Categorize the word into a general category (e.g., Home, Food, Travel, Work, Education, Nature, Technology, Health, etc.).
    4. Provide a simple example sentence in English using the word.
    5. Provide the Arabic translation of the example sentence.
    6. In the explanation field, DO NOT explain the basic meaning. Instead, provide in Arabic other common meanings this word might have, or common idioms/compound words it is used in along with their translations.
    7. If there is a spelling error in the English word or a significant error in the translation, set "has_error" to true and provide a "suggestion_message".  

    Return the result strictly as a JSON object matching the schema.
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          original_word: { type: SchemaType.STRING },
          corrected_word: { type: SchemaType.STRING },
          translation: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          has_error: { type: SchemaType.BOOLEAN },
          suggestion_message: { type: SchemaType.STRING },
          example_sentence: { type: SchemaType.STRING },
          example_translation: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ["original_word", "category", "has_error", "example_sentence", "example_translation", "explanation"],
      },
    },
  });

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  if (!text) {
    throw new Error("No response from Gemini API");
  }

  return JSON.parse(text) as GeminiResponse;
}

export interface WordDetailsResponse {
  example_sentence: string;
  example_translation: string;
  explanation: string;
}

export async function fetchWordDetails(word: string, translation: string): Promise<WordDetailsResponse> {
  const prompt = `
    Provide details for the following English word and its Arabic translation.  
    Word: "${word}"
    Translation: "${translation}"

    Tasks:
    1. Provide a simple example sentence in English using the word.
    2. Provide the Arabic translation of the example sentence.
    3. In the explanation field, DO NOT explain the basic meaning. Instead, provide in Arabic other common meanings this word might have, or common idioms/compound words it is used in along with their translations.

    Return the result strictly as a JSON object matching the schema.
  `;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          example_sentence: { type: SchemaType.STRING },
          example_translation: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ["example_sentence", "example_translation", "explanation"],   
      },
    },
  });

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  if (!text) {
    throw new Error("No response from Gemini API");
  }

  return JSON.parse(text) as WordDetailsResponse;
}
