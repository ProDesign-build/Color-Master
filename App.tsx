import React, { useState } from 'react';
import { Palette, Camera, Beaker, Book, AlertTriangle, X, Check } from 'lucide-react';
import ColorCanvas from './components/ColorCanvas';
import LeatherPreview from './components/LeatherPreview';
import MixingCalculator from './components/MixingCalculator';
import Library from './components/Library';
import ColorWheel from './components/ColorWheel';
import { ViewState } from './types';
import { db } from './db';

type DialogType = 'alert' | 'confirm';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  onConfirm?: () => void;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViewState>('preview');
  const [currentColor, setCurrentColor] = useState<string>('#8B4513');
  const [customTexture, setCustomTexture] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Custom Dialog State
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  const handleColorSelected = (hex: string) => {
    setCurrentColor(hex);
  };

  const closeDialog = () => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  };

  const performSave = async () => {
    try {
        await db.swatches.add({
            name: saveName.trim(),
            hex: currentColor.toLowerCase(),
            createdAt: Date.now()
        });
        setSaveName('');
        setShowSaveDialog(false);
        closeDialog(); // Close any open confirmation dialogs
        setActiveTab('library');
    } catch(e) {
        console.error("Error saving swatch:", e);
        setDialog({
            isOpen: true,
            type: 'alert',
            title: 'Save Error',
            message: 'An unexpected error occurred while saving to the local database. Please try again.'
        });
    }
  };

  const initiateSaveProcess = async () => {
    if(!saveName.trim()) return;

    const nameToCheck = saveName.trim();
    const hexToCheck = currentColor.toLowerCase();

    try {
        // 1. Check for duplicate name (Case insensitive) - STRICT BLOCK
        const duplicateName = await db.swatches.where('name').equalsIgnoreCase(nameToCheck).first();
        if (duplicateName) {
            setDialog({
                isOpen: true,
                type: 'alert',
                title: 'Name Taken',
                message: `A swatch named "${duplicateName.name}" already exists. Please choose a unique name to avoid confusion in your library.`
            });
            return;
        }

        // 2. Check for duplicate HEX (exact color match) - CONFIRMATION PROMPT
        const duplicateHex = await db.swatches.where('hex').equals(hexToCheck).first();
        if (duplicateHex) {
            setDialog({
                isOpen: true,
                type: 'confirm',
                title: 'Duplicate Color',
                message: `This exact pigment is already cataloged as "${duplicateHex.name}".\n\nDo you want to save it again under the new name "${nameToCheck}"?`,
                onConfirm: performSave
            });
            return;
        }

        // 3. No conflicts, proceed immediately
        await performSave();

    } catch(e) { 
        console.error("Error validating swatch:", e);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 text-navy-900 font-sans flex flex-col lg:flex-row overflow-hidden">
      
      <nav className="bg-navy-900 text-cream-100 flex-shrink-0 lg:w-20 lg:flex-col lg:h-screen flex justify-around lg:justify-start items-center p-2 lg:py-8 z-50 fixed bottom-0 left-0 right-0 lg:relative shadow-2xl border-t border-navy-800 lg:border-t-0 lg:border-r">
        <NavBtn active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={<Palette size={24} />} label="Color" />
        <NavBtn active={activeTab === 'analyze'} onClick={() => setActiveTab('analyze')} icon={<Camera size={24} />} label="Scan" />
        <NavBtn active={activeTab === 'mix'} onClick={() => setActiveTab('mix')} icon={<Beaker size={24} />} label="Mix" />
        <NavBtn active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Book size={24} />} label="Library" />
      </nav>

      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-cream-100 p-4 lg:px-8 flex justify-between items-center z-10">
            <div>
                <h1 className="text-xl lg:text-2xl font-serif font-bold text-navy-900">
                    <span className="text-gold-500">Colour</span>Master
                </h1>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Pigment Artisan Tool</p>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                    <div className="text-xs font-mono font-bold text-navy-800">{currentColor.toUpperCase()}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-tighter">Current Profile</div>
                </div>
                <div 
                    className="w-10 h-10 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    style={{ backgroundColor: currentColor }}
                    onClick={() => setShowSaveDialog(true)}
                />
            </div>
        </header>

        <div className="flex-grow overflow-y-auto p-4 md:p-8 lg:p-10 pb-32 lg:pb-10">
            <div className="max-w-6xl mx-auto lg:h-full">
                {activeTab === 'analyze' && (
                    <div className="grid lg:grid-cols-2 gap-8 lg:h-full">
                        <ColorCanvas onColorSelected={handleColorSelected} />
                        <LeatherPreview 
                            color={currentColor} 
                            texture={customTexture}
                            onTextureChange={setCustomTexture}
                            onSave={() => setShowSaveDialog(true)}
                        />
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div className="grid lg:grid-cols-2 gap-8 lg:h-full">
                        <div className="bg-white rounded-lg p-6 shadow-sm border border-cream-100 flex flex-col items-center justify-center">
                            <h2 className="text-xl font-serif font-bold mb-6 text-center text-navy-900">Color Selection</h2>
                            <ColorWheel color={currentColor} onChange={setCurrentColor} />
                        </div>
                        <LeatherPreview 
                            color={currentColor} 
                            texture={customTexture}
                            onTextureChange={setCustomTexture}
                            onSave={() => setShowSaveDialog(true)}
                        />
                    </div>
                )}

                {activeTab === 'mix' && <MixingCalculator initialColorName={saveName} />}
                {activeTab === 'library' && <Library />}
            </div>
        </div>
      </main>

      {/* Primary Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-navy-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-8 shadow-2xl w-full max-w-sm border-t-8 border-gold-500 transform transition-all scale-100">
                <h3 className="text-2xl font-serif font-bold text-navy-900 mb-6 text-center">Catalog Swatch</h3>
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full shadow-xl border-4 border-white" style={{backgroundColor: currentColor}} />
                </div>
                <input 
                    type="text" 
                    placeholder="e.g. Vintage Saddle" 
                    className="w-full bg-cream-50 border border-gray-200 rounded-lg p-3 mb-6 focus:border-navy-900 outline-none font-medium text-navy-900 placeholder:text-gray-400"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={() => setShowSaveDialog(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg transition-colors">Discard</button>
                    <button 
                        onClick={initiateSaveProcess} 
                        disabled={!saveName} 
                        className="flex-1 py-3 bg-navy-900 text-gold-400 font-bold rounded-lg hover:bg-navy-800 disabled:opacity-50 shadow-lg"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Custom Alert/Confirm Dialog (Higher Z-Index) */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-150">
             <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`p-4 flex items-center gap-3 ${dialog.type === 'alert' ? 'bg-red-50 border-b border-red-100' : 'bg-gold-50 border-b border-gold-100'}`}>
                    {dialog.type === 'alert' ? (
                        <AlertTriangle className="text-red-600" size={24} />
                    ) : (
                        <AlertTriangle className="text-gold-600" size={24} />
                    )}
                    <h3 className={`font-serif font-bold text-lg ${dialog.type === 'alert' ? 'text-red-800' : 'text-navy-900'}`}>
                        {dialog.title}
                    </h3>
                    <button onClick={closeDialog} className="ml-auto text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6">
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {dialog.message}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
                    {dialog.type === 'confirm' ? (
                        <>
                            <button 
                                onClick={closeDialog} 
                                className="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    if(dialog.onConfirm) dialog.onConfirm();
                                }} 
                                className="px-4 py-2 bg-navy-900 text-gold-500 font-bold text-sm rounded-md shadow-md hover:bg-navy-800 transition-colors flex items-center gap-2"
                            >
                                <Check size={16} /> Yes, Save Duplicate
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={closeDialog} 
                            className="w-full px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-md hover:bg-gray-300 transition-colors"
                        >
                            Understood
                        </button>
                    )}
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 w-16 lg:w-auto lg:mb-6 lg:p-3
        ${active ? 'bg-navy-800 text-gold-400 shadow-xl scale-110' : 'text-gray-500 hover:text-white hover:bg-navy-800/40'}`}
    >
        {icon}
        <span className="text-[10px] mt-2 font-bold uppercase tracking-tighter">{label}</span>
    </button>
);

export default App;