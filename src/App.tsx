import { useState } from 'react';
import Station1Capture from './stations/Station1Capture';
import Station2Voice from './stations/Station2Voice';
import Station3Video from './stations/Station3Video';
import Station4Gallery from './stations/Station4Gallery';
import GalleryPage from './stations/GalleryPage';
import { ConsoleLog } from './components/ConsoleLog';

export type AppState = {
  originalImage: string | null;
  matrixLuma: number[][];
  matrixRGB: number[][][];
  audioBlob: Blob | null;
  synthAudioBlob: Blob | null;
  synthEvents: { time: number, r: number, g: number, b: number }[];
  collapsedImage: string | null;
};

function App() {
  const [currentStation, setCurrentStation] = useState<number>(1);
  const [showGallery, setShowGallery] = useState(false);
  const [appState, setAppState] = useState<AppState>({
    originalImage: null,
    matrixLuma: [],
    matrixRGB: [],
    audioBlob: null,
    synthAudioBlob: null,
    synthEvents: [],
    collapsedImage: null,
  });
  const [logs, setLogs] = useState<string[]>([
    "SISTEMA INICIADO...",
    "CONECTANDO A INTERFAZ ÓPTICA.",
    "ESPERANDO ENTRADA DE USUARIO..."
  ]);

  const addLog = (log: string) => {
    setLogs(prev => [...prev, log]);
  };

  const updateState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  const nextStation = () => setCurrentStation(s => Math.min(s + 1, 4));

  if (showGallery) {
    return <GalleryPage onBack={() => setShowGallery(false)} />;
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-brutal-bg)] text-pure-white font-mono selection:bg-pure-white selection:text-pure-black flex p-4 md:p-8 gap-4 md:gap-8 h-screen overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 brutal-panel p-6 flex flex-col items-center justify-center relative overflow-y-auto">
        {currentStation === 1 && <Station1Capture onComplete={nextStation} appState={appState} updateState={updateState} addLog={addLog} />}
        {currentStation === 2 && <Station2Voice onComplete={nextStation} appState={appState} updateState={updateState} addLog={addLog} />}
        {currentStation === 3 && <Station3Video onComplete={nextStation} appState={appState} updateState={updateState} addLog={addLog} />}
        {currentStation === 4 && <Station4Gallery appState={appState} onShowGallery={() => setShowGallery(true)} addLog={addLog} />}
        
        <div className="absolute bottom-4 left-4 text-xs font-mono text-gray-500 brutal-border px-2 py-1">
          ACTO 0{currentStation} // V.FLUSSER_MODE
        </div>
      </div>

      {/* Terminal Area */}
      <div className="hidden md:block w-1/3 max-w-sm h-full">
        <ConsoleLog logs={logs} typingSpeed={20} />
      </div>
    </div>
  );
}

export default App;
