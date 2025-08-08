import { useState, useEffect } from 'react';
import TreeVisualizer from '@/components/TreeVisualizer';

export default function JsonVisualization() {
  const [treeNames, setTreeNames] = useState<string[]>([]);
  const [selectedTree, setSelectedTree] = useState<string>('');
  const [jsonData, setJsonData] = useState<any>(null);

  useEffect(() => {
    const fetchTreeNames = async () => {
      try {
        const res = await fetch('http://localhost:8000/get-json-tree-names');
        const names = await res.json();
        setTreeNames(names);
        if (names.length > 0) {
          setSelectedTree(names[0]);
        }
      } catch (error) {
        console.error('Error fetching tree names:', error);
      }
    };

    fetchTreeNames();
  }, []);

  useEffect(() => {
    if (!selectedTree) return;

    const fetchJson = async () => {
      try {
        const res = await fetch(`http://localhost:8000/get-json-tree/${selectedTree}`);
        const data = await res.json();
        setJsonData(data);
      } catch (error) {
        console.error('Error fetching JSON tree:', error);
        setJsonData(null);
      }
    };

    fetchJson();
  }, [selectedTree]);

  return (
    <div className="w-full h-full p-6 flex flex-col">
      <div className="w-full max-w-7xl h-full mx-auto bg-white dark:bg-gray-900 dark:text-white p-6 rounded-lg shadow-lg flex flex-col flex-1">
        <label
          htmlFor="tree-selector"
          className="block text-lg font-medium text-gray-600 mb-2"
        >
          Select a Tree:
        </label>

        <select
          id="tree-selector"
          value={selectedTree}
          onChange={(e) => setSelectedTree(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        >
          {treeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {jsonData ? (
              <TreeVisualizer
                jsonData={jsonData}
                treeName={selectedTree}
                // currentPath={['1','1_1','2','2_1','3','3_1']} 
              />
            ) : (
              <p className="text-gray-700">No data available or failed to load the file.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
