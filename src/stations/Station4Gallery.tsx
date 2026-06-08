import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../App';
import { RefreshCw, UploadCloud, Play, Pause } from 'lucide-react';

interface Props {
  appState: AppState;
}

export default function Station4Gallery({ appState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);

  useEffect(() => {
    if (appState.synthAudioBlob) {
      setIsDecoding(true);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      
      appState.synthAudioBlob.arrayBuffer().then(buffer => {
        ctx.decodeAudioData(buffer, (decoded) => {
          setAudioBuffer(decoded);
          setIsDecoding(false);
        }, (err) => {
          console.error("Audio decode error:", err);
          setIsDecoding(false);
        });
      });

      return () => {
        ctx.close();
      };
    }
  }, [appState.synthAudioBlob]);

  const togglePlay = () => {
    if (!audioBuffer || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    if (isPlaying) {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // AudioContext needs to be resumed on Safari
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(ctx.destination);
      source.start();
      sourceRef.current = source;
      startTimeRef.current = ctx.currentTime;
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx || !appState.collapsedImage) return;

    const img = new Image();
    img.src = appState.collapsedImage;
    
    img.onload = () => {
      const render = () => {
        animationRef.current = requestAnimationFrame(render);
        
        // Base image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (isPlaying && audioBuffer && audioCtxRef.current && appState.synthEvents.length > 0) {
          const duration = audioBuffer.duration;
          // Calculate time modulo duration for loop
          const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
          const time = elapsed % duration;
          
          // Find the most recent event
          let currentEvent = appState.synthEvents[0];
          for (let i = appState.synthEvents.length - 1; i >= 0; i--) {
            if (appState.synthEvents[i].time <= time) {
              currentEvent = appState.synthEvents[i];
              break;
            }
          }

          if (currentEvent) {
            const cellW = canvas.width / 16;
            const cellH = canvas.height / 16;

            const drawHighlight = (idx: number, color: string) => {
              const x = (idx % 16) * cellW;
              const y = Math.floor(idx / 16) * cellH;
              
              // Glitch effect: invert colors or add intense color overlay
              ctx.globalCompositeOperation = 'hard-light';
              ctx.fillStyle = color;
              ctx.fillRect(x, y, cellW, cellH);
              
              // Add a border
              ctx.globalCompositeOperation = 'source-over';
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, cellW, cellH);
            };

            drawHighlight(currentEvent.r, 'rgba(255, 0, 0, 0.7)');
            drawHighlight(currentEvent.g, 'rgba(0, 255, 0, 0.7)');
            drawHighlight(currentEvent.b, 'rgba(0, 100, 255, 0.7)');
          }
        }
      };
      
      render();
    };

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [appState.collapsedImage, appState.synthEvents, isPlaying, audioBuffer]);

  const handleSave = () => {
    alert('Subida a repositorio Firebase simulada. (Configura tus credenciales en Firebase para activarlo).');
  };

  const handleRestart = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl animate-fade-in space-y-12 pb-20">
      
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-[0.2em] border-b-4 border-pure-black pb-4">
          Exposición Viva
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto uppercase tracking-widest text-xs">
          La imagen espectral (tiempo colapsado) reacciona al paisaje sonoro. Los 3 cabezales secuenciadores 
          hackean fragmentos espaciales al ritmo de tu voz.
        </p>
      </div>

      <div className="w-full flex flex-col items-center border-4 border-pure-black p-4 bg-white">
         <canvas 
           ref={canvasRef} 
           width={512} 
           height={512} 
           className="w-full max-w-[512px] aspect-square object-cover"
         />

         <div className="flex w-full justify-center mt-6">
           <button 
             onClick={togglePlay}
             disabled={isDecoding || !audioBuffer}
             className="flex items-center space-x-3 px-12 py-4 bg-pure-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors uppercase tracking-widest font-bold shadow-[4px_4px_0px_0px_rgba(255,0,0,1)] active:translate-y-1 active:shadow-none"
           >
             {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
             <span>
               {isDecoding ? 'Decodificando Audio...' : (isPlaying ? 'Pausar Obra' : 'Reproducir Paisaje Sonoro')}
             </span>
           </button>
         </div>
      </div>

      <div className="flex gap-6 mt-12 w-full justify-center">
          <button 
            onClick={handleSave}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-black hover:bg-pure-black hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
          >
            <UploadCloud className="w-4 h-4" /> <span>Subir a Galería</span>
          </button>
          <button 
            onClick={handleRestart}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-red text-pure-red hover:bg-pure-red hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
          >
            <RefreshCw className="w-4 h-4" /> <span>Descartar y Reiniciar</span>
          </button>
      </div>
    </div>
  );
}
