// this page is used to display the chat history of a specific chat
// when the user clicks on a chat in the sidebar, this page will be displayed
// and the chat history will be loaded from the JSON file in the [public/data/chatHistory] folder
// src/app/chat/[session_id]/page.tsx
'use client';
import Sidebar from '@/components/Sidebar'
import ChatWindow from "@/components/ChatWindow";
import Toolbar from '@/components/Toolbar';
import { use,useState } from 'react';
import DebugPanel from "@/components/DebugPanel";
import RoadmapPanel from "@/components/RoadmapPanel";

export default function Page({ params }: {params: Promise<{ session_id: string }> }) {
  const { session_id } = use(params); 
  const [activeTab, setActiveTab] = useState<'chat' | 'debug' | 'roadmap'>('chat');

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white">
      <Toolbar />

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Content Area */}
              {/* Tab Selector */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-center bg-white shadow dark:bg-gray-800 dark:text-white">
          <div className="flex space-x-4 p-2">
            {['chat', 'debug', 'roadmap'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg ${
                  activeTab === tab ? 'bg-gray-800 text-white dark:bg-gray-300 dark:text-black' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-white'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {activeTab === 'chat' && <ChatWindow session_id={session_id} />}
          {activeTab === 'debug' && <DebugPanel session_id={session_id} />}
          {activeTab === 'roadmap' && <RoadmapPanel session_id={session_id} />}
        </div>
      </div>
    </div>  
    </div>
  );
}
