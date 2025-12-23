import React, { useRef } from 'react';
import { Layers, Upload, RefreshCw, Info, Save } from 'lucide-react';
import { colord } from 'colord';

interface LeatherPreviewProps {
  color: string;
  texture: string | null;
  onTextureChange: (texture: string | null) => void;
  onSave: () => void;
}

const DEFAULT_TEXTURE = "https://i.postimg.cc/jRL3h8sN/Texture-v1.jpg";

const LeatherPreview: React.FC<LeatherPreviewProps> = ({ color, texture: customTexture, onTextureChange: setCustomTexture, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const c = colord(color);

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomTexture(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetTexture = () => {
    setCustomTexture(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-sm border border-cream-100 h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif text-navy-900 font-bold flex items-center gap-2">
          <Layers className="text-gold-500" /> Material Preview
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={onSave}
            className="flex items-center gap-1 px-3 py-1.5 bg-navy-900 text-gold-500 rounded-md text-xs font-bold hover:bg-navy-800 transition-colors shadow-sm"
          >
            <Save size={14} /> Save
          </button>
          {customTexture && (
            <button 
              onClick={resetTexture}
              className="p-2 text-gray-400 hover:text-navy-900 transition-colors"
              title="Reset to default texture"
            >
              <RefreshCw size={18} />
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-3 py-1.5 bg-cream-100 text-navy-900 rounded-md text-xs font-bold hover:bg-cream-200 transition-colors"
          >
            <Upload size={14} /> {customTexture ? 'Change' : 'Upload Texture'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleTextureUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>

      <div className="relative w-full flex-grow min-h-[350px] rounded-lg overflow-hidden shadow-inner border-4 border-white ring-1 ring-gray-200 group bg-gray-100">
        
        {/* Color Layer - Always at the bottom */}
        <div 
          className="absolute inset-0 transition-colors duration-500"
          style={{ backgroundColor: color }}
        />

        {/* Texture Layer */}
        <div 
          className="absolute inset-0 transition-all duration-500 mix-blend-multiply opacity-90 grayscale"
          style={{ 
            backgroundImage: `url(${customTexture || DEFAULT_TEXTURE})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />

        {/* Highlight/Lighting Layer for Realism */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/30 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.15),transparent_70%)] pointer-events-none" />

        {/* Info Overlay */}
        <div className="absolute top-4 left-4">
          <div className="bg-navy-900/10 backdrop-blur-sm p-1 rounded-full text-navy-900/50 hover:bg-navy-900/20 transition-colors cursor-help group/info">
            <Info size={16} />
            <div className="absolute left-8 top-0 w-48 bg-navy-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-opacity z-20">
              {customTexture 
                ? "Custom texture applied. We use 'Multiply' blending and grayscale to simulate a dye effect on your grain." 
                : "Using standard grain texture. Best for visualizing flat color finishes."}
            </div>
          </div>
        </div>

        {/* Label Card */}
        <div className="absolute bottom-6 left-6 right-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <div className="bg-white/90 backdrop-blur-md p-4 rounded-lg border-l-4 border-gold-500 shadow-2xl">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1 font-bold">Simulated Finish</div>
                <div className="flex justify-between items-end">
                    <div>
                        <div className="text-2xl font-serif font-bold text-navy-900 tracking-tight">{color.toUpperCase()}</div>
                        <div className="text-[10px] text-navy-800 font-mono mt-1 flex gap-2">
                            <span>RGB({c.toRgb().r}, {c.toRgb().g}, {c.toRgb().b})</span>
                            <span className="text-gray-300">|</span>
                            <span>HSL({Math.round(c.toHsl().h)}°, {Math.round(c.toHsl().s)}%, {Math.round(c.toHsl().l)}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
      
      <p className="text-[10px] text-gray-400 italic text-center">
        Tip: Upload a high-res photo of your material texture to see exact grain interactions.
      </p>
    </div>
  );
};

export default LeatherPreview;