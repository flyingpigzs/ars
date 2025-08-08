import { useState } from 'react';
import RoadmapPanel from './RoadmapPanel'; 

export default function RoadmapQuery() {
  const [sessionId, setSessionId] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleQuery = () => {
    if (sessionId.trim() !== '') {
      setSubmittedId(sessionId.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-start w-full p-8 space-y-6">
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Session ID..."
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="w-96 px-4 py-3 rounded border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-800"
        />
        <button
          onClick={handleQuery}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
            Query Roadmap
        </button>
      </div>

      {submittedId && (
        <div className="w-full">
          <RoadmapPanel session_id={submittedId} />
        </div>
      )}
    </div>
  );
}
