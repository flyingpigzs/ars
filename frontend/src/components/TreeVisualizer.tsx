import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  addEdge,
  ConnectionLineType,
  Controls,
  Background,
  Node,
  Edge,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface QuestionNode {
  questionId: string;
  questionText: {
    FI: string;
  };
  category?: {
    categoryId: number;
    subcategoryId: number;
    backgroundCategory: string;
  };
  type: string;
  answers: AnswerNode[];
}

interface AnswerNode {
  answerId: string;
  printText: {
    FI: string;
  };
  answerText: {
    FI: string;
  };
  question: QuestionNode[];
}

interface TreeVisualizerProps {
  jsonData: any;
  treeName: string;
  currentPath?: string[];
  highlightPath?: boolean;
}

// Key change 1: Define the default empty array outside the component to stabilize its reference
const DEFAULT_CURRENT_PATH: string[] = [];

const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
  jsonData,
  treeName,
  currentPath = DEFAULT_CURRENT_PATH, // Use the stable default value
  highlightPath = true,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const { fitView, setViewport } = useReactFlow();

  const onConnect = useCallback(
    (params: any) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#555' },
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Build the flowchart nodes and edges from the symptom tree
  const buildTreeGraph = useCallback(
    (treeData: any[], pathArg: string[]) => { // Renamed the received currentPath parameter to pathArg
      setLoading(true);

      if (!treeData || !Array.isArray(treeData)) {
        console.error('Invalid tree data:', treeData);
        setLoading(false);
        return;
      }

      const newNodes: Node[] = []; // Use local variables to avoid directly modifying state or old values in closures
      const newEdges: Edge[] = [];
      const pathNodeIds = new Set<string>();
      let questionCounter = 0;
      let answerCounter = 0;

      // First, identify all nodes in the current path
      // Use pathArg instead of currentPath (prop)
      if (pathArg.length > 0 && highlightPath) {
        const findPathNodes = (questions: any[]) => {
          for (const pathItem of pathArg) { // Use pathArg
            let questionId = '';
            if (pathItem?.includes('_')) {
              questionId = pathItem.split('_')[0];
            }
            pathNodeIds.add(`question-${questionId}`);
            pathNodeIds.add(`answer-${pathItem}`);
          }
        };
        // Assume treeData is of type QuestionNode[]
        findPathNodes(treeData as QuestionNode[]);
      }

      type QuestionPosition = {
        id: string;
        x: number;
        y: number;
        parentAnswerId?: string;
      };

      const allQuestions: QuestionPosition[] = [];

      const processTree = () => {
        const horizontalSpacing = 250;
        const verticalSpacing = 150;
        const questionWidth = 250;
        const answerWidth = 200;

        const flattenTree = (questions: any[]) => {
          for (const question of questions) {
            questionCounter++;
            allQuestions.push({
              id: question.questionId,
              x: 0,
              y: allQuestions.length * verticalSpacing * 2,
            });
            if (question.answers) {
              for (const answer of question.answers) {
                answerCounter++;
                if (answer.question && answer.question.length > 0) {
                  flattenTree(answer.question);
                }
              }
            }
          }
        };

        flattenTree(treeData);

        for (let i = 0; i < allQuestions.length; i++) {
          const questionPos = allQuestions[i];
          const questionId = questionPos.id;
          const questionData = findQuestionById(treeData, questionId);
          if (!questionData) continue;

          const question = questionData;
          const questionNodeId = `question-${question.questionId}`;
          const isQuestionInPath = pathNodeIds.has(questionNodeId);
          const questionX = 0;
          const questionY = i * verticalSpacing * 2;

          newNodes.push({ // Add to newNodes
            id: questionNodeId,
            type: 'default',
            data: {
              label: (
                <div className="node-content">
                  <div className="node-id">{question.questionId}</div>
                  <div className="node-text">
                    {question.questionText?.FI || 'No question text'}
                  </div>
                </div>
              ),
            },
            position: { x: questionX, y: questionY },
            style: {
              background: isQuestionInPath ? '#e6f7ff' : '#ffffff',
              border: isQuestionInPath ? '2px solid #1890ff' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '10px',
              width: questionWidth,
              boxShadow: isQuestionInPath
                ? '0 0 10px rgba(24, 144, 255, 0.5)'
                : '0 1px 4px rgba(0, 0, 0, 0.1)',
            },
          });

          if (questionPos.parentAnswerId) {
            newEdges.push({ // Add to newEdges
              id: `edge-${questionPos.parentAnswerId}-to-${questionNodeId}`,
              source: questionPos.parentAnswerId,
              target: questionNodeId,
              type: 'smoothstep',
              animated:
                isQuestionInPath && pathNodeIds.has(questionPos.parentAnswerId),
              style: {
                stroke:
                  isQuestionInPath && pathNodeIds.has(questionPos.parentAnswerId)
                    ? '#1890ff'
                    : '#555',
                strokeWidth:
                  isQuestionInPath && pathNodeIds.has(questionPos.parentAnswerId) ? 2 : 1,
              },
              markerEnd: { type: MarkerType.ArrowClosed },
            });
          }

          const isTopLevelQuestion = isQuestionTopLevel(
            question.questionId,
            treeData
          );
          if (i > 0 && isTopLevelQuestion) {
            const prevQuestion = allQuestions[i - 1];
            const prevQuestionNodeId = `question-${prevQuestion.id}`;
            const prevQuestionData = findQuestionById(treeData, prevQuestion.id);
            const isPrevTopLevel = prevQuestionData
              ? isQuestionTopLevel(prevQuestionData.questionId, treeData)
              : false;

            if (isPrevTopLevel) {
              newEdges.push({ // Add to newEdges
                id: `edge-sequence-${prevQuestionNodeId}-to-${questionNodeId}`,
                source: prevQuestionNodeId,
                target: questionNodeId,
                type: 'smoothstep',
                animated:
                  isQuestionInPath && pathNodeIds.has(prevQuestionNodeId),
                style: {
                  stroke: '#888',
                  strokeWidth: 1,
                  strokeDasharray: '5,5',
                },
                markerEnd: { type: MarkerType.ArrowClosed },
              });
            }
          }

          if (question.answers && question.answers.length > 0) {
            const answers = question.answers;
            const totalAnswerWidth = answers.length * horizontalSpacing;
            const startX = questionX - totalAnswerWidth / 2 + horizontalSpacing / 2;

            for (let j = 0; j < answers.length; j++) {
              const answer = answers[j];
              const answerId = `answer-${answer.answerId}`;
              const isAnswerInPath = pathNodeIds.has(answerId);
              const answerX = startX + j * horizontalSpacing;
              const answerY = questionY + verticalSpacing;

              newNodes.push({ // Add to newNodes
                id: answerId,
                type: 'default',
                data: {
                  label: (
                    <div className="node-content answer-node">
                      <div className="node-id">{answer.answerId}</div>
                      <div className="node-text">
                        {answer.answerText?.FI || 'No answer text'}
                      </div>
                    </div>
                  ),
                },
                position: { x: answerX, y: answerY },
                style: {
                  background: isAnswerInPath ? '#f6ffed' : '#f9f9f9',
                  border: isAnswerInPath ? '2px solid #52c41a' : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '10px',
                  width: answerWidth,
                  boxShadow: isAnswerInPath
                    ? '0 0 10px rgba(82, 196, 26, 0.5)'
                    : 'none',
                },
              });

              newEdges.push({ // Add to newEdges
                id: `edge-${questionNodeId}-to-${answerId}`,
                source: questionNodeId,
                target: answerId,
                type: 'smoothstep',
                animated:
                  isAnswerInPath && pathNodeIds.has(questionNodeId),
                style: {
                  stroke:
                    isAnswerInPath && pathNodeIds.has(questionNodeId)
                      ? '#52c41a'
                      : '#555',
                  strokeWidth:
                    isAnswerInPath && pathNodeIds.has(questionNodeId) ? 2 : 1,
                },
                markerEnd: { type: MarkerType.ArrowClosed },
              });

              if (answer.question && answer.question.length > 0) {
                for (const nestedQuestion of answer.question) {
                  const nextQuestionIndex = allQuestions.findIndex(
                    (q) => q.id === nestedQuestion.questionId
                  );
                  if (nextQuestionIndex !== -1) {
                    allQuestions[nextQuestionIndex].parentAnswerId = answerId;
                  }
                }
              }
            }
          }
        }
      };

      const findQuestionById = (questions: any[], id: string): any => {
        for (const question of questions) {
          if (question.questionId === id) {
            return question;
          }
          if (question.answers) {
            for (const answer of question.answers) {
              if (answer.question && answer.question.length > 0) {
                const found = findQuestionById(answer.question, id);
                if (found) return found;
              }
            }
          }
        }
        return null;
      };

      const isQuestionTopLevel = (questionId: string, questions: any[]): boolean => {
        for (const question of questions) {
          if (question.questionId === questionId) {
            return true;
          }
        }
        return false;
      };

      processTree();

      setNodeCount(questionCounter + answerCounter);
      setNodes(newNodes); // Use local variables to update state
      setEdges(newEdges); // Use local variables to update state
      setLoading(false);

      // scroll to the top node after a short delay
      setTimeout(() => {
        const topNode = newNodes[0]; // Assuming the first node is the top node
        if (topNode && topNode.position) {
          setViewport({ x: topNode.position.x, y: topNode.position.y, zoom: 1 });
        } else {
          fitView();
        }
      }, 100);
    },
    // Key change 2: Ensure the useCallback dependency array is complete
    [setNodes, setEdges, highlightPath, setLoading, setNodeCount]
  );

  // Effect to build the graph whenever the data changes
  useEffect(() => {
    if (jsonData) {
      // Pass currentPath from props to buildTreeGraph
      buildTreeGraph(jsonData, currentPath);
    }
  }, [jsonData, currentPath, buildTreeGraph]); // useEffect dependencies

  return (
    <div className="tree-visualizer">
      <div className="tree-info">
        <div className="tree-title">{treeName}</div>
        <div className="tree-stats">
          <span>{nodeCount} nodes</span>
          {currentPath && currentPath.length > 0 && (
            <span>Current path: {currentPath.join(' → ')}</span>
          )}
        </div>
      </div>
      {/* Important change: Add style to tree-flow-container to ensure it has height and width */}
      <div className="tree-flow-container" style={{ height: '1500px', width: '100%' }}>
        {loading ? (
          <div className="loading">Loading tree visualization...</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            connectionLineType={ConnectionLineType.SmoothStep}
            attributionPosition="bottom-right"
          >
            <Controls />
            <MiniMap />
            <Background color="#f5f5f5" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
};

const TreeVisualizerWrapper: React.FC<TreeVisualizerProps> = (props) => {
  return (
    <ReactFlowProvider>
      <TreeVisualizer {...props} />
    </ReactFlowProvider>
  );
};

export default TreeVisualizerWrapper;