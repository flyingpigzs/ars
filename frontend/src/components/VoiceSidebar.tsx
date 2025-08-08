'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AudioSession {
  title: string;
  id: string;
}

export default function Sidebar() {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const handleSend = async () => {
    try {
        const res = await fetch('/api/new-voicechat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
  
        if (!res.ok) {
          throw new Error('Failed to create new voice chat')
        }
  
        const data = await res.json()
  
        if (data?.id) {
          router.push(`/voicechat/${data.id}`) 
        } else {
          console.error('No ID in response:', data)
        }
      } 
      catch (error) {
      console.error('Error sending message:', error)
    }
  }

  //fetchSessions
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await fetch('/api/voicechats');
        const data = await res.json();
        setSessions(data);
        console.log("Fetched sessions:", data); 
      } catch (err) {
        console.error('Failed to fetch chats', err);
      }
    };
    fetchChats();
  }, []);    


  return (
    <div className="w-1/5 bg-white dark:bg-gray-900 dark:text-white border-r border-gray-300 p-4">
      <div className="space-y-4">
        <div
          className="h-10 flex items-center justify-center mt-4 cursor-pointer"
          onClick={handleSend}
        >
          <p className="h-full w-2/3 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-800 transition">
            New Voice Chat
          </p>
        </div>

        <h2 className="text-xl font-bold">Voice Chat History</h2>

        <div className="flex flex-col gap-2">
          {Array.isArray(sessions) && sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => router.push(`/voicechat/${session.id}`)}
          className={`p-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 ${
            pathname === `/voicechat/${session.id}` ? 'bg-blue-100 text-blue-700' : ''
          }`}
        >
          <p className="truncate">{session.title}</p>
        </div>
      ))}
        </div>
      </div>
    </div>
  );
}

