import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, performManualOverwrite, resetDatabase, triggerBackupDownload } from '../db';
import { Book, Trash2, Download, Droplet, Edit2, Check, Search, X, Palette, Share2, Database, FileUp, FileDown, AlertTriangle, Power, Save, RefreshCw } from 'lucide-react';
import { colord } from 'colord';

export default function Library() {
  const swatches = useLiveQuery(() => db.swatches.toArray());
  const formulas = useLiveQuery(() => db.formulas.toArray());
  
  const [activeTab, setActiveTab] = useState<'swatches' | 'formulas'>('swatches');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [swatchSearch, setSwatchSearch] = useState('');
  const [formulaSearch, setFormulaSearch] = useState('');

  const [showDataModal, setShowDataModal] = useState(false);
  const [hasLinkedFile, setHasLinkedFile] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkLink = async () => {
        const rec = await db.meta.get('backupHandle');
        setHasLinkedFile(!!rec);
    };
    if (showDataModal) checkLink();
  }, [showDataModal]);

  // --- CANVAS UTILS (Restored) ---
  const generateSwatchCanvas = (swatchName: string, color: string): HTMLCanvasElement | null => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#F9F7F3'; ctx.fillRect(0, 0, 1200, 800);
    const c = colord(color);
    ctx.beginPath(); ctx.arc(300, 400, 200, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 20; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
    ctx.fillStyle = '#0B1F44'; ctx.textAlign = 'left'; ctx.font = 'bold 64px Montserrat';
    ctx.fillText(swatchName.toUpperCase(), 600, 280);
    ctx.beginPath(); ctx.moveTo(600, 320); ctx.lineTo(1100, 320);
    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 4; ctx.stroke();
    ctx.font = '40px Montserrat'; ctx.fillStyle = '#4B5563';
    ctx.fillText(`HEX: ${c.toHex().toUpperCase()}`, 600, 400);
    ctx.fillText(`RGB: ${c.toRgb().r}, ${c.toRgb().g}, ${c.toRgb().b}`, 600, 470);
    const hsl = c.toHsl(); ctx.fillText(`HSL: ${Math.round(hsl.h)}°, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`, 600, 540);
    ctx.font = 'italic 24px Montserrat'; ctx.fillStyle = '#9CA3AF';
    ctx.fillText(`Colour Master Artisan Tool • ${new Date().toLocaleDateString()}`, 600, 700);
    return canvas;
  };

  const handleDownloadSwatch = (swatchName: string, color: string) => {
      const canvas = generateSwatchCanvas(swatchName, color);
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${swatchName.replace(/\s+/g, '_')}_Swatch.png`;
      link.href = canvas.toDataURL('image/png', 1.0); 
      link.click();
  };

  const handleShareSwatch = (swatchName: string, color: string) => {
      const canvas = generateSwatchCanvas(swatchName, color);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], `${swatchName}.png`, { type: 'image/png' });
          const shareData = { title: `${swatchName} Swatch`, text: `Pigment formula for ${swatchName}`, files: [file] };
          if (navigator.canShare && navigator.canShare(shareData)) { 
              try { await navigator.share(shareData); } catch (err) {} 
          } else { alert("Sharing not supported on this browser."); }
      }, 'image/png', 1.0);
  };

  const deleteSwatch = async (id: number) => { await db.swatches.delete(id); };
  const deleteFormula = async (id: number) => { await db.formulas.delete(id); };

  const saveRename = async (id: number, type: 'swatch' | 'formula') => {
    if (type === 'swatch') await db.swatches.update(id, { name: editName });
    else await db.formulas.update(id, { name: editName });
    setEditingId(null);
  };

  const toggleActive = (id: number) => {
    if (editingId) return; 
    setActiveId(prev => prev === id ? null : id);
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    const result = await performManualOverwrite();
    setIsBackingUp(false);
    if (result === 'overwritten') alert("Success! Backup file updated.");
  };

  const filteredSwatches = swatches?.filter(s => s.name.toLowerCase().includes(swatchSearch.toLowerCase()) || s.hex.toLowerCase().includes(swatchSearch.toLowerCase())) || [];
  const filteredFormulas = formulas?.filter(f => f.name.toLowerCase().includes(formulaSearch.toLowerCase())) || [];

  return (
    <>
    <div className="h-full flex flex-col gap-4">
      {/* Header Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex p-1 bg-cream-100/80 backdrop-blur-sm rounded-xl border border-cream-200">
            <button onClick={() => setActiveTab('swatches')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'swatches' ? 'bg-navy-900 text-gold-500 shadow-md' : 'text-navy-800'}`}>Swatches</button>
            <button onClick={() => setActiveTab('formulas')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'formulas' ? 'bg-navy-900 text-gold-500 shadow-md' : 'text-navy-800'}`}>Formulas</button>
        </div>
        <button onClick={() => setShowDataModal(true)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-navy-800 flex items-center gap-2"><Database size={18} /> Data</button>
      </div>

      <div className="flex-grow min-h-0 relative">
        {activeTab === 'swatches' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <input type="text" placeholder="Search..." value={swatchSearch} onChange={(e) => setSwatchSearch(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none"/>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredSwatches.map(swatch => (
                            <div key={swatch.id} onClick={() => toggleActive(swatch.id!)} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 group cursor-pointer ${activeId === swatch.id ? 'border-gold-500 bg-gold-50/10' : 'border-gray-100 bg-white'}`}>
                                <div className="flex items-center gap-3 flex-grow min-w-0">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-md" style={{ backgroundColor: swatch.hex }} />
                                    {editingId === swatch.id ? (
                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            <input className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                                            <button onClick={() => saveRename(swatch.id!, 'swatch')} className="text-white bg-green-500 p-1 rounded shadow-sm"><Check size={16}/></button>
                                        </div>
                                    ) : (
                                        <div className="min-w-0 flex-grow">
                                            <div className="font-bold text-navy-900 text-sm flex items-center gap-2 truncate">
                                                {swatch.name}
                                                <button onClick={(e) => { e.stopPropagation(); setEditingId(swatch.id!); setEditName(swatch.name); }} 
                                                    className={`transition-all ${activeId === swatch.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto'} text-gray-400`}>
                                                    <Edit2 size={12}/>
                                                </button>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono uppercase">{swatch.hex}</div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* RE-CONNECTED BUTTONS WITH TOUCH FIX */}
                                <div className={`flex gap-1 pl-2 transition-all duration-300 ${
                                    activeId === swatch.id 
                                    ? 'opacity-100 translate-x-0 pointer-events-auto' 
                                    : 'opacity-0 translate-x-4 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-hover:pointer-events-auto'
                                }`}>
                                    <button onClick={(e) => { e.stopPropagation(); handleShareSwatch(swatch.name, swatch.hex); }} 
                                        className="text-navy-800 p-2 rounded-lg hover:bg-cream-50 transition-colors">
                                        <Share2 size={16}/>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadSwatch(swatch.name, swatch.hex); }} 
                                        className="text-navy-800 p-2 rounded-lg hover:bg-cream-50 transition-colors">
                                        <Download size={16}/>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteSwatch(swatch.id!); }} 
                                        className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        {/* ... Formulas View (Restore similarly if needed) ... */}
      </div>
    </div>
    
    {/* Data Modal (Keep as is) */}
    {showDataModal && (
        // ... (The same Modal content you have now)
    )}
    </>
  );
}
