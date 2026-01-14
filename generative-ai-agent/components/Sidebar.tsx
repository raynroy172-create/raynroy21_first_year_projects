import React, { useRef } from 'react';
import { Upload, Sparkles, CheckCircle, FileJson } from 'lucide-react';
import { Message } from '../types';

interface SidebarProps {
  onLoadChat: (messages: Message[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLoadChat }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.messages && Array.isArray(parsed.messages)) {
          onLoadChat(parsed.messages);
        } else {
          alert('Invalid chat file format.');
        }
      } catch (err) {
        console.error("Error parsing JSON", err);
        alert('Failed to parse chat file.');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <aside className="w-full h-full flex flex-col gap-6 p-6 overflow-y-auto">
      {/* Features Card */}
      <div className="glass-panel rounded-xl p-6 shadow-xl transition-all hover:bg-white/10 group">
        <h3 className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300">
          Agent Capabilities
        </h3>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm text-gray-200">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span>Real-time Agentic responses</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-200">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Deep Reasoning (Chain-of-Thought)</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-200">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Context-aware Memory</span>
          </li>
          <li className="flex items-center gap-3 text-sm text-gray-200">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Tool Use & Function Calling</span>
          </li>
        </ul>
      </div>

      {/* Load Chat Card */}
      <div className="glass-panel rounded-xl p-6 shadow-xl flex flex-col gap-4 transition-all hover:bg-white/10">
        <h3 className="text-xl font-bold text-white">History Management</h3>
        <div
          onClick={triggerFileInput}
          className="border-2 border-dashed border-white/20 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors group"
        >
          <FileJson className="w-8 h-8 text-gray-400 mb-2 group-hover:text-white transition-colors" />
          <p className="text-sm text-gray-400 group-hover:text-gray-200">Drop JSON file here or click to upload</p>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        <button
          onClick={triggerFileInput}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/50 transition-all active:scale-95"
        >
          Load Chat
        </button>
      </div>

      {/* Status */}
      <div className="mt-auto flex items-center gap-2 justify-end text-sm text-green-300 font-medium p-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        Ready to chat! 👋
      </div>
    </aside>
  );
};

export default Sidebar;