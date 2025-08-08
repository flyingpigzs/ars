"use client"
import Toolbar from '@/components/Toolbar'
import JsonVisualization from '@/components/JsonVisualization'
import RoadmapQuery from '@/components/RoadmapQuery'
import { useState } from 'react'

export default function TreeVisualizationPage() {
  const [view, setView] = useState<'tree' | 'roadmap'>('tree');
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 dark:bg-gray-900 dark:text-white">
      <Toolbar />

      {/* Tabs or Buttons */}
      <div className="flex justify-center p-4 space-x-4">
        <button
          onClick={() => setView('tree')}
          className={`px-4 py-2 rounded ${view === 'tree' ? 'bg-gray-500 text-white' : 'bg-white text-black'}`}
        >
          Show JSON Tree
        </button>
        <button
          onClick={() => setView('roadmap')}
          className={`px-4 py-2 rounded ${view === 'roadmap' ? 'bg-gray-500 text-white' : 'bg-white text-black'}`}
        >
          Show Json Tree by Sessionid
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 justify-center overflow-hidden">
        {view === 'tree' ? <JsonVisualization /> : <RoadmapQuery />}
      </div>
    </div>
  )
}
