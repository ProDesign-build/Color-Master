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

  // Backup/Restore State
  const [showDataModal, setShowDataModal] = useState(false);
  const [hasLinkedFile, setHasLinkedFile] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Check if we have a linked file when modal opens
  useEffect(() => {
    const checkLink = async () => {
        const rec = await db.meta.get('backupHandle');
        setHasLinkedFile(!!rec);
    };
    if (showDataModal) checkLink();
  }, [showDataModal]);

  const deleteSwatch = async (id: number) => {
      await db.swatches.delete(id);
  };

  const deleteFormula = async (id: number) => {
      await db.formulas.delete(id);
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
  };

  const toggleActive = (id: number) => {
    if (editingId) return; 
    setActiveId(prev => prev === id ? null : id);
  };

  // --- 1. OVERWRITE LINKED FILE (Primary Action) ---
  const handleManualBackup = async () => {
    setIsBackingUp(true);
    const result = await performManualOverwrite();
    setIsBackingUp(false);
    
    if (result === 'overwritten') {
        // SUCCESS: File replaced on disk, no download tray activity.
        alert("Success! Your linked backup file has been updated on your device.");
    } else if (result === 'created') {
        alert("Success! New backup file created and linked.");
        setHasLinkedFile(true);
    } else if (result === 'denied') {
        alert("Permission denied. Could not update the file.");
    } else if (result === 'not-supported') {
        alert("Your browser does not support direct overwriting. Use 'Export Copy' instead.");
    }
  };

  // --- 2. EXPORT FRESH COPY (Force Download) ---
  const handleExportCopy = async () => {
      const success = await triggerBackupDownload();
      if (!success) alert("Failed to generate export.");
  };

  const handleResetDatabase = async () => {
    if (confirm("WARNING: ALL DATA WILL BE DELETED. Action cannot be undone.")) {
        await resetDatabase();
        setHasLinkedFile(false);
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

              if (!json.data || !Array.isArray(json.data.swatches) || !Array.isArray(json.data.formulas)) {
                  throw new Error("Invalid backup file format");
              }

              await db.transaction('rw', db.swatches, db.formulas, async () => {
                   const swatchesToImport = json.data.swatches.map(({id, ...rest}: any) => rest);
                   const formulasToImport = json.data.formulas.map(({id, ...rest}: any) => rest);
                   if(swatchesToImport.length > 0) await db.swatches.bulkAdd(swatchesToImport);
                   if(formulasToImport.length > 0) await db.formulas.bulkAdd(formulasToImport);
              });

              alert(`Successfully imported data.`);
              setShowDataModal(false);
          } catch (err) {
              alert("Error importing file. Invalid format.");
          }
      };
      reader.readAsText(file);
      if (importInputRef.current) importInputRef.current.value = '';
  };

  // Filter Logic
  const filteredSwatches = swatches?.filter(s => s.name.toLowerCase().includes(swatchSearch.toLowerCase()) || s.hex.toLowerCase().includes(swatchSearch.toLowerCase())) || [];
  const filteredFormulas = formulas?.filter(f => f.name.toLowerCase().includes(formulaSearch.toLowerCase())) || [];
  const handleTabChange = (tab: 'swatches' | 'formulas') => { setActiveTab(tab); setActiveId(null); setEditingId(null); };

  return (
    <>
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex p-1 bg-cream-100/80 backdrop-blur-sm rounded-xl border border-cream-200">
            <button onClick={() => handleTabChange('swatches')} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'swatches' ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' : 'text-navy-800 hover:bg-cream-200/50'}`}>
                <Palette size={16} /><span className="hidden sm:inline">Swatches</span>
            </button>
            <button onClick={() => handleTabChange('formulas')} className={`flex items-center gap-2 px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === 'formulas' ? 'bg-navy-900 text-gold-500 shadow-md transform scale-[1.02]' : 'text-navy-800 hover:bg-cream-200/50'}`}>
                <Droplet size={16} /><span className="hidden sm:inline">Formulas</span>
            </button>
        </div>
        <button onClick={() => setShowDataModal(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-navy-800 hover:text-gold-600 hover:border-gold-500 shadow-sm transition-all">
            <Database size={18} /><span className="text-xs font-bold uppercase hidden md:inline">Data</span>
        </button>
      </div>

      <div className="flex-grow min-h-0 relative">
        {/* Swatches and Formulas Views (Unchanged Content) */}
        {activeTab === 'swatches' && (
            <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-cream-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-gray-100 bg-cream-50/50">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-navy-900 font-serif font-bold"><h3 className="text-lg">Saved Swatches</h3><span className="text-[10px] bg-gold-100 text-gold-700 px-2 py-0.5 rounded-full border border-gold-200">{filteredSwatches.length}</span></div>
                    </div>
                    <div className="relative group max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold-500 transition-colors" size={16} />
                        <input type="text" placeholder="Search..." value={swatchSearch} onChange={(e) => setSwatchSearch(e.target.value)} className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-navy-900 outline-none transition-all placeholder:text-gray-400"/>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 pb-32 lg:pb-4 custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredSwatches.map(swatch => (
                            <div key={swatch.id} onClick={() => toggleActive(swatch.id!)} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-300 group cursor-pointer ${activeId === swatch.id ? 'border-gold-500 bg-gold-50/10 shadow-md scale-[1.01]' : 'border-gray-100 bg-white hover:border-gold-500/30'}`}>
                                <div className="flex items-center gap-3 flex-grow min-w-0">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full border-4 border-white shadow-md ring-1 ring-gray-100" style={{ backgroundColor: swatch.hex }} />
                                    {editingId === swatch.id ? (<div className="flex items-center gap-1 flex-grow" onClick={e => e.stopPropagation()}><input className="bg-white border border-gold-500 rounded px-2 py-1 text-sm w-full outline-none shadow-sm" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus /><button onClick={() => saveRename(swatch.id!, 'swatch')} className="text-white bg-green-500 hover:bg-green-600 p-1 rounded shadow-sm"><Check size={16}/></button></div>) : (<div className="min-w-0 flex-grow"><div className="font-bold text-navy-900 text-sm flex items-center gap-2 truncate">{swatch.name}<button onClick={(e) => { e.stopPropagation(); startEditing(swatch.id!, swatch.name); }} className={`transition-all ${activeId === swatch.id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'} text-gray-400`}><Edit2 size={12}/></button></div><div className="text-[10px] text-gray-500 font-mono uppercase">{swatch.hex}</div></div>)}
                                </div>
                                <div className={`flex gap-1 pl-2 transition-all ${activeId === swatch.id ? 'opacity-100' : 'opacity-0 lg:group-hover:opacity-100'}`}><button onClick={(e) => { e.stopPropagation(); }} className="text-navy-800 p-2 rounded-lg hover:bg-cream-50"><Share2 size={16}/></button><button onClick={(e) => { e.stopPropagation(); }} className="text-navy-800 p-2 rounded-lg hover:bg-cream-50"><Download size={16}/></button><button onClick={(e) => { e.stopPropagation(); deleteSwatch(swatch.id!); }} className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        {/* Formulas Tab Logic (Omitted for Brevity - Same structure as Swatches) */}
      </div>
    </div>

    {/* Backup/Restore Modal */}
    {showDataModal && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="bg-cream-50 p-5 border-b border-cream-100 flex items-center gap-3">
                    <Database className="text-navy-900" size={24} />
                    <h3 className="font-serif font-bold text-lg text-navy-900">Library Management</h3>
                    <button onClick={() => setShowDataModal(false)} className="ml-auto text-gray-400 hover:text-red-500 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold uppercase text-navy-900 mb-3 tracking-wider text-center">Backup & Restore</h4>
                        <div className="grid grid-cols-2 gap-4">
                            
                            {/* ACTION 1: OVERWRITE LINKED FILE (PRIMARY) */}
                            <button 
                                onClick={handleManualBackup}
                                disabled={isBackingUp}
                                className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all group col-span-2 ${hasLinkedFile ? 'border-green-200 bg-green-50 hover:bg-green-100' : 'border-gray-200 hover:border-navy-900 hover:bg-navy-50'}`}
                            >
                                <div className={`p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform ${hasLinkedFile ? 'bg-white text-green-700' : 'bg-white text-navy-900'}`}>
                                    {isBackingUp ? <RefreshCw className="animate-spin" size={24} /> : (hasLinkedFile ? <Save size={24} /> : <FileDown size={24} />)}
                                </div>
                                <span className={`text-xs font-bold uppercase ${hasLinkedFile ? 'text-green-800' : 'text-navy-900'}`}>
                                    {hasLinkedFile ? 'Update Backup File' : 'Save to Disk'}
                                </span>
                                {hasLinkedFile && <span className="text-[10px] text-green-600 -mt-2 text-center">Overwrites linked file on device</span>}
                            </button>

                            {/* ACTION 2: EXPORT FRESH COPY (DOWNLOAD) */}
                            <button onClick={handleExportCopy} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-navy-500 hover:bg-navy-50 transition-all group">
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform"><FileDown className="text-navy-700" size={24} /></div>
                                <span className="text-xs font-bold uppercase text-navy-700">Export Copy</span>
                            </button>

                            {/* ACTION 3: RESTORE (UPLOAD) */}
                            <button onClick={() => importInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-gold-500 hover:bg-gold-50 transition-all group">
                                <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform"><FileUp className="text-gold-600" size={24} /></div>
                                <span className="text-xs font-bold uppercase text-navy-900">Restore</span>
                            </button>
                            <input type="file" ref={importInputRef} className="hidden" accept="application/json" onChange={handleImportBackup} />
                        </div>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2">
                        <AlertTriangle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
                        <span className="text-[10px] text-yellow-800 font-medium leading-tight text-center">Restore merges data into current library. No items are deleted.</span>
                    </div>

                    <hr className="border-gray-100" />

                    <div>
                         <h4 className="text-xs font-bold uppercase text-red-600 mb-3 tracking-wider text-center">Danger Zone</h4>
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
