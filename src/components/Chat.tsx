import React, { useState } from 'react';
import { chatbotService } from '../lib/chatbot';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await chatbotService.getResponse(userMessage);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            console.error('Error getting response:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I apologize, but I'm having trouble processing your request. Please try again later."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <Card
                        key={index}
                        className={`p-4 ${
                            message.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'
                        } max-w-[80%]`}
                    >
                        {message.content}
                    </Card>
                ))}
                {isLoading && (
                    <Card className="p-4 bg-muted max-w-[80%]">
                        Thinking...
                    </Card>
                )}
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t">
                <div className="flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question about the uploaded documents..."
                        disabled={isLoading}
                    />
                    <Button type="submit" disabled={isLoading}>
                        Send
                    </Button>
                </div>
            </form>
        </div>
    );
} 