import React, { useRef, useEffect, useState, useCallback } from 'react';
import { colord, AnyColor } from 'colord';

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

const ColorWheel: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  // Internal HSV state for smooth UI interactions
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
  const [dragTarget, setDragTarget] = useState<'sb' | 'hue' | null>(null);

  // Local state for hex input handling
  const [hexInput, setHexInput] = useState('');
  const [isHexFocused, setIsHexFocused] = useState(false);

  const sbRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync state with props when not dragging to prevent loop/jitter
  useEffect(() => {
    if (!dragTarget) {
      const c = colord(color).toHsv();
      setHsv({ h: c.h, s: c.s, v: c.v });
      
      // Update the hex input text if the user isn't currently editing it
      if (!isHexFocused) {
        setHexInput(colord(color).toHex().replace('#', '').toUpperCase());
      }
    }
  }, [color, dragTarget, isHexFocused]);

  const handleColorChange = (newHsv: { h: number, s: number, v: number }) => {
    setHsv(newHsv);
    onChange(colord(newHsv).toHex());
  };

  // --- Saturation/Brightness Interaction ---
  const handleSBMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!sbRef.current) return;
    const rect = sbRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // x = saturation, y = 1 - value (brightness)
    const s = Math.round(x * 100);
    const v = Math.round((1 - y) * 100);

    handleColorChange({ ...hsv, s, v });
  }, [hsv]);

  // --- Hue Interaction (Adaptive: Horizontal on Mobile/Tablet, Vertical on Desktop) ---
  const handleHueMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    
    // Determine orientation based on aspect ratio (Width > Height = Horizontal)
    const isHorizontal = rect.width > rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    let h = 0;

    if (isHorizontal) {
        // Horizontal Slider (Mobile/Tablet)
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        h = Math.round(x * 360);
    } else {
        // Vertical Slider (Large Desktop)
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        h = Math.round(y * 360);
    }
    
    handleColorChange({ ...hsv, h });
  }, [hsv]);

  // --- Global Drag Handling ---
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Critical for mobile: prevent scrolling while dragging sliders
      if (e.cancelable) {
        e.preventDefault();
      }

      if (dragTarget === 'sb') handleSBMove(e);
      if (dragTarget === 'hue') handleHueMove(e);
    };

    const handleUp = () => {
      setDragTarget(null);
    };

    if (dragTarget) {
      window.addEventListener('mousemove', handleMove, { passive: false });
      window.addEventListener('mouseup', handleUp);
      // passive: false is required to use preventDefault()
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragTarget, handleSBMove, handleHueMove]);

  // Helper for Numerical Inputs
  const updateFromInput = (type: 'h'|'s'|'v'|'r'|'g'|'b', val: string) => {
    const num = parseInt(val);
    if (isNaN(num)) return;

    let newColor: AnyColor;

    if (['h','s','v'].includes(type)) {
        const clamp = type === 'h' ? 360 : 100;
        const safeVal = Math.max(0, Math.min(clamp, num));
        newColor = { ...hsv, [type]: safeVal };
    } else {
        const rgb = colord(hsv).toRgb();
        const safeVal = Math.max(0, Math.min(255, num));
        newColor = { ...rgb, [type]: safeVal };
    }
    
    const c = colord(newColor);
    setHsv({ h: c.toHsv().h, s: c.toHsv().s, v: c.toHsv().v });
    onChange(c.toHex());
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setHexInput(val); // Allow free typing

     // Validate and update color if valid
     const clean = val.startsWith('#') ? val : '#' + val;
     if (colord(clean).isValid()) {
        const c = colord(clean);
        setHsv({ h: c.toHsv().h, s: c.toHsv().s, v: c.toHsv().v });
        onChange(c.toHex());
     }
  };

  const handleHexBlur = () => {
      setIsHexFocused(false);
      // Reset input to normalized hex from current color state
      const c = colord(hsv);
      if (c.isValid()) {
        setHexInput(c.toHex().replace('#', '').toUpperCase());
      }
  };

  const rgb = colord(hsv).toRgb();
  // We use hsv state for calculation, but display hex from local input state when focused
  
  // Color for the Hue-based background of the SB box
  const hueColor = colord({ h: hsv.h, s: 100, v: 100 }).toHex();

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg mx-auto select-none p-2">
       {/* Main Picker Area: Column on Mobile/Tablet, Row on Desktop */}
       <div className="flex flex-col xl:flex-row gap-4 h-auto xl:h-64">
           
           {/* Saturation/Brightness Box */}
           <div 
             ref={sbRef}
             className="relative w-full h-64 xl:h-full flex-grow rounded-sm shadow-sm cursor-crosshair overflow-hidden border border-gray-300 ring-1 ring-gray-100 touch-none"
             style={{ backgroundColor: hueColor }}
             onMouseDown={(e) => { setDragTarget('sb'); handleSBMove(e.nativeEvent); }}
             onTouchStart={(e) => { 
               if(e.cancelable) e.preventDefault(); 
               setDragTarget('sb'); 
               handleSBMove(e.nativeEvent); 
             }}
           >
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
              
              {/* Cursor */}
              <div 
                className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ 
                    left: `${hsv.s}%`, 
                    top: `${100 - hsv.v}%`,
                    backgroundColor: 'transparent' // Standard PS cursor is hollow
                }}
              />
           </div>

           {/* Hue Slider: Horizontal on Mobile/Tablet, Vertical on Desktop */}
           <div 
             ref={hueRef}
             className="relative w-full h-12 xl:w-10 xl:h-full rounded-sm shadow-sm cursor-pointer border border-gray-300 ring-1 ring-gray-100 touch-none"
             style={{ 
                 // Gradient adapts to orientation via CSS classes
             }}
             onMouseDown={(e) => { setDragTarget('hue'); handleHueMove(e.nativeEvent); }}
             onTouchStart={(e) => { 
                if(e.cancelable) e.preventDefault();
                setDragTarget('hue'); 
                handleHueMove(e.nativeEvent); 
             }}
           >
              {/* Gradient Backgrounds (Two overlapping divs to switch via CSS media queries logic not needed, we use CSS classes) */}
              {/* Mobile/Tablet Gradient (Horizontal) */}
              <div className="absolute inset-0 xl:hidden rounded-sm" 
                   style={{ background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }} />
              {/* Desktop Gradient (Vertical) */}
              <div className="absolute inset-0 hidden xl:block rounded-sm" 
                   style={{ background: 'linear-gradient(to bottom, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }} />

              {/* Slider Handle (Mobile/Tablet - Horizontal Bar) */}
              <div 
                 className="absolute top-0 bottom-0 w-2 -ml-1 bg-white border border-gray-400 rounded-full shadow-md pointer-events-none xl:hidden"
                 style={{ left: `${(hsv.h / 360) * 100}%` }}
              />

              {/* Slider Handle (Desktop - Vertical Bar) */}
              <div 
                 className="absolute left-0 right-0 h-2 -mt-1 bg-white border border-gray-400 rounded-full shadow-md pointer-events-none hidden xl:block"
                 style={{ top: `${(hsv.h / 360) * 100}%` }}
              />
           </div>
       </div>

       {/* Controls Area */}
       <div className="flex flex-col xl:grid xl:grid-cols-[1fr_auto] gap-4 xl:gap-6">
           
           {/* Values Section - Order 2 on mobile/tablet (bottom), Order 1 on Desktop */}
           <div className="space-y-3 order-2 xl:order-1">
               <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                       <InputLabel label="H" value={Math.round(hsv.h)} max={360} suffix="°" onChange={(v) => updateFromInput('h', v)} />
                       <InputLabel label="S" value={Math.round(hsv.s)} max={100} suffix="%" onChange={(v) => updateFromInput('s', v)} />
                       <InputLabel label="B" value={Math.round(hsv.v)} max={100} suffix="%" onChange={(v) => updateFromInput('v', v)} />
                   </div>
                   
                   <div className="space-y-2">
                       <InputLabel label="R" value={rgb.r} max={255} onChange={(v) => updateFromInput('r', v)} />
                       <InputLabel label="G" value={rgb.g} max={255} onChange={(v) => updateFromInput('g', v)} />
                       <InputLabel label="B" value={rgb.b} max={255} onChange={(v) => updateFromInput('b', v)} />
                   </div>
               </div>
           </div>

           {/* Hex & Preview Section - Order 1 on mobile/tablet (top), Order 2 on Desktop */}
           <div className="flex xl:flex-col justify-between w-full xl:w-32 gap-4 xl:gap-0 order-1 xl:order-2">
                
                {/* Preview Box */}
                <div className="flex flex-col gap-1 flex-1 xl:flex-initial">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">New</label>
                   <div className="h-10 xl:h-12 w-full rounded border border-gray-200 shadow-sm" style={{ backgroundColor: color }} />
                </div>
               
               {/* Hex Input */}
               <div className="flex flex-col gap-1 mt-auto flex-1 xl:flex-initial">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hex</label>
                   <div className={`flex items-center border rounded-md bg-white shadow-sm transition-colors h-10 xl:h-auto ${isHexFocused ? 'border-navy-900 ring-1 ring-navy-900/20' : 'border-gray-200'}`}>
                       <span className="pl-2 text-gray-400 font-mono text-xs">#</span>
                       <input 
                           type="text" 
                           className="w-full bg-transparent p-1.5 font-mono text-sm text-navy-900 outline-none uppercase min-w-0"
                           value={hexInput}
                           onChange={handleHexInputChange}
                           onFocus={() => setIsHexFocused(true)}
                           onBlur={handleHexBlur}
                           maxLength={6}
                       />
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};

const InputLabel = ({ label, value, max, suffix, onChange }: { label: string, value: number, max: number, suffix?: string, onChange: (val: string) => void }) => (
    <div className="flex items-center gap-2 group">
        <label className="text-xs font-bold text-gray-500 w-3 shrink-0">{label}</label>
        <div className="flex-grow relative min-w-0">
            <input 
                type="number"
                min={0}
                max={max}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:border-gold-500 outline-none text-right shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
        </div>
        {suffix && <span className="text-[10px] text-gray-400 w-3 shrink-0 text-right">{suffix}</span>}
    </div>
);

export default ColorWheel;
