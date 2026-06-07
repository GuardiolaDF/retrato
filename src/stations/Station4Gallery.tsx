import type { AppState } from '../App';
import { RefreshCw, UploadCloud } from 'lucide-react';

interface Props {
  appState: AppState;
}

export default function Station4Gallery({ appState }: Props) {
  
  const handleSave = () => {
    // Here we would implement Firebase upload
    // using appState.originalImage, appState.collapsedImage, appState.audioBlob, etc.
    alert('Subida a repositorio Firebase simulada. (Configura tus credenciales en Firebase para activarlo).');
  };

  const handleRestart = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in space-y-12 pb-20">
      
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-[0.2em] border-b-4 border-pure-black pb-4">
          Repositorio Final
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto uppercase tracking-widest text-xs">
          La desarticulación ha finalizado. La identidad biológica ha sido traducida a un ecosistema de datos estáticos y temporales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        {/* Original */}
        <div className="flex flex-col border-2 border-pure-black p-4 space-y-4">
           <h3 className="uppercase font-bold tracking-widest text-pure-red text-sm flex items-center">
             <span className="w-2 h-2 bg-pure-red mr-2"></span> Captura Inicial
           </h3>
           {appState.originalImage ? (
             <img src={appState.originalImage} alt="Original" className="w-full aspect-square object-cover filter grayscale" />
           ) : (
             <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-xs">Vacio</div>
           )}
        </div>

        {/* Matrix Visualization */}
        <div className="flex flex-col border-2 border-pure-black p-4 space-y-4">
           <h3 className="uppercase font-bold tracking-widest text-pure-green text-sm flex items-center">
             <span className="w-2 h-2 bg-pure-green mr-2"></span> Matriz de Luma 16x16
           </h3>
           <div className="w-full aspect-square bg-pure-black grid grid-cols-16 grid-rows-16 gap-0">
             {appState.matrixLuma.length > 0 ? (
               appState.matrixLuma.flat().map((val, i) => (
                 <div 
                   key={i} 
                   style={{ backgroundColor: `rgb(${val},${val},${val})` }}
                   className="w-full h-full"
                 />
               ))
             ) : (
                <div className="col-span-full row-span-full flex items-center justify-center text-pure-white text-xs">Sin Datos</div>
             )}
           </div>
        </div>

        {/* Collapsed Video */}
        <div className="flex flex-col border-2 border-pure-black p-4 space-y-4">
           <h3 className="uppercase font-bold tracking-widest text-pure-blue text-sm flex items-center">
             <span className="w-2 h-2 bg-pure-blue mr-2"></span> Tiempo Colapsado
           </h3>
           {appState.collapsedImage ? (
             <img src={appState.collapsedImage} alt="Collapsed" className="w-full aspect-square object-cover" />
           ) : (
             <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-xs">Vacio</div>
           )}
        </div>
      </div>

      <div className="flex gap-6 mt-12">
         <button 
            onClick={handleRestart}
            className="flex items-center space-x-2 px-6 py-3 border-2 border-pure-black hover:bg-pure-black hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
          >
            <RefreshCw className="w-4 h-4" /> <span>Reiniciar</span>
          </button>
          
          <button 
            onClick={handleSave}
            className="flex items-center space-x-2 px-6 py-3 bg-pure-black text-white hover:bg-gray-800 transition-colors uppercase tracking-widest text-sm font-bold shadow-[4px_4px_0px_0px_rgba(255,0,0,1)] active:translate-y-1 active:shadow-none"
          >
            <UploadCloud className="w-4 h-4" /> <span>Exhibir en Galería</span>
          </button>
      </div>

    </div>
  );
}
