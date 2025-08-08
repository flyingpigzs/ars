// app/voice/page.tsx

import Toolbar from '@/components/Toolbar'
import VoiceSidebar from '@/components/VoiceSidebar'

export default function VoicePage() {
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <VoiceSidebar />
        <div className="flex-1">
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-lg">What can I help you?</p>
          </div>
        </div>
      </div>
    </div>
  )
}
