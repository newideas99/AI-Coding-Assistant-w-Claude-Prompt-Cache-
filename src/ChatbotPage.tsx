import React, { useState, useEffect } from 'react'
import './ChatbotPage.css'
import { 
    processMessage, 
    useAction 
} from 'wasp/client/operations'


export function ChatbotPage() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState<string>('')

  const processMessageFn = useAction(processMessage)

  useEffect(() => {
    setUserId(Math.random().toString(36).substring(7))
    setMessages(['Welcome to the Hacker\'s Terminal. State your query.'])
  }, [])

  const handleSend = async () => {
    if (input.trim() !== '') {
      setMessages(prev => [...prev, `> ${input}`])
      setInput('')
      try {
        const response = await processMessageFn({ message: input, userId })
        setMessages(prev => [...prev, response])
      } catch (error) {
        console.error('Error processing message:', error)
        setMessages(prev => [...prev, 'Error: Unable to process your request.'])
      }
    }
  }

  return (
    <div className="terminal">
      <div className="terminal-header">
        <span className="terminal-title">CODING TERMINAL</span>
      </div>
      <div className="terminal-body">
        {messages.map((msg, index) => (
          <div key={index} className={msg.startsWith('>') ? 'user-message' : 'bot-message'}>
            {msg}
          </div>
        ))}
      </div>
      <div className="terminal-input">
        <span className="prompt">{'>'}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  )
}