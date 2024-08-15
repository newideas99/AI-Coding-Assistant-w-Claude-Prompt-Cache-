import React, { useState, useEffect, useRef } from 'react';
import './ChatbotPage.css';
import { processMessage, useAction } from 'wasp/client/operations';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  type: 'user' | 'assistant';
  content: string;
}

export function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState<string>('');
  const processMessageFn = useAction(processMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserId(Math.random().toString(36).substring(7));
    setMessages([{ type: 'assistant', content: "Welcome to the Hacker's Terminal. State your query." }]);
  }, []);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto'; // Reset the height to allow shrinking
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; // Limit to 150px max height
  };

  const handleSend = async () => {
    if (input.trim() !== '') {
      setMessages(prev => [...prev, { type: 'user', content: input }]);
      setInput('');
      try {
        const response = await processMessageFn({ message: input, userId });
        setMessages(prev => [...prev, { type: 'assistant', content: response }]);
      } catch (error) {
        console.error('Error processing message:', error);
        setMessages(prev => [...prev, { type: 'assistant', content: 'Error: Unable to process your request.' }]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (msg: Message) => {
    if (msg.type === 'user') {
      return <div className="user-message">{msg.content}</div>;
    } else {
      return (
        <div className="bot-message">
          <ReactMarkdown
            components={{
              code({ node, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return match ? (
                  <SyntaxHighlighter
                    style={atomDark}
                    language={match[1] || 'text'}
                    PreTag="div"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      );
    }
  };

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">CODING TERMINAL</span>
      </div>
      <div className="terminal-body" ref={chatBodyRef}>
        {messages.map((msg, index) => (
          <div key={index}>{renderMessage(msg)}</div>
        ))}
      </div>
      <div className="terminal-input">
        <span className="prompt">{'>'}</span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: 'none', overflowY: 'auto', maxHeight: '150px' }} // Set a max height and allow scrolling
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}