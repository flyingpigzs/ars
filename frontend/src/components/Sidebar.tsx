// display a sidebar with a list of chats and a button to create a new chat
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type ChatItem = {
  id: string;
  title: string;
};

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const [chats, setChats] = useState<ChatItem[]>([]);

    const handleSend = async () => {
      try {
          const res = await fetch('/api/new-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
    
          if (!res.ok) {
            throw new Error('Failed to create new chat')
          }
    
          const data = await res.json()
    
          if (data?.id) {
            router.push(`/chat/${data.id}`) 
          } else {
            console.error('No ID in response:', data)
          }
        } 
        catch (error) {
        console.error('Error sending message:', error)
      }
    }


    useEffect(() => {
      const fetchChats = async () => {
        try {
          const res = await fetch('/api/chats');
          const data = await res.json();
          if (Array.isArray(data)) {
            setChats(data);
          } else {
            console.error('Expected array but got:', data);
            setChats([]);
          }
        } catch (err) {
          console.error('Failed to fetch chats', err);
        }
      };

      fetchChats();
    }, []);


    return (
      <div className="w-1/5 h-full bg-white dark:bg-gray-900 dark:text-white border-r border-gray-300 p-4 flex flex-col">

      <div>
        <div
          className="h-10 flex items-center justify-center mt-4 cursor-pointer"
          onClick={handleSend}
        >
          <p className="h-full w-2/3 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg flex items-center justify-center">
            Create New Chat
          </p>
        </div>
        <h2 className="text-xl font-bold my-4">Chat history</h2>
      </div>


      <div className="flex-1 overflow-y-auto space-y-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => router.push(`/chat/${chat.id}`)}
            className={`p-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
              pathname === `/chat/${chat.id}` ? 'bg-blue-100 text-blue-700' : ''
            }`}
          >
            <p className="truncate">{chat.title}</p>
          </div>
        ))}
      </div>
    </div>
    )
  }