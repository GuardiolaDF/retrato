import { useState } from 'react';
import Station1Capture from './stations/Station1Capture';
import Station2Voice from './stations/Station2Voice';
import Station3Video from './stations/Station3Video';
import Station4Gallery from './stations/Station4Gallery';
import GalleryPage from './stations/GalleryPage';

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

  const updateState = (updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  };

  const nextStation = () => setCurrentStation(s => Math.min(s + 1, 4));

  if (showGallery) {
    return <GalleryPage onBack={() => setShowGallery(false)} />;
  }

  return (
    <div className="min-h-screen w-full bg-pure-white text-pure-black font-mono selection:bg-pure-black selection:text-pure-white flex flex-col items-center justify-center p-8">
      {currentStation === 1 && <Station1Capture onComplete={nextStation} appState={appState} updateState={updateState} />}
      {currentStation === 2 && <Station2Voice onComplete={nextStation} appState={appState} updateState={updateState} />}
      {currentStation === 3 && <Station3Video onComplete={nextStation} appState={appState} updateState={updateState} />}
      {currentStation === 4 && <Station4Gallery appState={appState} onShowGallery={() => setShowGallery(true)} />}
      
      <div className="fixed bottom-4 left-4 text-xs font-mono text-gray-400">
        AUTORETRATO DECONSTRUIDO // ACTO 0{currentStation}
      </div>
    </div>
  );
}

export default App;
