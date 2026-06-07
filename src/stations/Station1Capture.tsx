import { useRef, useState, useEffect } from 'react';
import type { AppState } from '../App';
import { Camera, Download, ChevronRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Station1Capture({ onComplete, updateState }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [step, setStep] = useState<'intro' | 'camera' | 'collapsing' | 'data'>('intro');
  const [resolution, setResolution] = useState(512);
  
  const [matrices, setMatrices] = useState<{hex: string[][], luma: number[][], rgb: number[][][]}>({
    hex: [], luma: [], rgb: []
  });

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 512 }, height: { ideal: 512 } }, 
        audio: false 
      });
      setStream(mediaStream);
      setStep('camera');
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Se requiere acceso a la cámara para esta obra.");
    }
  };

  useEffect(() => {
    if (step === 'camera' && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Play error:", e));
    }
  }, [step, stream]);

  const captureAndCollapse = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Draw initial high-res capture using natural video dimensions
    canvasRef.current.width = 512;
    canvasRef.current.height = 512;
    if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      const size = Math.min(vw, vh);
      const sx = (vw - size) / 2;
      const sy = (vh - size) / 2;
      ctx.drawImage(videoRef.current, sx, sy, size, size, 0, 0, 512, 512);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 512, 512);
    }

    // Stop video stream AFTER drawing to avoid blanking
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    setStep('collapsing');
    
    // Save original image to state and create an Image object for safe downsampling
    const originalDataUrl = canvasRef.current.toDataURL('image/jpeg');
    updateState({ originalImage: originalDataUrl });
    const originalImg = new Image();
    originalImg.src = originalDataUrl;

    // Start collapsing animation
    const resolutions = [256, 128, 64, 32, 16];
    let i = 0;
    
    const interval = setInterval(() => {
      if (i < resolutions.length) {
        const currentRes = resolutions[i];
        setResolution(currentRes);
        
        // Downsample technique
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentRes;
        tempCanvas.height = currentRes;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx && originalImg.complete) {
          // Draw from original to temp (downscale safely)
          tempCtx.drawImage(originalImg, 0, 0, currentRes, currentRes);
          
          // Disable smoothing to get pixelated look
          ctx.imageSmoothingEnabled = false;
          (ctx as any).webkitImageSmoothingEnabled = false;
          (ctx as any).mozImageSmoothingEnabled = false;
          (ctx as any).msImageSmoothingEnabled = false;
          
          // Clear and draw from temp to main (upscale)
          ctx.clearRect(0, 0, 512, 512);
          ctx.drawImage(tempCanvas, 0, 0, currentRes, currentRes, 0, 0, 512, 512);
        }
        i++;
      } else {
        clearInterval(interval);
        extractData(16);
      }
    }, 1000);
  };

  const extractData = (res: number) => {
    if (!canvasRef.current) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = res;
    tempCanvas.height = res;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.drawImage(canvasRef.current, 0, 0, res, res);
    const imageData = tempCtx.getImageData(0, 0, res, res).data;
    
    const hexMatrix: string[][] = [];
    const lumaMatrix: number[][] = [];
    const rgbMatrix: number[][][] = [];
    
    for (let y = 0; y < res; y++) {
      const hexRow: string[] = [];
      const lumaRow: number[] = [];
      const rgbRow: number[][] = [];
      
      for (let x = 0; x < res; x++) {
        const i = (y * res + x) * 4;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        
        const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        hexRow.push(hex);
        lumaRow.push(luma);
        rgbRow.push([r, g, b]);
      }
      hexMatrix.push(hexRow);
      lumaMatrix.push(lumaRow);
      rgbMatrix.push(rgbRow);
    }
    
    setMatrices({ hex: hexMatrix, luma: lumaMatrix, rgb: rgbMatrix });
    updateState({ matrixLuma: lumaMatrix, matrixRGB: rgbMatrix });
    setStep('data');
  };

  const downloadCSV = (type: 'hex' | 'luma') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const matrix = type === 'hex' ? matrices.hex : matrices.luma;
    
    matrix.forEach(row => {
      csvContent += row.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `matriz_${type}_16x16.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center max-w-4xl w-full">
      {step === 'intro' && (
        <div className="text-center space-y-8 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.2em] text-pure-red">
            Discretización
          </h1>
          <p className="text-xl max-w-2xl mx-auto leading-relaxed">
            La identidad humana colapsa en la grilla tecnológica. La luz y el color no son más que 
            una asignación numérica dentro de una matriz geométrica.
          </p>
          <button 
            onClick={startCamera}
            className="group flex items-center justify-center space-x-3 mx-auto px-8 py-4 border-2 border-pure-black hover:bg-pure-black hover:text-pure-white transition-all duration-300 uppercase tracking-widest font-bold"
          >
            <Camera className="w-6 h-6" />
            <span>Iniciar Extracción</span>
          </button>
        </div>
      )}

      {(step === 'camera' || step === 'collapsing' || step === 'data') && (
        <div className="w-full flex flex-col md:flex-row gap-8 items-start justify-center">
          <div className="relative border-4 border-pure-black p-2 bg-white flex-shrink-0">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-[300px] h-[300px] md:w-[400px] md:h-[400px] object-cover ${step !== 'camera' ? 'hidden' : ''}`}
            />
            <canvas 
              ref={canvasRef} 
              className={`w-[300px] h-[300px] md:w-[400px] md:h-[400px] object-cover ${step === 'camera' ? 'hidden' : ''}`}
              style={{ imageRendering: 'pixelated', WebkitImageRendering: 'crisp-edges' } as any}
            />
            {step === 'collapsing' && (
              <div className="absolute top-4 left-4 bg-pure-red text-white px-2 py-1 text-xs font-bold uppercase animate-pulse">
                Colapsando: {resolution}x{resolution}
              </div>
            )}
            {step === 'camera' && (
              <button 
                onClick={captureAndCollapse}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-pure-red hover:bg-red-700 text-white px-6 py-2 uppercase tracking-widest font-bold border-2 border-pure-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-y-1 active:shadow-none"
              >
                Capturar
              </button>
            )}
          </div>

          {step === 'data' && (
            <div className="flex flex-col space-y-6 w-full animate-fade-in text-sm">
              <div className="border border-pure-black p-4 bg-gray-50">
                <h3 className="font-bold uppercase tracking-widest mb-2 flex items-center text-pure-blue">
                  <span className="w-3 h-3 bg-pure-blue inline-block mr-2"></span>
                  Matriz Numérica 16x16
                </h3>
                <p className="text-gray-600 mb-4 text-xs">
                  La topología bidimensional ha sido preservada. Cada celda corresponde a la luminosidad exacta de la captura.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => downloadCSV('hex')} className="flex items-center space-x-2 text-pure-black hover:text-pure-blue transition-colors border border-pure-black px-3 py-2 text-xs">
                    <Download className="w-4 h-4" /> <span>HEX CSV</span>
                  </button>
                  <button onClick={() => downloadCSV('luma')} className="flex items-center space-x-2 text-pure-black hover:text-pure-blue transition-colors border border-pure-black px-3 py-2 text-xs">
                    <Download className="w-4 h-4" /> <span>LUMA CSV</span>
                  </button>
                </div>
              </div>
              
              <button 
                onClick={onComplete}
                className="w-full flex items-center justify-between px-6 py-4 bg-pure-black text-pure-white hover:bg-gray-800 transition-colors uppercase tracking-widest font-bold"
              >
                <span>Avanzar al Interfaz Sonoro</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
