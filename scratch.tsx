import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../App';
import { RefreshCw, UploadCloud, Play, Pause, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  appState: AppState;
  onShowGallery: () => void;
}

export default function Station4Gallery({ appState, onShowGallery }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [artistName, setArtistName] = useState('');

  // Stop everything on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const togglePlay = async () => {
    if (isPlaying) {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
      return;
    }

    if (!appState.audioBlob || !appState.matrixRGB.length || !appState.matrixLuma.length) return;

    setIsDecoding(true);
    try {
      const arrayBuffer = await appState.audioBlob.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(ctx.destination);

      // Helper to create an FM Voice
      const createFMVoice = (baseFreq: number) => {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const vca = ctx.createGain();

        // Delay for overlapping chaotic sounds
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.3; // 300ms delay
        const feedback = ctx.createGain();
        feedback.gain.value = 0.5; // 50% feedback
        delay.connect(feedback);
        feedback.connect(delay);

        carrier.type = 'sine';
        modulator.type = 'sine';
        
        modulator.frequency.value = baseFreq * 2;
        modGain.gain.value = 100;
        vca.gain.value = 0;

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(vca);
        vca.connect(masterGain);
        
        // Connect VCA to delay
        vca.connect(delay);
        delay.connect(masterGain);

        carrier.start();
        modulator.start();

        return { carrier, modulator, modGain, vca };
      };

      const voiceR = createFMVoice(50);  // Low
      const voiceG = createFMVoice(200); // Mid
      const voiceB = createFMVoice(800); // High

      source.start();
      setIsDecoding(false);
      setIsPlaying(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const canvas = canvasRef.current;
      const canvasCtx = canvas?.getContext('2d');

      if (!canvas || !canvasCtx || !appState.collapsedImage) return;

      const img = new Image();
      img.src = appState.collapsedImage;

      // Sequencer state
      const rgb = appState.matrixRGB;
      const luma = appState.matrixLuma;

      const getPixel = (idx: number) => {
        const y = Math.floor(idx / 16);
        const x = idx % 16;
        return { r: rgb[y][x][0], g: rgb[y][x][1], b: rgb[y][x][2], l: luma[y][x] };
      };

      // Create 3 independent paths using a chaotic deterministic hash of the pixel values.
      // This ensures every slightly different photo produces a radically different sequence and sonic landscape.
      const indices = Array.from({length: 256}, (_, i) => i);
      const getChaos = (p: {r: number, g: number, b: number, l: number}, seed: number) => {
        const val = Math.sin(p.r * 12.9898 + p.g * 78.233 + p.b * 37.719 + seed) * 43758.5453;
        return val - Math.floor(val);
      };
      const pathR = [...indices].sort((a, b) => getChaos(getPixel(a), 1) - getChaos(getPixel(b), 1));
      const pathG = [...indices].sort((a, b) => getChaos(getPixel(a), 2) - getChaos(getPixel(b), 2));
      const pathB = [...indices].sort((a, b) => getChaos(getPixel(a), 3) - getChaos(getPixel(b), 3));

      const startTime = ctx.currentTime;
      let didEnd = false;
      let lastStep = -1;
      const particles: {x: number, y: number, color: string, life: number}[] = [];

      const activeBuffer = document.createElement('canvas');
      activeBuffer.width = 512;
      activeBuffer.height = 512;
      const activeCtx = activeBuffer.getContext('2d');

      const tempBuffer = document.createElement('canvas');
      tempBuffer.width = 512;
      tempBuffer.height = 512;
      const tempCtx = tempBuffer.getContext('2d');

      img.onload = () => {
        if (activeCtx) activeCtx.drawImage(img, 0, 0, 512, 512);

        const draw = () => {
          if (audioCtxRef.current !== ctx || didEnd) return; // Stale instance
          animationRef.current = requestAnimationFrame(draw);
          
          const elapsed = ctx.currentTime - startTime;
          const progress = elapsed / 16.0; // Fixed 16 seconds timeline

          if (progress >= 1.0) {
            if (!didEnd) {
              didEnd = true;
              // Fade out audio over 2 seconds instead of hard stop
              masterGain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.5);
              setTimeout(() => {
                try { source.stop(); } catch(e){}
                setIsPlaying(false);
              }, 2000);
            }
            return; // Freeze visuals
          }

          const step = Math.floor(progress * 256);
          const idxR = pathR[Math.min(step, 255)];
          const idxG = pathG[Math.min(step, 255)];
          const idxB = pathB[Math.min(step, 255)];

          // Audio logic
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const cv = rms > 0.05 ? rms * 2 : 0.01;

          if (step !== lastStep) {
            lastStep = step;
            const initialLife = Math.min(cv + 0.3, 1.0); // Make sure it flashes even on quiet sounds
            particles.push({x: idxR % 16, y: Math.floor(idxR / 16), color: '255, 0, 0', life: initialLife});
            particles.push({x: idxG % 16, y: Math.floor(idxG / 16), color: '0, 255, 0', life: initialLife});
            particles.push({x: idxB % 16, y: Math.floor(idxB / 16), color: '0, 0, 255', life: initialLife});
          }

          // Map synth parameters
          const pxR = getPixel(idxR);
          const pxG = getPixel(idxG);
          const pxB = getPixel(idxB);

          voiceR.carrier.frequency.setTargetAtTime(40 + pxR.r * 0.5, ctx.currentTime, 0.05);
          voiceR.modulator.frequency.setTargetAtTime((40 + pxR.r * 0.5) * (pxR.g / 50 + 0.1), ctx.currentTime, 0.05);
          voiceR.modGain.gain.setTargetAtTime(pxR.l * 5, ctx.currentTime, 0.05);
          voiceR.vca.gain.setTargetAtTime(Math.min(cv, 1), ctx.currentTime, 0.2); // Longer release

          voiceG.carrier.frequency.setTargetAtTime(150 + pxG.g * 1.5, ctx.currentTime, 0.05);
          voiceG.modulator.frequency.setTargetAtTime((150 + pxG.g * 1.5) * (pxG.b / 50 + 0.1), ctx.currentTime, 0.05);
          voiceG.modGain.gain.setTargetAtTime(pxG.l * 10, ctx.currentTime, 0.05);
          voiceG.vca.gain.setTargetAtTime(Math.min(cv * 0.8, 1), ctx.currentTime, 0.2); // Longer release

          voiceB.carrier.frequency.setTargetAtTime(600 + pxB.b * 4, ctx.currentTime, 0.05);
          voiceB.modulator.frequency.setTargetAtTime((600 + pxB.b * 4) * (pxB.r / 50 + 0.1), ctx.currentTime, 0.05);
          voiceB.modGain.gain.setTargetAtTime(pxB.l * 15, ctx.currentTime, 0.05);
          voiceB.vca.gain.setTargetAtTime(Math.min(cv * 0.6, 1), ctx.currentTime, 0.2); // Longer release

          const cellW = canvas.width / 16;
          const cellH = canvas.height / 16;

          // Process cumulative deformations
          if (tempCtx && activeCtx) {
            tempCtx.globalCompositeOperation = 'source-over';
            tempCtx.drawImage(activeBuffer, 0, 0);

            for (let i = particles.length - 1; i >= 0; i--) {
              const p = particles[i];
              p.life *= 0.97; // Slower decay
              
              if (p.life < 0.01) {
                particles.splice(i, 1);
                continue;
              }

              const cx = (p.x + 0.5) * cellW;
              const cy = (p.y + 0.5) * cellH;
              const radius = cellW * 5.0; // Large area of effect

              activeCtx.save();
              activeCtx.beginPath();
              activeCtx.arc(cx, cy, radius, 0, Math.PI * 2);
              activeCtx.clip();

              activeCtx.globalAlpha = 0.5 * p.life; // Gradual intensity based on ADSR envelope
              
              if (p.color === '255, 0, 0') {
                // Red: Licuar (Smudge/Shift)
                activeCtx.translate(2 * p.life, 2 * p.life); // Was 4
              } else if (p.color === '0, 255, 0') {
                // Green: Ojo de Pez (Bulge/Expand)
                activeCtx.translate(cx, cy);
                const scale = 1.0 + (0.025 * p.life); // Was 0.05
                activeCtx.scale(scale, scale);
                activeCtx.translate(-cx, -cy);
              } else if (p.color === '0, 0, 255') {
                // Blue: Pellizcar (Pinch/Shrink)
                activeCtx.translate(cx, cy);
                const scale = 1.0 - (0.025 * p.life); // Was 0.05
                activeCtx.scale(scale, scale);
                activeCtx.translate(-cx, -cy);
              }

              activeCtx.drawImage(tempBuffer, 0, 0);
              activeCtx.restore();
            }
          }

          // Render the deformed active buffer to the screen
          canvasCtx.globalCompositeOperation = 'source-over';
          canvasCtx.drawImage(activeBuffer, 0, 0, canvas.width, canvas.height);
        };
        draw();
      };

    } catch (err) {
      console.error("Audio playback error:", err);
      setIsDecoding(false);
      setIsPlaying(false);
    }
  };

  // Draw the image initially when the component mounts or the image changes
  useEffect(() => {
    if (appState.collapsedImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.src = appState.collapsedImage;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      }
    }
  }, [appState.collapsedImage]);

  const handleSave = async () => {
    if (!canvasRef.current || isUploading) return;
    
    if (!artistName.trim()) {
      alert('Por favor, escrib├¡ tu nombre antes de subir la obra.');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      // Get image blob from canvas
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current?.toBlob(resolve, 'image/jpeg', 0.9);
      });

      if (!blob) throw new Error('No se pudo generar la imagen');

      // Upload to Supabase Storage
      const filename = `obra_${Date.now()}.jpg`;
      const { error: storageError } = await supabase.storage
        .from('obras')
        .upload(filename, blob, { contentType: 'image/jpeg' });
        
      if (storageError) throw storageError;
      
      // Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('obras')
        .getPublicUrl(filename);

      // Save to Supabase Database
      const { error: dbError } = await supabase
        .from('obras')
        .insert([
          { 
            image_url: publicUrlData.publicUrl,
            artist_name: artistName.trim(),
            title: 'Autoretrato Deconstruido'
          }
        ]);
        
      if (dbError) throw dbError;

      setUploadSuccess(true);
      alert('┬íObra subida exitosamente a la Galer├¡a!');
    } catch (error: any) {
      console.error('Error al subir a Supabase:', error);
      alert(`Ocurri├│ un error al subir: ${error.message || 'Desconocido'}. Verifica las pol├¡ticas de Supabase.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestart = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl animate-fade-in space-y-12 pb-20">
      
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-[0.2em] border-b-4 border-pure-black pb-4">
          Exposici├│n Viva
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
             disabled={isDecoding || !appState.audioBlob}
             className="flex items-center space-x-3 px-12 py-4 bg-pure-black text-white hover:bg-gray-800 disabled:opacity-50 transition-colors uppercase tracking-widest font-bold shadow-[4px_4px_0px_0px_rgba(255,0,0,1)] active:translate-y-1 active:shadow-none"
           >
             {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
             <span>
               {isDecoding ? 'Decodificando Audio...' : (isPlaying ? 'Pausar Obra' : 'Reproducir Paisaje Sonoro')}
             </span>
           </button>
         </div>
      </div>

      {/* Artist name input */}
      <div className="w-full max-w-md space-y-2">
        <label htmlFor="artist-name" className="block text-xs uppercase tracking-widest font-bold text-gray-600">
          Tu Nombre (firma de la obra)
        </label>
        <input
          id="artist-name"
          type="text"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          placeholder="Escrib├¡ tu nombre aqu├¡..."
          className="w-full px-4 py-3 border-2 border-pure-black font-mono text-sm focus:outline-none focus:ring-2 focus:ring-pure-red focus:border-pure-red transition-colors placeholder:text-gray-400"
        />
      </div>

      <div className="flex flex-wrap gap-4 mt-12 w-full justify-center">
          <button 
            onClick={handleSave}
            disabled={isUploading || isPlaying}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-black hover:bg-pure-black hover:text-white disabled:opacity-50 transition-colors uppercase tracking-widest text-sm font-bold"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>{isUploading ? 'Subiendo...' : (uploadSuccess ? 'Ô£ô Subido' : 'Subir a Galer├¡a')}</span>
          </button>
          <button 
            onClick={onShowGallery}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-black hover:bg-pure-black hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
          >
            <ImageIcon className="w-4 h-4" /> <span>Ver Galer├¡a</span>
          </button>
          <button 
            onClick={handleRestart}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-red text-pure-red hover:bg-pure-red hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
          >
            <RefreshCw className="w-4 h-4" /> <span>Reiniciar</span>
          </button>
      </div>
    </div>
  );
}
