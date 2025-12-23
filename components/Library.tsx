import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Book, Trash2, Download, Droplet, Edit2, Check, Search, X, Palette, Share2 } from 'lucide-react';
import { colord } from 'colord';

const Library: React.FC = () => {
  const swatches = useLiveQuery(() => db.swatches.toArray());
  const formulas = useLiveQuery(() => db.formulas.toArray());
  
  const [activeTab, setActiveTab] = useState<'swatches' | 'formulas'>('swatches');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  
  // Track active item for mobile tap-to-reveal
  const [activeId, setActiveId] = useState<number | null>(null);

  // Search States
  const [swatchSearch, setSwatchSearch] = useState('');
  const [formulaSearch, setFormulaSearch] = useState('');

  const deleteSwatch = (id: number) => db.swatches.delete(id);
  const deleteFormula = (id: number) => db.formulas.delete(id);

  const startEditing = (id: number, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const saveRename = async (id: number, type: 'swatch' | 'formula') => {
    if (type === 'swatch') {
        await db.swatches.update(id, { name: editName });
    } else {
        await db.formulas.update(id, { name: editName });
    }
    setEditingId(null);
  };

  const toggleActive = (id: number) => {
    if (editingId) return; // Don't toggle while renaming
    setActiveId(prev => prev === id ? null : id);
  };

  /**
   * Generates a High-Res Canvas (1200x800) for the Swatch card.
   * Scaled up for better print quality (approx 300ppi at 4x2.6 inch).
   */
  const generateSwatchCanvas = (swatchName: string, color: string): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    // Set dimensions to 1200x800 for high quality
    const width = 1200;
    const height = 800;
    canvas.width = width; 
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    ctx.fillStyle = '#F9F7F3'; 
    ctx.fillRect(0, 0, width, height);

    const c = colord(color);
    
    // Color Circle (Center x2: 150->300, y2: 200->400, Radius x2: 100->200)
    ctx.beginPath();
    ctx.arc(300, 400, 200, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 20; // x2
    ctx.strokeStyle = '#FFFFFF'; 
    ctx.stroke();
    
    // Text Data
    ctx.fillStyle = '#0B1F44'; 
    ctx.textAlign = 'left';
    ctx.font = 'bold 64px Montserrat'; // Font x2
    ctx.fillText(swatchName.toUpperCase(), 600, 280); // Pos x2
    
    // Divider Line
    ctx.beginPath(); 
    ctx.moveTo(600, 320); 
    ctx.lineTo(1100, 320); // x2
    ctx.strokeStyle = '#D4AF37'; 
    ctx.lineWidth = 4; // x2
    ctx.stroke();

    // Color Details
    ctx.font = '40px Montserrat'; // Font x2
    ctx.fillStyle = '#4B5563';
    
    const startX = 600;
    const startY = 400;
    const lh = 70; // Line height x2

    ctx.fillText(`HEX: ${c.toHex().toUpperCase()}`, startX, startY);
    ctx.fillText(`RGB: ${c.toRgb().r}, ${c.toRgb().g}, ${c.toRgb().b}`, startX, startY + lh);
    const hsl = c.toHsl();
    ctx.fillText(`HSL: ${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`, startX, startY + lh * 2);

    // Footer Branding
    ctx.font = 'italic 24px Montserrat'; // Font x2
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(`Colour Master Artisan Tool • ${new Date().toLocaleDateString()}`, 600, 700);

    return canvas;
  };

  const handleDownloadSwatch = (swatchName: string, color: string) => {
      const canvas = generateSwatchCanvas(swatchName, color);
      if (!canvas) return;

      const link = document.createElement('a');
      link.download = `${swatchName.replace(/\s+/g, '_')}_Swatch.png`;
      link.href = canvas.toDataURL('image/png', 1.0); // 1.0 = Max Quality
      link.click();
  };

  const handleShareSwatch = (swatchName: string, color: string) => {
      const canvas = generateSwatchCanvas(swatchName, color);
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
          if (!blob) return;
          
          const file = new File([blob], `${swatchName}.png`, { type: 'image/png' });
          const shareData = {
              title: `${swatchName} Swatch`,
              text: `Here is the pigment formula for ${swatchName} (${color}) created with Colour Master.`,
              files: [file]
          };

          if (navigator.canShare && navigator.canShare(shareData)) {
              try {
                  await navigator.share(shareData);
              } catch (err) {
                  // User cancelled or share failed silently
                  console.log("Share cancelled or failed");
              }
          } else {
              alert("Your device does not support direct image sharing. Please use Download instead.");
          }
      }, 'image/png', 1.0);
  };

  // Filter Logic
  const filteredSwatches = swatches?.filter(s => 
    s.name.toLowerCase().includes(swatchSearch.toLowerCase()) || 
    s.hex.toLowerCase().includes(swatchSearch.toLowerCase())
  ) || [];

  const filteredFormulas = formulas?.filter(f => 
    f.name.toLowerCase().includes(formulaSearch.toLowerCase())
  ) || [];

  const handleTabChange = (tab: 'swatches' | 'formulas') => {
      setActiveTab(tab);
      setActiveId(null);
      setEditingId(null);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Tab Navigation */}
      <div className="flex justify-center lg:justify-start">
        <div className="flex p-1 bg-cream-100/80 backdrop-blur-sm rounded-xl border border-cream-200">
            <button
                onClick={() => handleTabChange('swatches')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                    activeTab === 'swatches' 
                    ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' 
                    : 'text-navy-800 hover:bg-cream-200/50'
                }`}
            >
                <Palette size={16} />
                Swatches
            </button>
            <button
                onClick={() => handleTabChange('formulas')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
                    activeTab === 'formulas' 
                    ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' 
                    : 'text-navy-800 hover:bg-cream-200/50'
                }`}
            >
                <Droplet size={16} />
                Formulas
            </button>
        </div>
      </div>

      <div className="flex-grow min-h-0 relative">
        
        {/* Swatches Tab */}
        {activeTab === 'swatches' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-navy-900 font-serif font-bold">
                             <h3 className="text-lg">Saved Swatches</h3>
                             <span className="text-[10px] bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full border border-gold-200">
                                {filteredSwatches.length}
                            </span>
                        </div>
                    </div>
                    <div className="relative group max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search by name or hex..." 
                            value={swatchSearch}
                            onChange={(e) => setSwatchSearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900/10 outline-none transition-all placeholder:text-gray-400"
                        />
                        {swatchSearch && (
                            <button 
                                onClick={() => setSwatchSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 pb-32 lg:pb-4 custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredSwatches.length === 0 && (
                            <div className="col-span-full text-center py-20">
                                <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-cream-100 mb-4">
                                    <Book className="text-gray-300" size={32} />
                                </div>
                                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                                    {swatchSearch ? 'No matching swatches found' : 'Your swatch library is empty'}
                                </p>
                            </div>
                        )}
                        {filteredSwatches.map(swatch => (
                            <div 
                                key={swatch.id} 
                                onClick={() => toggleActive(swatch.id!)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 group cursor-pointer ${
                                    activeId === swatch.id 
                                    ? 'border-gold-500 bg-gold-50/10 shadow-md scale-[1.01]' 
                                    : 'border-gray-100 bg-white hover:border-gold-500/30'
                                }`}
                            >
                                <div className="flex items-center gap-3 flex-grow min-w-0">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-md ring-1 ring-gray-100 transition-transform group-hover:scale-105" style={{ backgroundColor: swatch.hex }} />
                                    {editingId === swatch.id ? (
                                        <div className="flex items-center gap-1 flex-grow" onClick={e => e.stopPropagation()}>
                                            <input 
                                                className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={() => saveRename(swatch.id!, 'swatch')} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow-sm"><Check size={16}/></button>
                                        </div>
                                    ) : (
                                        <div className="min-w-0 flex-grow">
                                            <div className="font-bold text-navy-900 text-sm flex items-center gap-2 truncate">
                                                {swatch.name}
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startEditing(swatch.id!, swatch.name); }} 
                                                    className={`transition-all duration-200 ${
                                                        activeId === swatch.id 
                                                        ? 'opacity-100 pointer-events-auto text-navy-900' 
                                                        : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-400 hover:text-navy-900'
                                                    }`}
                                                >
                                                    <Edit2 size={12}/>
                                                </button>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono uppercase bg-gray-50 inline-block px-1.5 rounded mt-0.5 border border-gray-100">{swatch.hex}</div>
                                        </div>
                                    )}
                                </div>
                                <div className={`flex gap-1 pl-2 transition-all duration-300 ${
                                    activeId === swatch.id 
                                    ? 'opacity-100 translate-x-0 pointer-events-auto' 
                                    : 'opacity-0 translate-x-4 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-hover:pointer-events-auto'
                                }`}>
                                    <button onClick={(e) => { e.stopPropagation(); handleShareSwatch(swatch.name, swatch.hex); }} className="text-navy-800 hover:text-gold-600 p-2 hover:bg-cream-50 rounded-lg transition-colors" title="Share Swatch"><Share2 size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadSwatch(swatch.name, swatch.hex); }} className="text-navy-800 hover:text-gold-600 p-2 hover:bg-cream-50 rounded-lg transition-colors" title="Download High-Res Card"><Download size={16}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteSwatch(swatch.id!); }} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Formulas Tab */}
        {activeTab === 'formulas' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-navy-900 font-serif font-bold">
                             <h3 className="text-lg">Formulas</h3>
                             <span className="text-[10px] bg-navy-100 text-navy-800 px-2 py-0.5 rounded-full border border-navy-200">
                                {filteredFormulas.length}
                            </span>
                        </div>
                    </div>
                    <div className="relative group max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-900 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search formulas..." 
                            value={formulaSearch}
                            onChange={(e) => setFormulaSearch(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900/10 outline-none transition-all placeholder:text-gray-400"
                        />
                         {formulaSearch && (
                            <button 
                                onClick={() => setFormulaSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 pb-32 lg:pb-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredFormulas.length === 0 && (
                             <div className="col-span-full text-center py-20">
                                <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-cream-100 mb-4">
                                    <Droplet className="text-gray-300" size={32} />
                                </div>
                                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                                    {formulaSearch ? 'No matching formulas found' : 'No saved formulas yet'}
                                </p>
                            </div>
                        )}
                        {filteredFormulas.map(formula => (
                            <div 
                                key={formula.id} 
                                onClick={() => toggleActive(formula.id!)}
                                className={`p-5 rounded-xl border transition-all duration-300 flex flex-col h-full cursor-pointer ${
                                    activeId === formula.id 
                                    ? 'border-navy-500 bg-navy-50/10 shadow-md' 
                                    : 'border-gray-100 bg-white hover:border-navy-200'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-grow min-w-0 pr-2">
                                        {editingId === formula.id ? (
                                            <div className="flex items-center gap-1 mb-1" onClick={e => e.stopPropagation()}>
                                                <input className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                                                <button onClick={() => saveRename(formula.id!, 'formula')} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow-sm"><Check size={16}/></button>
                                            </div>
                                        ) : (
                                            <div className="font-bold text-navy-900 flex items-center gap-2 text-base truncate">
                                                <div className="bg-navy-50 p-1.5 rounded-md">
                                                    <Droplet size={16} className="text-gold-500 flex-shrink-0" />
                                                </div>
                                                <span className="truncate" title={formula.name}>{formula.name}</span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); startEditing(formula.id!, formula.name); }} 
                                                    className={`transition-all duration-200 ${
                                                        activeId === formula.id 
                                                        ? 'opacity-100 pointer-events-auto text-navy-900' 
                                                        : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-400 hover:text-navy-900'
                                                    }`}
                                                >
                                                    <Edit2 size={12}/>
                                                </button>
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider font-medium flex gap-2">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                                Batch: {formula.batchSize}{formula.unit}
                                            </span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                                {formula.ratioMode === 'percentage' ? 'Percents' : 'Parts'}
                                            </span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteFormula(formula.id!); }} 
                                        className={`p-2 rounded-lg transition-all ${
                                            activeId === formula.id
                                            ? 'opacity-100 pointer-events-auto text-gray-400 hover:text-red-500 hover:bg-red-50'
                                            : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-300 hover:text-red-500'
                                        }`}
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                                <div className="space-y-2 border-t border-gray-50 pt-3 mt-auto">
                                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Pigment Breakdown</div>
                                    {formula.pigments.map(p => (
                                        <div key={p.id} className="flex justify-between text-xs items-center group/item hover:bg-cream-50/50 p-1 rounded -mx-1 transition-colors">
                                            <span className="text-gray-700 truncate pr-2 font-medium">{p.name || 'Unnamed Pigment'}</span>
                                            <span className="font-mono text-navy-900 font-bold bg-cream-100 px-1.5 py-0.5 rounded min-w-[3rem] text-center border border-cream-200">
                                                {formula.ratioMode === 'percentage' 
                                                    ? `${((p.ratio/100)*formula.batchSize).toFixed(1)}`
                                                    : `${(p.ratio * (formula.batchSize / formula.pigments.reduce((s,x)=>s+(x.ratio || 0),0))).toFixed(1)}`}
                                                <span className="text-[9px] text-gray-500 ml-0.5 font-normal">ml</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Library;