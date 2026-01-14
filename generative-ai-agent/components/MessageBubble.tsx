import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, FileText } from 'lucide-react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full mb-6 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] lg:max-w-[75%] gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${isUser ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          {isUser ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-white" />}
        </div>

        {/* Bubble Content */}
        <div className={`flex flex-col gap-2 p-4 rounded-2xl shadow-xl backdrop-blur-sm border ${isUser
            ? 'bg-indigo-900/60 border-indigo-700/50 rounded-tr-none'
            : 'bg-slate-800/60 border-slate-700/50 rounded-tl-none'
          }`}>
          {/* Attachment Display */}
          {message.attachment && (
            <div className="mb-2">
              {message.attachment.mimeType.startsWith('image/') ? (
                <img
                  src={`data:${message.attachment.mimeType};base64,${message.attachment.data}`}
                  alt="User attachment"
                  className="max-w-full h-auto rounded-lg border border-white/10"
                  style={{ maxHeight: '300px' }}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10 border border-white/10">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <FileText className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
                      {message.attachment.name || 'Document'}
                    </span>
                    <span className="text-xs text-gray-400 uppercase">
                      {message.attachment.mimeType.split('/')[1]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Content */}
          <div className="prose prose-invert prose-sm max-w-none text-gray-100 leading-relaxed">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>

          <div className="text-[10px] text-gray-400 opacity-60 self-end">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;