import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  if (!ai) return "AI Key missing. Please provide a description manually.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a short, catchy, professional product description (max 2 sentences) for a product named "${name}" in the category "${category}".`,
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate description. Please try again.";
  }
};

export const analyzeSales = async (transactions: any[]): Promise<string> => {
  if (!ai) return "AI Key missing.";

  try {
    const summary = JSON.stringify(transactions.slice(0, 20)); // Limit context
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze these recent sales transactions and give me 3 bullet points on sales trends or advice for the shop owner. Data: ${summary}`,
    });
    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to analyze data.";
  }
};
