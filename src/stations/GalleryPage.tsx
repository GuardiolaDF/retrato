import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';

interface Obra {
  id: string;
  image_url: string;
  artist_name: string;
  created_at: string;
  title: string;
}

interface Props {
  onBack: () => void;
}

export default function GalleryPage({ onBack }: Props) {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);

  const fetchObras = async () => {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setObras(data || []);
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObras();

    // Optionally subscribe to new inserts if realtime is enabled on the table
    const subscription = supabase
      .channel('public:obras')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'obras' }, payload => {
        setObras(current => [payload.new as Obra, ...current]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen w-full bg-pure-white text-pure-black font-mono p-6 md:p-12">
      
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 mb-8 text-sm uppercase tracking-widest font-bold hover:text-pure-red transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Obra</span>
        </button>

        <div className="border-b-4 border-pure-black pb-6 mb-2">
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-[0.15em]">
            Galería
          </h1>
          <p className="text-gray-500 uppercase tracking-widest text-xs mt-4 max-w-xl">
            Colección de autoretratos deconstruidos. Cada obra es una huella irrepetible 
            generada por la imagen y la voz de su autor.
          </p>
        </div>
        
        <div className="text-xs uppercase tracking-widest text-gray-400 mt-4">
          {obras.length} {obras.length === 1 ? 'obra' : 'obras'} en la colección
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-32">
          <div className="w-8 h-8 border-2 border-pure-black border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && obras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-24 h-24 border-4 border-dashed border-gray-300 flex items-center justify-center mb-6">
            <span className="text-3xl text-gray-300">∅</span>
          </div>
          <p className="text-gray-400 uppercase tracking-widest text-sm">
            La galería está vacía. Sé el primero en crear una obra.
          </p>
        </div>
      )}

      {/* Bento Grid */}
      {!loading && obras.length > 0 && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {obras.map((obra) => (
            <div
              key={obra.id}
              className="group relative bg-gray-50 border border-gray-200 cursor-pointer overflow-hidden transition-all duration-300 hover:border-pure-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              onClick={() => setSelectedObra(obra)}
            >
              {/* Image */}
              <div className="aspect-square overflow-hidden">
                <img
                  src={obra.image_url}
                  alt={`Obra de ${obra.artist_name}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              
              {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-white font-bold text-sm uppercase tracking-widest">
                  {obra.artist_name}
                </p>
                <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">
                  {formatDate(obra.created_at)}
                </p>
              </div>

              {/* Always-visible tag */}
              <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start">
                <span className="bg-pure-black text-white text-[9px] uppercase tracking-widest px-2 py-1 font-bold">
                  {obra.artist_name}
                </span>
                <span className="bg-white/80 text-black text-[9px] uppercase tracking-widest px-2 py-1">
                  {formatDate(obra.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedObra && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setSelectedObra(null)}
        >
          <div 
            className="relative max-w-3xl w-full bg-white border-4 border-pure-black"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedObra.image_url}
              alt={`Obra de ${selectedObra.artist_name}`}
              className="w-full aspect-square object-cover"
            />
            <div className="p-6 border-t-4 border-pure-black">
              <p className="text-xl font-bold uppercase tracking-widest">
                {selectedObra.artist_name}
              </p>
              <p className="text-xs text-gray-500 uppercase tracking-widest mt-2">
                {formatDate(selectedObra.created_at)}
              </p>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
                Autoretrato Deconstruido
              </p>
            </div>
            <button
              onClick={() => setSelectedObra(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-pure-black text-white flex items-center justify-center font-bold text-lg hover:bg-pure-red transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
