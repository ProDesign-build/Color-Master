import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
// 👇 Updated Import: Removed performAutoBackup, Added performSilentBackup
import { db, triggerBackupDownload, performSilentBackup, resetDatabase, setupBackupHandle } from '../db';
import { Book, Trash2, Download, Droplet, Edit2, Check, Search, X, Palette, Share2, Database, FileUp, FileDown, AlertTriangle, Settings, Power, FileJson } from 'lucide-react';
import { colord } from 'colord';

export default function Library() {
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

  // Backup/Restore State
  const [showDataModal, setShowDataModal] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [hasFileHandle, setHasFileHandle] = useState(false);
  const [browserSupportsFSA, setBrowserSupportsFSA] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load preference
    setAutoBackupEnabled(localStorage.getItem('cm_auto_backup') === 'true');
    setBrowserSupportsFSA('showSaveFilePicker' in window);
    
    // Check if we have a handle stored
    const checkHandle = async () => {
        const rec = await db.meta.get('backupHandle');
        setHasFileHandle(!!rec);
    };
    checkHandle();
  }, [showDataModal]);

  const toggleAutoBackup = () => {
      const newState = !autoBackupEnabled;
      setAutoBackupEnabled(newState);
      localStorage.setItem('cm_auto_backup', newState ? 'true' : 'false');
  };

  const linkBackupFile = async () => {
      try {
          await setupBackupHandle();
          setHasFileHandle(true);
          // Auto-enable backup if setting up file
          if (!autoBackupEnabled) toggleAutoBackup();
          alert("Backup file linked! Future saves will attempt to overwrite this file.");
      } catch (e: any) {
          console.error(e);
          if (e.name !== 'AbortError') {
            alert(e.message || "Could not link file.");
          }
      }
  };

  // 👇 Updated Logic: Use performSilentBackup
  const checkAndRunAutoBackup = async () => {
    if (localStorage.getItem('cm_auto_backup') === 'true') {
        await performSilentBackup();
    }
  };

  const deleteSwatch = async (id: number) => {
      await db.swatches.delete(id);
      await checkAndRunAutoBackup();
  };

  const deleteFormula = async (id: number) => {
      await db.formulas.delete(id);
      await checkAndRunAutoBackup();
  };

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
    await checkAndRunAutoBackup();
  };

  const toggleActive = (id: number) => {
    if (editingId) return; // Don't toggle while renaming
    setActiveId(prev => prev === id ? null : id);
  };

  const handleExportBackup = async () => {
    const success = await triggerBackupDownload();
    if (!success) {
        alert("Failed to generate backup file.");
    }
  };

  const handleResetDatabase = async () => {
    if (confirm("WARNING: ALL DATA WILL BE DELETED.\n\nThis action cannot be undone. Are you absolutely sure you want to clear your entire library?")) {
        await resetDatabase();
        setHasFileHandle(false);
        setShowDataModal(false);
        alert("Library has been reset.");
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target?.result as string;
              const json = JSON.parse(text);

              // Basic validation
              if (!json.data || !Array.isArray(json.data.swatches) || !Array.isArray(json.data.formulas)) {
                  throw new Error("Invalid backup file format");
              }

              // Perform import transaction
              await db.transaction('rw', db.swatches, db.formulas, async () => {
                   // Strip IDs to allow auto-increment to handle new keys, effectively "merging" duplicates
                   const swatchesToImport = json.data.swatches.map(({id, ...rest}: any) => rest);
                   const formulasToImport = json.data.formulas.map(({id, ...rest}: any) => rest);

                   if(swatchesToImport.length > 0) await db.swatches.bulkAdd(swatchesToImport);
                   if(formulasToImport.length > 0) await db.formulas.bulkAdd(formulasToImport);
              });

              alert(`Successfully imported ${json.data.swatches.length} swatches and ${json.data.formulas.length} formulas.`);
              setShowDataModal(false);
              
              // Optionally backup after import to sync state
              await checkAndRunAutoBackup();

          } catch (err) {
              console.error(err);
              alert("Error importing file. Please ensure it is a valid Colour Master backup JSON.");
          }
      };
      reader.readAsText(file);
      // Reset input
      if (importInputRef.current) importInputRef.current.value = '';
  };

  // Canvas Generation and Utils
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
      link.href = canvas.toDataURL('image/png', 1.0); link.click();
  };

  const handleShareSwatch = (swatchName: string, color: string) => {
      const canvas = generateSwatchCanvas(swatchName, color);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], `${swatchName}.png`, { type: 'image/png' });
          const shareData = { title: `${swatchName} Swatch`, text: `Pigment formula for ${swatchName}`, files: [file] };
          if (navigator.canShare && navigator.canShare(shareData)) { try { await navigator.share(shareData); } catch (err) {} } else { alert("Sharing not supported."); }
      }, 'image/png', 1.0);
  };

  // Filter Logic
  const filteredSwatches = swatches?.filter(s => s.name.toLowerCase().includes(swatchSearch.toLowerCase()) || s.hex.toLowerCase().includes(swatchSearch.toLowerCase())) || [];
  const filteredFormulas = formulas?.filter(f => f.name.toLowerCase().includes(formulaSearch.toLowerCase())) || [];

  const handleTabChange = (tab: 'swatches' | 'formulas') => { setActiveTab(tab); setActiveId(null); setEditingId(null); };

  return (
    <>
    <div className="h-full flex flex-col gap-4">
      {/* Tab Navigation & Tools */}
      <div className="flex justify-between items-center">
        <div className="flex p-1 bg-cream-100/80 backdrop-blur-sm rounded-xl border border-cream-200">
            <button onClick={() => handleTabChange('swatches')} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'swatches' ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' : 'text-navy-800 hover:bg-cream-200/50'}`}>
                <Palette size={16} /><span className="hidden sm:inline">Swatches</span>
            </button>
            <button onClick={() => handleTabChange('formulas')} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'formulas' ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' : 'text-navy-800 hover:bg-cream-200/50'}`}>
                <Droplet size={16} /><span className="hidden sm:inline">Formulas</span>
            </button>
        </div>
        <button onClick={() => setShowDataModal(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-navy-800 hover:text-gold-600 hover:border-gold-500 shadow-sm transition-all" title="Database Backup & Restore">
            <Database size={18} /><span className="text-xs font-bold uppercase hidden md:inline">Data</span>
        </button>
      </div>

      <div className="flex-grow min-h-0 relative">
        {activeTab === 'swatches' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-navy-900 font-serif font-bold"><h3 className="text-lg">Saved Swatches</h3><span className="text-[10px] bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full border border-gold-200">{filteredSwatches.length}</span></div>
                    </div>
                    <div className="relative group max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold-500 transition-colors" size={16} />
                        <input type="text" placeholder="Search by name or hex..." value={swatchSearch} onChange={(e) => setSwatchSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900/10 outline-none transition-all placeholder:text-gray-400"/>
                        {swatchSearch && (<button onClick={() => setSwatchSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400"><X size={14} /></button>)}
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 pb-32 lg:pb-4 custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredSwatches.length === 0 && (<div className="col-span-full text-center py-20"><div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-cream-100 mb-4"><Book className="text-gray-300" size={32} /></div><p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{swatchSearch ? 'No matching swatches found' : 'Your swatch library is empty'}</p></div>)}
                        {filteredSwatches.map(swatch => (
                            <div key={swatch.id} onClick={() => toggleActive(swatch.id!)} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 group cursor-pointer ${activeId === swatch.id ? 'border-gold-500 bg-gold-50/10 shadow-md scale-[1.01]' : 'border-gray-100 bg-white hover:border-gold-500/30'}`}>
                                <div className="flex items-center gap-3 flex-grow min-w-0">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-md ring-1 ring-gray-100 transition-transform group-hover:scale-105" style={{ backgroundColor: swatch.hex }} />
                                    {editingId === swatch.id ? (<div className="flex items-center gap-1 flex-grow" onClick={e => e.stopPropagation()}><input className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /><button onClick={() => saveRename(swatch.id!, 'swatch')} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow-sm"><Check size={16}/></button></div>) : (<div className="min-w-0 flex-grow"><div className="font-bold text-navy-900 text-sm flex items-center gap-2 truncate">{swatch.name}<button onClick={(e) => { e.stopPropagation(); startEditing(swatch.id!, swatch.name); }} className={`transition-all duration-200 ${activeId === swatch.id ? 'opacity-100 pointer-events-auto text-navy-900' : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-400 hover:text-navy-900'}`}><Edit2 size={12}/></button></div><div className="text-[10px] text-gray-500 font-mono uppercase bg-gray-50 inline-block px-1.5 rounded mt-0.5 border border-gray-100">{swatch.hex}</div></div>)}
                                </div>
                                <div className={`flex gap-1 pl-2 transition-all duration-300 ${activeId === swatch.id ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-hover:pointer-events-auto'}`}><button onClick={(e) => { e.stopPropagation(); handleShareSwatch(swatch.name, swatch.hex); }} className="text-navy-800 hover:text-gold-600 p-2 hover:bg-cream-50 rounded-lg transition-colors"><Share2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); handleDownloadSwatch(swatch.name, swatch.hex); }} className="text-navy-800 hover:text-gold-600 p-2 hover:bg-cream-50 rounded-lg transition-colors"><Download size={16}/></button><button onClick={(e) => { e.stopPropagation(); deleteSwatch(swatch.id!); }} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        {activeTab === 'formulas' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-navy-900 font-serif font-bold"><h3 className="text-lg">Formulas</h3><span className="text-[10px] bg-navy-100 text-navy-800 px-2 py-0.5 rounded-full border border-navy-200">{filteredFormulas.length}</span></div>
                    </div>
                    <div className="relative group max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-900 transition-colors" size={16} />
                        <input type="text" placeholder="Search formulas..." value={formulaSearch} onChange={(e) => setFormulaSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900/10 outline-none transition-all placeholder:text-gray-400" />
                         {formulaSearch && (<button onClick={() => setFormulaSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400"><X size={14} /></button>)}
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 pb-32 lg:pb-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredFormulas.length === 0 && (<div className="col-span-full text-center py-20"><div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-cream-100 mb-4"><Droplet className="text-gray-300" size={32} /></div><p className="text-gray-400 text-sm font-medium uppercase tracking-wider">{formulaSearch ? 'No matching formulas found' : 'No saved formulas yet'}</p></div>)}
                        {filteredFormulas.map(formula => (
                            <div key={formula.id} onClick={() => toggleActive(formula.id!)} className={`p-5 rounded-xl border transition-all duration-300 flex flex-col h-full cursor-pointer ${activeId === formula.id ? 'border-navy-500 bg-navy-50/10 shadow-md' : 'border-gray-100 bg-white hover:border-navy-200'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-grow min-w-0 pr-2">
                                        {editingId === formula.id ? (<div className="flex items-center gap-1 mb-1" onClick={e => e.stopPropagation()}><input className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /><button onClick={() => saveRename(formula.id!, 'formula')} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow-sm"><Check size={16}/></button></div>) : (<div className="font-bold text-navy-900 flex items-center gap-2 text-base truncate"><div className="bg-navy-50 p-1.5 rounded-md"><Droplet size={16} className="text-gold-500 flex-shrink-0" /></div><span className="truncate" title={formula.name}>{formula.name}</span><button onClick={(e) => { e.stopPropagation(); startEditing(formula.id!, formula.name); }} className={`transition-all duration-200 ${activeId === formula.id ? 'opacity-100 pointer-events-auto text-navy-900' : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-400 hover:text-navy-900'}`}><Edit2 size={12}/></button></div>)}
                                        <div className="text-[10px] text-gray-400 mt-2 uppercase tracking-wider font-medium flex gap-2"><span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">Batch: {formula.batchSize}{formula.unit}</span><span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">{formula.ratioMode === 'percentage' ? 'Percents' : 'Parts'}</span></div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); deleteFormula(formula.id!); }} className={`p-2 rounded-lg transition-all ${activeId === formula.id ? 'opacity-100 pointer-events-auto text-gray-400 hover:text-red-500 hover:bg-red-50' : 'opacity-0 pointer-events-none lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto text-gray-300 hover:text-red-500'}`}><Trash2 size={18}/></button>
                                </div>
                                <div className="space-y-2 border-t border-gray-50 pt-3 mt-auto"><div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Pigment Breakdown</div>{formula.pigments.map(p => (<div key={p.id} className="flex justify-between text-xs items-center group/item hover:bg-cream-50/50 p-1 rounded -mx-1 transition-colors"><span className="text-gray-700 truncate pr-2 font-medium">{p.name || 'Unnamed Pigment'}</span><span className="font-mono text-navy-900 font-bold bg-cream-100 px-1.5 py-0.5 rounded min-w-[3rem] text-center border border-cream-200">{formula.ratioMode === 'percentage' ? `${((p.ratio/100)*formula.batchSize).toFixed(1)}` : `${(p.ratio * (formula.batchSize / formula.pigments.reduce((s,x)=>s+(x.ratio || 0),0))).toFixed(1)}`}<span className="text-[9px] text-gray-500 ml-0.5 font-normal">ml</span></span></div>))}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>

    {/* Backup/Restore Modal */}
    {showDataModal && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="bg-cream-50 p-5 border-b border-cream-100 flex items-center gap-3">
                    <Database className="text-navy-900" size={24} />
                    <h3 className="font-serif font-bold text-lg text-navy-900">Library Management</h3>
                    <button onClick={() => setShowDataModal(false)} className="ml-auto text-gray-400 hover:text-red-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* SECTION 1: Backup & Restore */}
                    <div>
                        <h4 className="text-xs font-bold uppercase text-navy-900 mb-3 tracking-wider">Backup & Restore</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={handleExportBackup} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-navy-900 hover:bg-navy-50 transition-all group">
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform"><FileDown className="text-navy-900" size={24} /></div>
                                <span className="text-xs font-bold uppercase text-navy-900">Export Backup</span>
                            </button>
                            <button onClick={() => importInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-gold-500 hover:bg-gold-50 transition-all group">
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform"><FileUp className="text-gold-600" size={24} /></div>
                                <span className="text-xs font-bold uppercase text-navy-900">Restore Library</span>
                            </button>
                            <input type="file" ref={importInputRef} className="hidden" accept="application/json" onChange={handleImportBackup} />
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2">
                        <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                        <span className="text-[10px] text-yellow-800 font-medium leading-tight">Importing will merge data. Existing items are preserved.</span>
                    </div>

                    <hr className="border-gray-100" />

                    {/* SECTION 2: Settings */}
                    <div>
                         <h4 className="text-xs font-bold uppercase text-navy-900 mb-3 tracking-wider flex items-center gap-2"><Settings size={12} /> Auto-Backup</h4>
                         
                         <div className="flex flex-col gap-4">
                             <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                 <div className="flex flex-col">
                                     <span className="text-sm font-bold text-navy-900">Enable on Save/Edit</span>
                                     <span className="text-[10px] text-gray-500">Auto-update backup on create, delete, or rename.</span>
                                 </div>
                                 <button onClick={toggleAutoBackup} className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${autoBackupEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                                     <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${autoBackupEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                 </button>
                             </div>

                             {/* File Handle Setup */}
                             {browserSupportsFSA ? (
                                 <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${hasFileHandle ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                     <div className="flex flex-col">
                                         <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-navy-900">Single File Backup</span>
                                            {hasFileHandle && <Check size={12} className="text-green-600" />}
                                         </div>
                                         <span className="text-[10px] text-gray-500">
                                            {hasFileHandle ? 'Linked. Backups will overwrite this file.' : 'Link a file to avoid multiple downloads.'}
                                         </span>
                                     </div>
                                     <button 
                                        onClick={linkBackupFile}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold shadow-sm transition-colors ${hasFileHandle ? 'bg-white text-green-700 border border-green-200' : 'bg-navy-900 text-gold-500'}`}
                                     >
                                        {hasFileHandle ? 'Update Link' : 'Link File'}
                                     </button>
                                 </div>
                             ) : (
                                 <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-[10px] text-gray-500 flex gap-2">
                                     <FileJson size={16} className="shrink-0" />
                                     <span>Your browser does not support single-file overwriting. New files will be created for each backup.</span>
                                 </div>
                             )}
                         </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* SECTION 3: Danger Zone */}
                    <div>
                         <h4 className="text-xs font-bold uppercase text-red-600 mb-3 tracking-wider">Danger Zone</h4>
                         <button onClick={handleResetDatabase} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-bold text-sm">
                             <Power size={16} /> Factory Reset (Clear All Data)
                         </button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
}
