'use client';

import { useEffect, useState } from 'react';
import TreeVisualizer from './TreeVisualizer';

type Props = {
  session_id: string;
};

interface ChatEntry {
  question_id: string;
  answer_id: string;
}

interface DebugData {
  chatHistory: ChatEntry[];
}

export default function RoadmapPanel({ session_id }: Props) {
  const [jsonData, setJsonData] = useState<any>(null);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/get-conversation-history/${session_id}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        setDebugData(data);
        const treeRes = await fetch(`http://localhost:8000/get-json-tree/VATSAOIREET`);
        if (!treeRes.ok) throw new Error('Failed to fetch tree JSON');
        const treeData = await treeRes.json();
        setJsonData(treeData);
      } catch (err: any) {
        console.error("Failed to fetch debug data:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
  }, [session_id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!debugData) return <div className="p-4">No debug data found.</div>;

  const currentPath = debugData.chatHistory.flatMap(entry => [entry.question_id, entry.answer_id]);

  return (
    <div className="p-4">
      <TreeVisualizer
        jsonData={jsonData}
        treeName="VATSAOIREET"
        currentPath={currentPath}
      />
    </div>
  );
}
