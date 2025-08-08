'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function Toolbar() {
  const router = useRouter()
  const pathname = usePathname()

  const isTextChatActive = pathname === '/' || pathname.startsWith('/chat')
  const isVoiceChatActive = pathname === '/voice' || pathname.startsWith('/voicechat')
  const isTreeVisualizationActive = pathname === '/treevisualization' || pathname.startsWith('/treevisualization')
  return (
    <div className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white shadow p-4 flex justify-end items-center gap-4 border-b border-gray-300">
      <div className="ml-[6.25%] text-lg font-semibold cursor-pointer" onClick={() => router.push('/')}>ARS</div>

      <div className="ml-auto flex gap-4">
        <button
          className={`px-4 py-2 rounded ${isTextChatActive ? 'bg-gray-200 dark:bg-gray-200 dark:text-black': 'bg-black text-white dark:bg-gray-900 dark:text-white' }`}
          onClick={() => router.push('/')}
        >
          Text Chat
        </button>
        <button
          className={`px-4 py-2 rounded ${isVoiceChatActive ?  'bg-gray-200 dark:bg-gray-200 dark:text-black': 'bg-black text-white dark:bg-gray-900 dark:text-white' }`}
          onClick={() => router.push('/voice')}
        >
          Voice Chat
        </button>
        <button
          className={`px-4 py-2 rounded ${isTreeVisualizationActive ?  'bg-gray-200 dark:bg-gray-200 dark:text-black': 'bg-black text-white dark:bg-gray-900 dark:text-white' }`}
          onClick={() => router.push('/treevisualization')}
        >
          Tree Visualization
        </button>
      </div>
    </div>
  )
}
