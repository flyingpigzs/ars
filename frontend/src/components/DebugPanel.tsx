'use client';

import React, { useEffect, useState } from "react";

interface ChatEntry {
  question_id: string;
  question_text: string;
  user_answer: string;
  chosen_answer: string;
  timestamp: string;
}

interface DebugData {
  session_id: string;
  stack: string[];
  chatHistory: ChatEntry[];
  current_question_id: string;
}

export default function DebugPanel({ session_id }: { session_id: string }) {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/get-conversation-history/${session_id}`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        setDebugData(data);
      } catch (err: any) {
        console.error("Failed to fetch debug data:", err);
        setError(err.message || "Error fetching debug data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
  }, [session_id]);

  if (loading) return <div className="p-6">Loading debug data...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!debugData) return <div className="p-6">No debug data found.</div>;

  return (
    <div className="flex flex-col h-full p-4 max-w-3xl mx-auto">
      {/* p-6 space-y-6 max-w-4xl mx-auto */}
      {/* Session Info */}
      <div className="bg-white dark:bg-gray-800 dark:text-white shadow rounded-lg p-4">
        <p><strong>Session ID:</strong> {debugData.session_id}</p>
        <p><strong>Current Question ID:</strong> {debugData.current_question_id}</p>
        <p><strong>Stack:</strong> {debugData.stack.join(" - ")}</p>
      </div>

      {/* Chat History */}
      <div className="mt-6 bg-white dark:bg-gray-800 dark:text-white shadow rounded-lg p-4 h-full overflow-auto">
        <h3 className="text-xl font-medium mb-4">💬 Chat History</h3>
        <ul className="space-y-4">
          {debugData.chatHistory.map((entry, index) => {
            const formattedTime = new Date(Number(entry.timestamp) * 1000).toLocaleString();
            return (
              <li key={index} className="border-b pb-2">
                <p><strong>Question {entry.question_id}:</strong> {entry.question_text}</p>
                <p><strong>User Answer:</strong> {entry.user_answer}</p>
                <p><strong>Chosen Answer:</strong> {entry.chosen_answer}</p>
                <p className="text-sm text-gray-500">Time: {formattedTime}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
