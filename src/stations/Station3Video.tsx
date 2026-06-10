import { useRef, useState, useEffect } from 'react';
import type { AppState } from '../App';
import { Video, ChevronRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  addLog: (log: string) => void;
}

export default function Station3Video({ onComplete, updateState, addLog }: Props) {
  const [step, setStep] = useState<'intro' | 'recording' | 'done'>('intro');
  const [timeLeft, setTimeLeft] = useState(16);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // To store the running sum of pixel values
  const accumulatorRef = useRef<Float32Array | null>(null);
  const frameCountRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 512 }, height: { ideal: 512 } }, 
        audio: false 
      });
      streamRef.current = stream;
      setStep('recording');
      addLog("Iniciando colapso temporal... Comprimiendo frames espaciales.");
      
      // Initialize accumulator
      accumulatorRef.current = new Float32Array(512 * 512 * 4);
      frameCountRef.current = 0;

      let t = 16;
      setTimeLeft(t);
      
      const captureInterval = setInterval(() => {
        captureFrameProgressive();
      }, 100); // 10 frames per second for smooth progressive collapse

      const timer = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timer);
          clearInterval(captureInterval);
          stopRecording();
          finishCollapse();
        }
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Se requiere acceso a la cámara para esta obra.");
    }
  };

  useEffect(() => {
    if (step === 'recording' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Play error:", e));
    }
  }, [step]);

  const captureFrameProgressive = () => {
    if (!videoRef.current || !canvasRef.current || !accumulatorRef.current) return;
    if (videoRef.current.readyState < 2) return;
    
    // We need a temporary canvas to extract the video frame pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 512;
    tempCanvas.height = 512;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return;

    // Draw current video crop to center
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    tempCtx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 512, 512);

    const imgData = tempCtx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    const acc = accumulatorRef.current;
    
    frameCountRef.current += 1;
    const frames = frameCountRef.current;

    // We will update the visible canvas directly with the averaged data
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const averagedImgData = ctx.createImageData(512, 512);
    const avgData = averagedImgData.data;

    // Accumulate and compute average in one pass
    for (let i = 0; i < data.length; i += 4) {
      acc[i] += data[i];
      acc[i+1] += data[i+1];
      acc[i+2] += data[i+2];
      // no need to accumulate alpha, it's always 255
      
      avgData[i] = acc[i] / frames;
      avgData[i+1] = acc[i+1] / frames;
      avgData[i+2] = acc[i+2] / frames;
      avgData[i+3] = 255; 
    }

    ctx.putImageData(averagedImgData, 0, 0);
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const finishCollapse = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
      updateState({ collapsedImage: dataUrl });
    }
    setStep('done');
    addLog("Colapso temporal completado. Obteniendo fantasma matemático.");
  };

  return (
    <div className="flex flex-col items-center max-w-4xl w-full">
      {step === 'intro' && (
        <div className="text-center space-y-8 animate-fade-in p-8 brutal-panel max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.2em] text-[var(--color-pure-blue)] text-glow-blue">
            EL COLAPSO
          </h1>
          <p className="text-sm max-w-xl mx-auto leading-relaxed text-gray-400">
            El tiempo transcurre en 16 segundos de movimiento. 
            Extraeremos cada estrato temporal y lo aplastaremos progresivamente en una única coordenada espacial,
            generando un fantasma matemático del tiempo.
          </p>
          <button 
            onClick={startRecording}
            className="group flex items-center justify-center space-x-3 mx-auto px-8 py-4 bg-[var(--color-brutal-bg)] border-2 border-[var(--color-pure-blue)] text-[var(--color-pure-blue)] hover:bg-[var(--color-pure-blue)] hover:text-white transition-all duration-300 uppercase tracking-widest font-bold brutal-border"
          >
            <Video className="w-6 h-6" />
            <span>[ GRABAR_COLAPSO: 16s ]</span>
          </button>
        </div>
      )}

      {(step === 'recording' || step === 'done') && (
        <div className="w-full flex flex-col md:flex-row gap-8 items-center justify-center animate-fade-in space-y-6 md:space-y-0">
          
          {step === 'recording' && (
            <div className="relative brutal-panel p-2 flex flex-col items-center">
              <span className="uppercase tracking-widest text-xs font-bold mb-2 text-[var(--color-pure-red)]">[ TIEMPO_REAL ]</span>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-[200px] h-[200px] md:w-[300px] md:h-[300px] object-cover grayscale mix-blend-screen opacity-80"
              />
              <div className="absolute bottom-4 right-4 bg-[var(--color-pure-blue)] text-white px-3 py-1 font-bold text-xl brutal-border text-glow-blue">
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            </div>
          )}

          <div className="relative border-4 border-[var(--color-pure-blue)] bg-[var(--color-brutal-bg)] p-2 flex flex-col items-center brutal-border shadow-[0_0_15px_rgba(0,0,255,0.3)]">
             <span className="uppercase tracking-widest text-xs font-bold mb-2 text-[var(--color-pure-blue)]">
               {step === 'done' ? '[ COLAPSO_FINALIZADO ]' : '[ COLAPSO_PROGRESIVO ]'}
             </span>
             <canvas 
              ref={canvasRef} 
              width={512} 
              height={512} 
              className={`w-[300px] h-[300px] md:w-[400px] md:h-[400px] object-cover mix-blend-screen opacity-90 ${step === 'recording' ? 'animate-pulse' : ''}`}
            />
          </div>

        </div>
      )}

      {step === 'done' && (
        <div className="w-full max-w-2xl text-center mt-12 space-y-6 animate-fade-in">
          <p className="text-gray-400 text-sm">
            16 segundos colapsados en una sola imagen estática.
          </p>
          <button 
            onClick={onComplete}
            className="w-full flex items-center justify-between px-6 py-4 border-2 border-[var(--color-pure-blue)] hover:bg-[var(--color-pure-blue)] hover:text-white text-[var(--color-pure-blue)] transition-colors uppercase tracking-widest font-bold"
          >
            <span>[ INIT_SÍNTESIS_ADITIVA ]</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
