'use client';
import { useEffect, useRef, useState } from "react";
import EastIcon from '@mui/icons-material/East';
import { Message } from "@/types/message";

type Props = {
  session_id: string;
};

export default function ChatWindow({ session_id }: Props) {
  const [user_answer, setUser_answert] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load chat history from JSON file
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/data/chatHistory/${session_id}.json`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Failed to load chat history:", error);
        setMessages([{ role: "assistant", content: "Error loading chat history." }]);
      }
    };

    fetchMessages();
  }, [session_id]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (user_answer.trim() === "") return;

    const userMessage: Message = { role: "user", content: user_answer };
    const updatedMessages: Message[] = [...messages, userMessage];
    setMessages(updatedMessages);
    setUser_answert("");

    try {
      const res = await fetch(`/api/ask-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_answer, session_id }),
      });

      const assistantReply: Message = await res.json();
      const finalMessages = [...updatedMessages, assistantReply];
      setMessages(finalMessages);

      await fetch(`/api/update-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: session_id,
          messages: finalMessages,
        }),
      });
    } catch (error) {
      console.error("Error sending/receiving message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-3xl mx-auto">
      <div className="flex-[5] overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`p-3 max-w-md rounded shadow ${
                msg.role === "user" ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-800 dark:text-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-[1] items-center pt-3">
        <textarea
          value={user_answer}
          onChange={(e) => setUser_answert(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 border rounded-lg p-2 resize-none h-16"
          placeholder="Ask anything..."
        />
        <button
          onClick={handleSend}
          className="ml-2 p-2 rounded-full bg-black text-white hover:bg-gray-800"
        >
          <EastIcon />
        </button>
      </div>
    </div>
  );
}
