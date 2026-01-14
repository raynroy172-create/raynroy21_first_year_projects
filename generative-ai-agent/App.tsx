import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Trash2, Save, Image as ImageIcon, Loader2, Bot, FileText, Paperclip, Sparkles } from 'lucide-react';
import { Chat } from '@google/genai';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import { createChatSession, generateImage } from './services/geminiService';
import { Message, SavedChat } from './types';

const INITIAL_MESSAGE: Message = {
  role: 'model',
  text: `**Hello! I am your Generative AI Agent.** 🚀

I am powered by Google's **Gemini 3 Flash** with agentic capabilities and deep reasoning.

**Here's what I can do for you:**
*   ✨ **Reasoning:** Solve complex problems using chain-of-thought.
*   📝 **Content:** Generate high-quality text, code, and creative writing.
*   🖼️ **Vision & Docs:** Analyze images (.jpg, .png) and documents (.pdf).
*   🛠️ **Tools:** I can natively clear the chat or save our conversation if you ask.

*Type a message below to get started!*`,
  timestamp: Date.now()
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);

  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<string | null>(null); // Base64 data

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Chat on mount
  useEffect(() => {
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isGeneratingImage]);

  const initChat = (history: Message[] = []) => {
    try {
      // Create new chat instance with loaded history or empty
      const chat = createChatSession(history);
      setChatInstance(chat);
    } catch (error) {
      console.error("Failed to init chat", error);
    }
  };

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    initChat([]); // Reset backend session
  };

  const handleSaveChat = () => {
    const chatData: SavedChat = {
      messages,
      date: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadChat = (loadedMessages: Message[]) => {
    setMessages(loadedMessages);
    initChat(loadedMessages);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Extract base64 part only
        const base64 = result.split(',')[1];
        setPreviewData(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !chatInstance || isLoading) return;

    const currentText = inputText;
    const currentFile = selectedFile;
    const currentBase64 = previewData;

    // 1. Add User Message to UI
    const newUserMsg: Message = {
      role: 'user',
      text: currentText,
      attachment: currentFile && currentBase64 ? {
        data: currentBase64,
        mimeType: currentFile.type,
        name: currentFile.name
      } : undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setSelectedFile(null);
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    try {
      // 2. Prepare payload for Gemini
      let messagePayload: string | Array<any> = currentText;

      if (currentFile && currentBase64) {
        // Construct parts for multimodal request
        messagePayload = [
          { text: currentText },
          { inlineData: { mimeType: currentFile.type, data: currentBase64 } }
        ];
      }

      // 3. Stream Response
      const result = await chatInstance.sendMessageStream({ message: messagePayload as any });

      let fullResponseText = '';

      // We need a placeholder message for the AI response to stream into
      const aiMsgId = Date.now();
      setMessages(prev => [...prev, {
        role: 'model',
        text: '',
        timestamp: aiMsgId
      }]);

      for await (const chunk of result) {
        if (chunk.text) {
          fullResponseText += chunk.text;
          setMessages(prev => prev.map(msg =>
            msg.timestamp === aiMsgId ? { ...msg, text: fullResponseText } : msg
          ));
        }

        // Check for function calls in this chunk
        if (chunk.functionCalls) {
          for (const call of chunk.functionCalls) {
            if (call.name === 'clearChat') {
              handleClearChat();
              setIsLoading(false);
              return;
            }
            if (call.name === 'saveChat') {
              handleSaveChat();
            }
            if (call.name === 'generateImage') {
              const prompt = call.args['prompt'] as string;
              setIsGeneratingImage(true);
              try {
                const imageResult = await generateImage(prompt);
                if (imageResult) {
                  setMessages(prev => [...prev, {
                    role: 'model',
                    text: `*Generated image for: "${prompt}"*`,
                    attachment: {
                      data: imageResult.data,
                      mimeType: imageResult.mimeType,
                      name: 'generated-image.png'
                    },
                    timestamp: Date.now()
                  }]);
                } else {
                  setMessages(prev => [...prev, {
                    role: 'model',
                    text: `*Failed to generate image for: "${prompt}"*`,
                    timestamp: Date.now()
                  }]);
                }
              } catch (err) {
                console.error("Image gen error", err);
                setMessages(prev => [...prev, {
                  role: 'model',
                  text: `*Error generating image.*`,
                  timestamp: Date.now()
                }]);
              } finally {
                setIsGeneratingImage(false);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: `**Error:** Something went wrong. Please check your API key or internet connection.\n\nDetails: ${(error as Error).message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white font-sans selection:bg-purple-500 selection:text-white">

      {/* 1. Header */}
      <header className="flex-shrink-0 h-16 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-10 relative shadow-2xl">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Generative AI Agent
          </h1>
          <p className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-medium">
            Powered by Google's Gemini 3 Flash • Agentic & Reasoning
          </p>
        </div>
        <div className="hidden md:block">
          <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs border border-indigo-500/30">
            v3.0-preview
          </span>
        </div>
      </header>

      {/* 2. Main Grid */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* Left Column: Chat Interface */}
        <section className="flex flex-col relative w-full lg:w-[70%] h-full">

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-40 scroll-smooth">
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
              {(isLoading || isGeneratingImage) && (
                <div className="flex w-full mb-6 justify-start">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-emerald-600 shadow-lg animate-pulse">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center p-4 rounded-2xl rounded-tl-none bg-slate-800/60 border border-slate-700/50">
                      {isGeneratingImage ? (
                        <Sparkles className="w-5 h-5 text-pink-400 animate-spin mr-2" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mr-2" />
                      )}
                      <span className="text-sm text-gray-300 italic">
                        {isGeneratingImage ? 'Generating image...' : 'Thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Section (Fixed Bottom) */}
          <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 bg-gradient-to-t from-indigo-950 via-indigo-950/90 to-transparent z-20">
            <div className="max-w-3xl mx-auto flex flex-col gap-3">

              {/* File Preview */}
              {selectedFile && previewData && (
                <div className="relative w-fit group">
                  {selectedFile.type.startsWith('image/') ? (
                    <img src={`data:${selectedFile.type};base64,${previewData}`} alt="Preview" className="h-20 rounded-lg border border-white/20 shadow-lg" />
                  ) : (
                    <div className="flex items-center gap-2 h-20 p-3 bg-white/10 rounded-lg border border-white/20 shadow-lg min-w-[120px]">
                      <FileText className="w-8 h-8 text-red-400" />
                      <span className="text-xs truncate max-w-[100px]">{selectedFile.name}</span>
                    </div>
                  )}

                  <button
                    onClick={clearFileSelection}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Input Bar */}
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message or upload image/PDF..."
                    rows={1}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl py-4 pl-12 pr-14 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none overflow-hidden"
                    style={{ minHeight: '56px' }}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors group"
                      title="Upload File"
                    >
                      <Paperclip className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                    </button>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || (!inputText.trim() && !selectedFile)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-purple-900/50 group"
                  >
                    <Rocket className="w-5 h-5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleClearChat}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-500/80 to-pink-600/80 hover:from-red-500 hover:to-pink-600 border border-white/10 text-white font-semibold shadow-lg backdrop-blur-sm transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Chat
                </button>
                <button
                  onClick={handleSaveChat}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-600 border border-white/10 text-white font-semibold shadow-lg backdrop-blur-sm transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  Save Chat
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* Right Column: Sidebar */}
        <div className="hidden lg:block w-[30%] h-full border-l border-white/5 bg-black/20 backdrop-blur-xl">
          <Sidebar onLoadChat={handleLoadChat} />
        </div>

      </main>
    </div>
  );
};

export default App;