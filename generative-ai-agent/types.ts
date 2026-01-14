export interface Attachment {
  data: string; // Base64 string
  mimeType: string;
  name?: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  attachment?: Attachment;
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isThinking: boolean;
}

export enum ModelType {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview',
}

export interface ToolCallResponse {
  functionCalls: FunctionCall[];
}

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface SavedChat {
  messages: Message[];
  date: string;
  version: string;
}