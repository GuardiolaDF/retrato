import { useState, useEffect } from 'react';

interface ConsoleLogProps {
  logs: string[];
  typingSpeed?: number;
}

export function ConsoleLog({ logs, typingSpeed = 30 }: ConsoleLogProps) {
  const [displayedLogs, setDisplayedLogs] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  useEffect(() => {
    if (currentLineIndex < logs.length) {
      const currentLog = logs[currentLineIndex];
      
      if (currentCharIndex < currentLog.length) {
        const timer = setTimeout(() => {
          setDisplayedLogs(prev => {
            const newLogs = [...prev];
            if (newLogs[currentLineIndex] === undefined) {
              newLogs[currentLineIndex] = '';
            }
            newLogs[currentLineIndex] += currentLog[currentCharIndex];
            return newLogs;
          });
          setCurrentCharIndex(prev => prev + 1);
        }, typingSpeed);
        
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setCurrentLineIndex(prev => prev + 1);
          setCurrentCharIndex(0);
        }, 500); // Wait before starting next line
        return () => clearTimeout(timer);
      }
    }
  }, [logs, currentLineIndex, currentCharIndex, typingSpeed]);

  return (
    <div className="brutal-panel p-4 h-full flex flex-col font-mono text-sm">
      <div className="flex items-center justify-between mb-4 border-b border-[var(--color-brutal-border)] pb-2">
        <span className="text-gray-400">TERMINAL OUTPUT</span>
        <span className="w-2 h-2 bg-[var(--color-pure-green)] animate-pulse rounded-full"></span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {displayedLogs.map((log, index) => (
          <div key={index} className="flex">
            <span className="text-gray-500 mr-2">{`>`}</span>
            <span className="text-white">{log}</span>
          </div>
        ))}
        {currentLineIndex < logs.length && (
          <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1 align-middle"></span>
        )}
      </div>
    </div>
  );
}
