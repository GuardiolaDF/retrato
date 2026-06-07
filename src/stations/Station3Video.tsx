import { useRef, useState, useEffect } from 'react';
import type { AppState } from '../App';
import { Video, ChevronRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Station3Video({ onComplete, updateState }: Props) {
  const [step, setStep] = useState<'intro' | 'recording' | 'collapsing' | 'done'>('intro');
  const [timeLeft, setTimeLeft] = useState(20);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finalCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const framesRef = useRef<Uint8ClampedArray[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 512 }, height: { ideal: 512 } }, 
        audio: false 
      });
      streamRef.current = stream;
      setStep('recording');
      framesRef.current = [];

      let t = 20;
      setTimeLeft(t);
      
      const captureInterval = setInterval(() => {
        captureFrame();
      }, 1000); // capture 1 frame per second

      const timer = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timer);
          clearInterval(captureInterval);
          stopRecording();
          collapseFrames();
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

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState < 2) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Draw current video frame to canvas
    ctx.drawImage(videoRef.current, 0, 0, 512, 512);
    // Get pixel data
    const imgData = ctx.getImageData(0, 0, 512, 512);
    framesRef.current.push(imgData.data);
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const collapseFrames = () => {
    setStep('collapsing');
    const frames = framesRef.current;
    if (!finalCanvasRef.current) {
      setStep('done');
      return;
    }
    if (frames.length === 0) {
      console.warn("No frames were captured!");
      setStep('done');
      return;
    }
    
    const ctx = finalCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const numFrames = frames.length;
    const numPixels = frames[0].length;
    const averagedData = new Uint8ClampedArray(numPixels);
    
    // Average each pixel across all frames
    for (let i = 0; i < numPixels; i += 4) {
      let sumR = 0, sumG = 0, sumB = 0;
      for (let f = 0; f < numFrames; f++) {
        sumR += frames[f][i];
        sumG += frames[f][i + 1];
        sumB += frames[f][i + 2];
      }
      averagedData[i] = Math.round(sumR / numFrames);
      averagedData[i + 1] = Math.round(sumG / numFrames);
      averagedData[i + 2] = Math.round(sumB / numFrames);
      averagedData[i + 3] = 255; // Alpha solid
    }
    
    const newImgData = new ImageData(averagedData, 512, 512);
    ctx.putImageData(newImgData, 0, 0);
    
    // Save to state
    updateState({ collapsedImage: finalCanvasRef.current.toDataURL('image/jpeg') });
    
    setTimeout(() => {
      setStep('done');
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center max-w-4xl w-full">
      {/* Hidden canvas for capturing frames */}
      <canvas ref={canvasRef} width={512} height={512} className="hidden" />

      {step === 'intro' && (
        <div className="text-center space-y-8 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.2em] text-pure-blue">
            El Colapso
          </h1>
          <p className="text-xl max-w-2xl mx-auto leading-relaxed">
            El tiempo transcurre en 20 segundos de movimiento. 
            Extraeremos cada estrato temporal y lo aplastaremos en una única coordenada espacial,
            generando un fantasma matemático del tiempo.
          </p>
          <button 
            onClick={startRecording}
            className="group flex items-center justify-center space-x-3 mx-auto px-8 py-4 border-2 border-pure-black hover:bg-pure-black hover:text-pure-white transition-all duration-300 uppercase tracking-widest font-bold"
          >
            <Video className="w-6 h-6" />
            <span>Grabar Tiempo (20s)</span>
          </button>
        </div>
      )}

      {step === 'recording' && (
        <div className="w-full flex flex-col items-center justify-center animate-fade-in space-y-6">
          <div className="relative border-4 border-pure-blue p-2 bg-white">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] object-cover filter grayscale"
            />
            <div className="absolute top-4 right-4 bg-pure-blue text-white px-3 py-1 font-bold text-xl">
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-pure-black text-white px-4 py-1 text-xs uppercase tracking-widest animate-pulse">
              Extrayendo Fotogramas
            </div>
          </div>
        </div>
      )}

      {(step === 'collapsing' || step === 'done') && (
        <div className="w-full flex flex-col items-center justify-center animate-fade-in space-y-8">
           <div className="relative border-4 border-pure-black p-2 bg-white">
             <canvas 
              ref={finalCanvasRef} 
              width={512} 
              height={512} 
              className={`w-[300px] h-[300px] md:w-[400px] md:h-[400px] object-cover transition-opacity duration-1000 ${step === 'collapsing' ? 'opacity-50' : 'opacity-100'}`}
            />
            {step === 'collapsing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <span className="bg-pure-black text-white px-4 py-2 uppercase tracking-widest font-bold animate-pulse">
                  Promediando Matrices...
                </span>
              </div>
            )}
           </div>
           
           {step === 'done' && (
             <div className="w-full max-w-2xl text-center space-y-6">
                <p className="text-gray-600">
                  20 segundos colapsados en una sola imagen estática.
                </p>
                <button 
                  onClick={onComplete}
                  className="w-full flex items-center justify-between px-6 py-4 bg-pure-black text-pure-white hover:bg-gray-800 transition-colors uppercase tracking-widest font-bold"
                >
                  <span>Ver Exposición Final</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
             </div>
           )}
        </div>
      )}
    </div>
  );
}
