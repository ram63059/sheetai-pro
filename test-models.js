const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const models = await ai.models.list();
    for await (const model of models) {
      if (model.supportedGenerationMethods.includes('generateContent')) {
        console.log(model.name);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

listModels();
