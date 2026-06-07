import { useRef, useState, useEffect } from 'react';
import type { AppState } from '../App';
import { Mic, Play, ChevronRight, Square } from 'lucide-react';

interface Props {
  onComplete: () => void;
  appState: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export default function Station2Voice({ onComplete, appState, updateState }: Props) {
  const [step, setStep] = useState<'intro' | 'recording' | 'recorded' | 'playing'>('intro');
  const [timeLeft, setTimeLeft] = useState(20);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const startRecording = async () => {
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
      
      // Timer
      let t = 20;
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

    // Prepare MediaRecorder to capture the synthesized output
    const destNode = ctx.createMediaStreamDestination();
    masterGain.connect(destNode);
    const synthRecorder = new MediaRecorder(destNode.stream);
    const synthChunks: Blob[] = [];
    synthRecorder.ondataavailable = e => { if (e.data.size > 0) synthChunks.push(e.data); };
    let finalEvents: {time: number, r: number, g: number, b: number}[] = [];
    
    synthRecorder.onstop = () => {
      const synthAudioBlob = new Blob(synthChunks, { type: 'audio/webm' });
      updateState({ synthAudioBlob, synthEvents: finalEvents });
    };

    // Helper to create an FM Voice
    const createFMVoice = (baseFreq: number) => {
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const vca = ctx.createGain();

      carrier.type = 'sine';
      modulator.type = 'sine';
      
      modulator.frequency.value = baseFreq * 2;
      modGain.gain.value = 100;
      vca.gain.value = 0;

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(vca);
      vca.connect(masterGain);

      carrier.start();
      modulator.start();

      return { carrier, modulator, modGain, vca };
    };

    const voiceR = createFMVoice(50);  // Low
    const voiceG = createFMVoice(200); // Mid
    const voiceB = createFMVoice(800); // High

    source.start();
    synthRecorder.start();

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');

    // Sequencer state
    let idxR = 0, idxG = 0, idxB = 0;
    let accR = 0, accG = 0, accB = 0;
    const rgb = appState.matrixRGB;
    const luma = appState.matrixLuma;
    const events: {time: number, r: number, g: number, b: number}[] = [];

    const getPixel = (idx: number) => {
      const y = Math.floor(idx / 16);
      const x = idx % 16;
      return { r: rgb[y][x][0], g: rgb[y][x][1], b: rgb[y][x][2], l: luma[y][x] };
    };

    const draw = () => {
      if (!canvas || !canvasCtx) return;
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const cv = rms > 0.05 ? rms * 2 : 0;

      // Update sequencers
      accR += cv * 0.4 + 0.01;
      accG += cv * 0.6 + 0.015;
      accB += cv * 0.8 + 0.02;

      let changed = false;
      if (accR >= 1) { accR -= 1; idxR = (idxR + 1) % 256; changed = true; }
      if (accG >= 1) { accG -= 1; idxG = (idxG + 1) % 256; changed = true; }
      if (accB >= 1) { accB -= 1; idxB = (idxB + 1) % 256; changed = true; }

      if (changed) {
        events.push({ time: ctx.currentTime, r: idxR, g: idxG, b: idxB });
      }

      // Apply Matrix Data to Synths
      const pxR = getPixel(idxR);
      const pxG = getPixel(idxG);
      const pxB = getPixel(idxB);

      // Channel R (Low) mapped to Red values
      voiceR.carrier.frequency.setTargetAtTime(40 + pxR.r * 0.5, ctx.currentTime, 0.05);
      voiceR.modulator.frequency.setTargetAtTime((40 + pxR.r * 0.5) * (pxR.g / 50 + 0.1), ctx.currentTime, 0.05);
      voiceR.modGain.gain.setTargetAtTime(pxR.l * 5, ctx.currentTime, 0.05);
      voiceR.vca.gain.setTargetAtTime(Math.min(cv, 1), ctx.currentTime, 0.02);

      // Channel G (Mid) mapped to Green values
      voiceG.carrier.frequency.setTargetAtTime(150 + pxG.g * 1.5, ctx.currentTime, 0.05);
      voiceG.modulator.frequency.setTargetAtTime((150 + pxG.g * 1.5) * (pxG.b / 50 + 0.1), ctx.currentTime, 0.05);
      voiceG.modGain.gain.setTargetAtTime(pxG.l * 10, ctx.currentTime, 0.05);
      voiceG.vca.gain.setTargetAtTime(Math.min(cv * 0.8, 1), ctx.currentTime, 0.02);

      // Channel B (Hi) mapped to Blue values
      voiceB.carrier.frequency.setTargetAtTime(600 + pxB.b * 4, ctx.currentTime, 0.05);
      voiceB.modulator.frequency.setTargetAtTime((600 + pxB.b * 4) * (pxB.r / 50 + 0.1), ctx.currentTime, 0.05);
      voiceB.modGain.gain.setTargetAtTime(pxB.l * 15, ctx.currentTime, 0.05);
      voiceB.vca.gain.setTargetAtTime(Math.min(cv * 0.6, 1), ctx.currentTime, 0.02);

      // Visual feedback
      canvasCtx.fillStyle = '#111';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw 3 Playheads in a pseudo grid
      const drawPlayhead = (idx: number, color: string) => {
        const x = (idx % 16) * (canvas.width / 16);
        const y = Math.floor(idx / 16) * (canvas.height / 16);
        canvasCtx.fillStyle = color;
        canvasCtx.fillRect(x, y, canvas.width / 16, canvas.height / 16);
      };

      drawPlayhead(idxR, `rgba(255, 0, 0, ${cv + 0.2})`);
      drawPlayhead(idxG, `rgba(0, 255, 0, ${cv + 0.2})`);
      drawPlayhead(idxB, `rgba(0, 100, 255, ${cv + 0.2})`);
    };
    draw();

    source.onended = () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      voiceR.carrier.stop(); voiceR.modulator.stop();
      voiceG.carrier.stop(); voiceG.modulator.stop();
      voiceB.carrier.stop(); voiceB.modulator.stop();
      
      finalEvents = [...events];
      synthRecorder.stop();
      setTimeout(() => ctx.close(), 500); // Give recorder time to finish
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
        <div className="text-center space-y-8 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.2em] text-pure-green">
            El Interruptor
          </h1>
          <p className="text-xl max-w-2xl mx-auto leading-relaxed">
            La voz humana pierde su significado lingüístico y se convierte en pura energía eléctrica.
            Un voltaje de control (CV) que activará la matriz fotográfica, traduciendo el espacio al sonido.
          </p>
          <button 
            onClick={startRecording}
            className="group flex items-center justify-center space-x-3 mx-auto px-8 py-4 border-2 border-pure-black hover:bg-pure-black hover:text-pure-white transition-all duration-300 uppercase tracking-widest font-bold"
          >
            <Mic className="w-6 h-6" />
            <span>Grabar Voz (20s)</span>
          </button>
        </div>
      )}

      {step === 'recording' && (
        <div className="text-center animate-fade-in space-y-6">
          <div className="w-32 h-32 rounded-full border-4 border-pure-green flex items-center justify-center mx-auto animate-pulse">
            <span className="text-4xl font-bold text-pure-green">{timeLeft}</span>
          </div>
          <p className="uppercase tracking-widest font-bold text-pure-black">Extrayendo energía...</p>
          <button 
            onClick={stopRecording}
            className="flex items-center space-x-2 mx-auto text-pure-red hover:underline"
          >
            <Square className="w-4 h-4" /> <span>Detener Antes</span>
          </button>
        </div>
      )}

      {(step === 'recorded' || step === 'playing') && (
        <div className="w-full flex flex-col items-center space-y-8 animate-fade-in">
          <div className="border-4 border-pure-black p-4 w-full max-w-2xl bg-white relative">
             <div className="absolute top-0 left-0 bg-pure-black text-pure-white text-xs px-2 py-1 uppercase font-bold tracking-widest">
               Seguidor de Envolvente (Gate/CV)
             </div>
             <canvas 
               ref={canvasRef} 
               width={600} 
               height={200} 
               className="w-full h-[200px] mt-6 bg-gray-50 border border-gray-200"
             />
             <div className="flex justify-center mt-6">
               <button 
                  onClick={playSonification}
                  disabled={step === 'playing'}
                  className="flex items-center space-x-3 px-8 py-3 bg-pure-green text-pure-black hover:bg-green-400 disabled:opacity-50 transition-colors uppercase tracking-widest font-bold border-2 border-pure-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                  <span>Sonificar Matriz</span>
                </button>
             </div>
          </div>
          
          <button 
            onClick={onComplete}
            className="w-full max-w-2xl flex items-center justify-between px-6 py-4 bg-pure-black text-pure-white hover:bg-gray-800 transition-colors uppercase tracking-widest font-bold mt-8"
          >
            <span>Avanzar al Colapso Temporal</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
