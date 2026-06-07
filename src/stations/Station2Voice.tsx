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
    if (!appState.audioBlob || !appState.matrixLuma.length) return;
    
    setStep('playing');
    const arrayBuffer = await appState.audioBlob.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Analyzer for Envelope Follower
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    
    source.connect(analyser);
    // Disconnect from destination to NOT hear the raw voice, only the synth
    // analyser.connect(ctx.destination); 

    // Synthesis: Let's create an oscillator bank based on the first row of Luma (16 oscillators)
    // Or, map the Luma matrix to frequency over time.
    // For simplicity, we use 4 oscillators mapped to the first 4 Luma values of the first row to form a chord.
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; // Controlled by envelope
    masterGain.connect(ctx.destination);

    const oscillators: OscillatorNode[] = [];
    const firstRowLuma = appState.matrixLuma[0] || Array(16).fill(100);
    
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      // Map luma (0-255) to a frequency (e.g. 100Hz to 1000Hz)
      const freq = 100 + (firstRowLuma[i] || 100) * 3;
      osc.frequency.value = freq;
      osc.type = 'sine';
      osc.connect(masterGain);
      osc.start();
      oscillators.push(osc);
    }

    source.start();

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');

    const draw = () => {
      if (!canvas || !canvasCtx) return;
      animationRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Volume Envelope)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      
      // Map RMS to master gain (Gate / CV)
      // If rms is very low, gate is closed. If high, gain goes up.
      const threshold = 0.05;
      const cv = rms > threshold ? rms * 2 : 0;
      masterGain.gain.setTargetAtTime(Math.min(cv, 1), ctx.currentTime, 0.05);

      // Visual feedback
      canvasCtx.fillStyle = '#FFFFFF';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#00FF00'; // Pure Green for CV
      canvasCtx.beginPath();
      
      const sliceWidth = canvas.width * 1.0 / dataArray.length;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
      
      // Draw Envelope level
      canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      const envHeight = (cv) * canvas.height;
      canvasCtx.fillRect(0, canvas.height - envHeight, canvas.width, envHeight);
    };
    draw();

    source.onended = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      oscillators.forEach(o => o.stop());
      ctx.close();
      setStep('recorded'); // loop back or stay
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
