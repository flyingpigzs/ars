'use client';
// main page of the app, this page is used to display the new chat page and the sidebar.
import Sidebar from '@/components/Sidebar'
import Toolbar from '@/components/Toolbar';
import { useState } from 'react'

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white">
      <Toolbar/>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1">
          <div className="flex items-center justify-center h-full">
          <p>Hi, you can create a new conversation from the left sidebar.<br />
            Have fun! 😉</p>
          </div>
        </div>
      </div>
    </div>
  )
}
