import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";
import { Message, ModelType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define tools
const clearChatTool: FunctionDeclaration = {
  name: 'clearChat',
  description: 'Clears the current conversation history and resets the chat interface.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const saveChatTool: FunctionDeclaration = {
  name: 'saveChat',
  description: 'Saves the current conversation history to a JSON file.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const generateImageTool: FunctionDeclaration = {
  name: 'generateImage',
  description: 'Generates an image based on a text prompt.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: {
        type: Type.STRING,
        description: 'The description of the image to generate.',
      },
    },
    required: ['prompt'],
  },
};

export const createChatSession = (history: Message[] = [], model: string = ModelType.FLASH) => {
  // Convert internal Message format to SDK Content format
  const sdkHistory: Content[] = history.map(msg => {
    const parts: Part[] = [];
    if (msg.attachment) {
      parts.push({
        inlineData: {
          mimeType: msg.attachment.mimeType,
          data: msg.attachment.data
        }
      });
    }
    if (msg.text) {
      parts.push({ text: msg.text });
    }
    return {
      role: msg.role,
      parts: parts
    };
  });

  return ai.chats.create({
    model: model,
    history: sdkHistory,
    config: {
      systemInstruction: "You are a helpful, intelligent, and agentic AI assistant. You have access to tools to clear chat, save chat, and generate images. If the user asks to generate an image, use the generateImage tool. Use Markdown for formatting.",
      tools: [{ functionDeclarations: [clearChatTool, saveChatTool, generateImageTool] }],
      thinkingConfig: {
        thinkingBudget: 2048, // Medium reasoning level for Agentic capabilities
      }
    }
  });
};

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateImage = async (prompt: string): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-001', // imagen 3
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    // Iterate to find image part
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Image generation failed", e);
    throw e;
  }
};