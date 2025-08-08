
'use client';
import VoiceSidebar from '@/components/VoiceSidebar';
import Toolbar from '@/components/Toolbar';
import VoiceChatWindow from '@/components/VoiceChatWindow';
import { useState } from 'react';
import { use } from 'react';

export default function Page({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = use(params); 

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white ">
      <Toolbar/>
      <div className="flex flex-1 overflow-hidden">
        <VoiceSidebar />
        <div className="flex-1">
          {/* <p>{session_id}</p> */}
            <VoiceChatWindow session_id={session_id}/>
        </div>
      </div>
    </div>
  )
}