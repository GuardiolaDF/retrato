import { useRef, useState, useEffect } from 'react';
import type { AppState } from '../App';
import { Mic, Play, ChevronRight, Square } from 'lucide-react';

interface Props {
  onComplete: () => void;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
  addLog: (log: string) => void;
}

export default function Station2Voice({ onComplete, appState, updateState, addLog }: Props) {
  const [step, setStep] = useState<'intro' | 'recording' | 'recorded' | 'playing'>('intro');
  const [timeLeft, setTimeLeft] = useState(16);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const startRecording = async () => {
    addLog("Inicializando interfaz acústica...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        updateState({ audioBlob });
        setStep('recorded');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStep('recording');
      addLog("Grabando paisaje sonoro... Analizando envolvente de amplitud.");
      
      // Timer
      let t = 16;
      setTimeLeft(t);
      const timer = setInterval(() => {
        t -= 1;
        setTimeLeft(t);
        if (t <= 0) {
          clearInterval(timer);
          mediaRecorder.stop();
        }
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing mic:", err);
      alert("Se requiere acceso al micrófono para esta obra.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const playSonification = async () => {
    if (!appState.audioBlob || !appState.matrixLuma.length || !appState.matrixRGB.length) return;
    
    addLog("Vinculando frecuencias a cabezales de color RGB...");
    setStep('playing');
    const arrayBuffer = await appState.audioBlob.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
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

    source.loop = true;
    source.start();

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');
    const waveCanvas = waveformRef.current;
    const waveCtx = waveCanvas?.getContext('2d');

    if (!canvas || !canvasCtx || !waveCanvas || !waveCtx) return;

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

    const draw = () => {
      if (!canvas || !canvasCtx || !waveCanvas || !waveCtx || didEnd) return;
      animationRef.current = requestAnimationFrame(draw);
      
      const elapsed = ctx.currentTime - startTime;
      const progress = elapsed / 16.0; // Fixed 16 seconds timeline

      if (progress >= 1.0) {
        didEnd = true;
        source.stop(); // trigger onended
        return;
      }

      const step = Math.floor(progress * 256);
      const idxR = pathR[Math.min(step, 255)];
      const idxG = pathG[Math.min(step, 255)];
      const idxB = pathB[Math.min(step, 255)];

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
        particles.push({x: idxB % 16, y: Math.floor(idxB / 16), color: '0, 0, 255', life: initialLife}); // Pure blue
      }

      // Apply Matrix Data to Synths
      const pxR = getPixel(idxR);
      const pxG = getPixel(idxG);
      const pxB = getPixel(idxB);

      // Channel R (Low) mapped to Red values
      voiceR.carrier.frequency.setTargetAtTime(40 + pxR.r * 0.5, ctx.currentTime, 0.05);
      voiceR.modulator.frequency.setTargetAtTime((40 + pxR.r * 0.5) * (pxR.g / 50 + 0.1), ctx.currentTime, 0.05);
      voiceR.modGain.gain.setTargetAtTime(pxR.l * 5, ctx.currentTime, 0.05);
      voiceR.vca.gain.setTargetAtTime(Math.min(cv, 1), ctx.currentTime, 0.2); // Longer release

      // Channel G (Mid) mapped to Green values
      voiceG.carrier.frequency.setTargetAtTime(150 + pxG.g * 1.5, ctx.currentTime, 0.05);
      voiceG.modulator.frequency.setTargetAtTime((150 + pxG.g * 1.5) * (pxG.b / 50 + 0.1), ctx.currentTime, 0.05);
      voiceG.modGain.gain.setTargetAtTime(pxG.l * 10, ctx.currentTime, 0.05);
      voiceG.vca.gain.setTargetAtTime(Math.min(cv * 0.8, 1), ctx.currentTime, 0.2); // Longer release

      // Channel B (Hi) mapped to Blue values
      voiceB.carrier.frequency.setTargetAtTime(600 + pxB.b * 4, ctx.currentTime, 0.05);
      voiceB.modulator.frequency.setTargetAtTime((600 + pxB.b * 4) * (pxB.r / 50 + 0.1), ctx.currentTime, 0.05);
      voiceB.modGain.gain.setTargetAtTime(pxB.l * 15, ctx.currentTime, 0.05);
      voiceB.vca.gain.setTargetAtTime(Math.min(cv * 0.6, 1), ctx.currentTime, 0.2); // Longer release

      // Visual feedback: Black background for additive synthesis
      canvasCtx.globalCompositeOperation = 'source-over';
      canvasCtx.fillStyle = '#000000';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      const cellW = canvas.width / 16;
      const cellH = canvas.height / 16;
      
      // Draw 16x16 grid of dots
      canvasCtx.fillStyle = '#999999';
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          canvasCtx.beginPath();
          canvasCtx.arc((x + 0.5) * cellW, (y + 0.5) * cellH, 2, 0, Math.PI * 2);
          canvasCtx.fill();
        }
      }

      // Additive blending for circles (Screen mode creates CMY)
      canvasCtx.globalCompositeOperation = 'screen';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life *= 0.97; // Slower decay for smooth transitions
        
        if (p.life < 0.01) {
          particles.splice(i, 1);
          continue;
        }

        const cx = (p.x + 0.5) * cellW;
        const cy = (p.y + 0.5) * cellH;
        const radius = cellW * 5.0; // Double the size (was 2.5)

        const grad = canvasCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(${p.color}, ${p.life})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);

        canvasCtx.fillStyle = grad;
        canvasCtx.beginPath();
        canvasCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        canvasCtx.fill();
      }
      canvasCtx.globalCompositeOperation = 'source-over';

      // Draw Waveform Overlay in separate canvas
      waveCtx.fillStyle = '#000000';
      waveCtx.fillRect(0, 0, waveCanvas.width, waveCanvas.height);
      
      waveCtx.lineWidth = 2;
      waveCtx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      waveCtx.beginPath();
      const sliceWidth = waveCanvas.width / dataArray.length;
      let waveX = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const waveY = (v * waveCanvas.height) / 2;

        if (i === 0) {
          waveCtx.moveTo(waveX, waveY);
        } else {
          waveCtx.lineTo(waveX, waveY);
        }
        waveX += sliceWidth;
      }
      waveCtx.stroke();
    };
    draw();

    source.onended = () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      voiceR.carrier.stop(); voiceR.modulator.stop();
      voiceG.carrier.stop(); voiceG.modulator.stop();
      voiceB.carrier.stop(); voiceB.modulator.stop();
      
      setTimeout(() => ctx.close(), 100);
      setStep('recorded');
    };
  };

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center max-w-4xl w-full">
      {step === 'intro' && (
        <div className="text-center space-y-8 animate-fade-in p-8 brutal-panel max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.2em] text-[var(--color-pure-green)] text-glow-green">
            EL INTERRUPTOR
          </h1>
          <p className="text-sm max-w-xl mx-auto leading-relaxed text-gray-400">
            La voz humana pierde su significado lingüístico y se convierte en pura energía eléctrica.
            Un voltaje de control (CV) que activará la matriz fotográfica.
          </p>
          <button 
            onClick={startRecording}
            className="group flex items-center justify-center space-x-3 mx-auto px-8 py-4 bg-[var(--color-brutal-bg)] border-2 border-[var(--color-pure-green)] text-[var(--color-pure-green)] hover:bg-[var(--color-pure-green)] hover:text-white transition-all duration-300 uppercase tracking-widest font-bold brutal-border"
          >
            <Mic className="w-6 h-6" />
            <span>[ GRABAR_AUDIO: 16s ]</span>
          </button>
        </div>
      )}

      {step === 'recording' && (
        <div className="text-center animate-fade-in space-y-6 brutal-panel p-8">
          <div className="w-32 h-32 rounded-none border-4 border-[var(--color-pure-green)] flex items-center justify-center mx-auto animate-pulse">
            <span className="text-4xl font-bold text-[var(--color-pure-green)] text-glow-green">{timeLeft}</span>
          </div>
          <p className="uppercase tracking-widest font-bold text-[var(--color-pure-green)]">[ EXTRACCIÓN_ACTIVA ]</p>
          <button 
            onClick={stopRecording}
            className="flex items-center space-x-2 mx-auto text-white hover:text-[var(--color-pure-red)] hover:underline transition-colors"
          >
            <Square className="w-4 h-4" /> <span>Abortar Secuencia</span>
          </button>
        </div>
      )}

      {(step === 'recorded' || step === 'playing') && (
        <div className="w-full flex flex-col items-center space-y-8 animate-fade-in">
          <div className="w-full flex flex-col items-center brutal-panel p-4">
            <div className="w-full max-w-[512px] mb-4 brutal-border bg-[var(--color-brutal-bg)] relative overflow-hidden">
              <span className="absolute top-2 left-2 text-[var(--color-pure-green)] text-[10px] font-bold uppercase tracking-widest z-10 bg-[var(--color-brutal-bg)]/80 px-1 brutal-border">Análisis de Fourier / Frecuencia vocal</span>
              <canvas ref={waveformRef} width={512} height={80} className="w-full h-[80px] object-cover block" />
            </div>
            
            <div className="relative w-full max-w-[512px] brutal-border">
              <canvas 
                ref={canvasRef} 
                width={512} 
                height={512} 
                className="w-full aspect-square object-cover bg-black"
              />
            </div>
             <div className="flex justify-center mt-6">
               <button 
                  onClick={playSonification}
                  disabled={step === 'playing'}
                  className="flex items-center space-x-3 px-8 py-3 bg-[var(--color-brutal-bg)] text-white hover:bg-[var(--color-pure-green)] hover:text-[var(--color-brutal-bg)] disabled:opacity-50 transition-colors uppercase tracking-widest font-bold border-2 border-[var(--color-pure-green)]"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  <span>[ INICIAR_SONIFICACIÓN ]</span>
                </button>
             </div>
          </div>
          
          <button 
            onClick={onComplete}
            className="w-full max-w-2xl flex items-center justify-between px-6 py-4 border-2 border-white hover:bg-white hover:text-[var(--color-pure-black)] transition-colors uppercase tracking-widest font-bold mt-8"
          >
            <span>[ INIT_COLAPSO_TEMPORAL ]</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
