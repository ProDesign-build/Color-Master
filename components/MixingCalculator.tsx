import React, { useState } from 'react';
import { Beaker, Plus, Trash2, Save, AlertCircle, Percent, Hash, CheckCircle2 } from 'lucide-react';
import { Formula, Pigment } from '../types';
import { db, performAutoBackup } from '../db';
import { ConfirmDialog, DialogState } from './ConfirmDialog';

interface MixingCalculatorProps {
    initialColorName?: string;
}

const MixingCalculator: React.FC<MixingCalculatorProps> = ({ initialColorName }) => {
  const [batchSize, setBatchSize] = useState<number>(100);
  const [customInput, setCustomInput] = useState<string>('100');
  const [ratioMode, setRatioMode] = useState<'percentage' | 'parts'>('percentage');
  const [pigments, setPigments] = useState<Pigment[]>([
    { id: '1', name: 'Base White', ratio: 0 },
  ]);
  const [formulaName, setFormulaName] = useState(initialColorName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dialog State
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const PRESETS = [30, 50, 100, 250, 500, 1000];

  const handlePresetClick = (size: number) => {
    setBatchSize(size);
    setCustomInput(size.toString());
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Prevent negative sign from being typed
    if (val.includes('-')) return;

    setCustomInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
        setBatchSize(num);
    }
  };

  const totalUnits = parseFloat(pigments.reduce((sum, p) => sum + (p.ratio || 0), 0).toFixed(2));
  const isValid = ratioMode === 'percentage' 
    ? Math.abs(totalUnits - 100) < 0.1 
    : totalUnits > 0;
  
  const remainingPercentage = parseFloat((100 - totalUnits).toFixed(1));

  const addPigment = () => {
    setPigments([...pigments, { id: crypto.randomUUID(), name: '', ratio: 0 }]);
  };

  const removePigment = (id: string) => {
    setPigments(pigments.filter(p => p.id !== id));
  };

  const updatePigment = (id: string, field: keyof Pigment, value: string | number) => {
    let finalValue = value;
    
    // Prevent negative values for ratios
    if (field === 'ratio' && typeof value === 'number') {
        if (value < 0) finalValue = 0;
        // Limit to 100 if in percentage mode
        if (ratioMode === 'percentage' && value > 100) finalValue = 100;
    }

    let updatedList = pigments.map(p => 
      p.id === id ? { ...p, [field]: finalValue } : p
    );

    setPigments(updatedList);
  };

  const calculateAmount = (ratio: number) => {
    if (ratioMode === 'percentage') {
      return ((ratio / 100) * batchSize).toFixed(1);
    } else {
      const perUnit = batchSize / (totalUnits || 1);
      return (ratio * perUnit).toFixed(1);
    }
  };

  const isSameFormula = (f: Formula, currentPigments: Pigment[], currentMode: string, currentBatchSize: number) => {
    // 1. Exact Batch Size Check
    if (Math.abs(f.batchSize - currentBatchSize) > 0.001) return false;

    // 2. Exact Ratio Mode Check
    if (f.ratioMode !== currentMode) return false;

    // 3. Prepare Pigments
    // Filter out pigments with 0 ratio or empty names to compare actual recipe content
    const cleanCurrent = currentPigments.filter(p => p.ratio > 0 && p.name.trim() !== '');
    const cleanStored = f.pigments.filter(p => p.ratio > 0 && p.name.trim() !== '');

    if (cleanStored.length !== cleanCurrent.length) return false;

    // Sort case-sensitive to ensure order doesn't matter, but casing does
    const sortedStored = [...cleanStored].sort((a,b) => a.name.localeCompare(b.name));
    const sortedCurrent = [...cleanCurrent].sort((a,b) => a.name.localeCompare(b.name));

    // 4. Compare Content
    return sortedStored.every((p, i) => 
        p.name.trim() === sortedCurrent[i].name.trim() && // Exact string match (case sensitive)
        Math.abs(p.ratio - sortedCurrent[i].ratio) < 0.001 // Exact ratio match
    );
  };

  const performSave = async () => {
    if (!formulaName) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
        const formula: Formula = {
            name: formulaName.trim(),
            batchSize,
            unit: 'ml',
            ratioMode,
            pigments, // Save all, even 0s if user wants draft
            createdAt: Date.now()
        };
        await db.formulas.add(formula);

        // --- AUTO BACKUP CHECK ---
        const isAutoBackup = localStorage.getItem('cm_auto_backup') === 'true';
        if (isAutoBackup) {
            performAutoBackup();
        }

        setFormulaName('');
        
        // Close dialog if open (from confirmation)
        closeDialog();

        // Success Feedback
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
        console.error(e);
        setDialog({
            isOpen: true,
            type: 'alert',
            title: 'Save Error',
            message: 'Failed to save formula to local storage.'
        });
    } finally {
        setIsSaving(false);
    }
  };

  const initiateSave = async () => {
      if (!formulaName || !isValid) return;

      const nameToCheck = formulaName.trim();
      
      try {
           // 1. Check for duplicate Name (Case insensitive for names to avoid confusion)
           const duplicateName = await db.formulas.where('name').equalsIgnoreCase(nameToCheck).first();
           if (duplicateName) {
                setDialog({
                    isOpen: true,
                    type: 'alert',
                    title: 'Name Taken',
                    message: `A formula named "${duplicateName.name}" already exists. Please choose a unique name to avoid confusion in your library.`
                });
                return;
           }

           // 2. Check for duplicate Content (Strict: Batch, Mode, Case-Sensitive Pigments, Ratios)
           const allFormulas = await db.formulas.toArray();
           const duplicateFormula = allFormulas.find(f => isSameFormula(f, pigments, ratioMode, batchSize));

           if (duplicateFormula) {
                setDialog({
                    isOpen: true,
                    type: 'confirm',
                    title: 'Duplicate Formula',
                    message: `This exact formula mix (including batch size and pigment names) is already cataloged as "${duplicateFormula.name}".\n\nDo you want to save it again under the new name "${nameToCheck}"?`,
                    onConfirm: performSave
                });
                return;
           }

           // 3. Proceed
           await performSave();

      } catch (e) {
          console.error("Error validating formula:", e);
      }
  };

  return (
    <>
        <div className="bg-white rounded-lg shadow-sm border border-cream-100 flex flex-col lg:h-full lg:overflow-hidden min-h-0 relative">
        <div className="flex-grow lg:overflow-y-auto p-6 pb-32 lg:pb-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-serif text-navy-900 font-bold flex items-center gap-2">
                    <Beaker className="text-gold-500" /> Mixing Lab
                </h2>
                
                <div className="flex bg-cream-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setRatioMode('percentage')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${ratioMode === 'percentage' ? 'bg-navy-900 text-gold-500 shadow-sm' : 'text-navy-800'}`}
                    >
                        <Percent size={14} /> %
                    </button>
                    <button 
                        onClick={() => setRatioMode('parts')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${ratioMode === 'parts' ? 'bg-navy-900 text-gold-500 shadow-sm' : 'text-navy-800'}`}
                    >
                        <Hash size={14} /> Parts
                    </button>
                </div>
            </div>

            {/* Name Input & Save Button */}
            <div className="mb-8">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Formula Name</label>
                <div className="flex items-center gap-3">
                    <input 
                        type="text"
                        placeholder="e.g. Vintage Saddle Tan"
                        value={formulaName}
                        onChange={(e) => setFormulaName(e.target.value)}
                        className="flex-grow text-lg px-4 py-3 bg-cream-50 border-b-2 border-gray-200 hover:border-gold-500/50 focus:border-gold-500 rounded-t-lg outline-none transition-all placeholder:text-gray-300 font-serif text-navy-900"
                    />
                    <button 
                        onClick={initiateSave}
                        disabled={!isValid || !formulaName || isSaving}
                        className={`p-3 rounded-lg shadow-md transition-all flex-shrink-0 ${
                            saveSuccess 
                            ? 'bg-green-600 text-white shadow-green-200' 
                            : (!isValid || !formulaName)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-navy-900 text-gold-400 hover:bg-navy-800 hover:shadow-xl shadow-navy-900/20'
                        }`}
                        title="Save Formula"
                    >
                        {saveSuccess ? <CheckCircle2 size={24}/> : <Save size={24} />} 
                    </button>
                </div>
            </div>

            <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-navy-900 mb-3">Batch Size (ml)</label>
                <div className="flex flex-wrap gap-2 items-center">
                    {PRESETS.map(size => (
                        <button
                            key={size}
                            onClick={() => handlePresetClick(size)}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${batchSize === size ? 'bg-navy-900 text-gold-400 shadow-md transform scale-105' : 'bg-cream-100 text-navy-800 hover:bg-cream-200'}`}
                        >
                            {size}ml
                        </button>
                    ))}
                    
                    <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>

                    <div className="relative group flex items-center flex-grow sm:flex-grow-0">
                        <input 
                            type="number"
                            min="0"
                            step="any"
                            value={customInput}
                            onChange={handleCustomChange}
                            className={`w-full sm:w-24 pl-3 pr-8 py-2 rounded-md text-sm font-medium outline-none border transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                                ${!PRESETS.includes(batchSize) 
                                    ? 'border-gold-500 ring-1 ring-gold-500 text-navy-900 bg-white shadow-sm' 
                                    : 'border-gray-200 bg-cream-50 text-gray-500 focus:border-navy-900 focus:text-navy-900 focus:bg-white'
                                }`}
                            placeholder="Custom"
                        />
                        <span className="absolute right-3 text-xs text-gray-400 font-bold pointer-events-none">ml</span>
                    </div>
                </div>
            </div>

            <div className="space-y-3 mb-6">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
                    <div className="col-span-6">Pigment</div>
                    <div className="col-span-2 text-right">{ratioMode === 'percentage' ? '%' : 'Pts'}</div>
                    <div className="col-span-3 text-right">Volume (ml)</div>
                    <div className="col-span-1"></div>
                </div>

                {pigments.map((p) => (
                    <div key={p.id} className="grid grid-cols-12 gap-2 items-center group">
                        <div className="col-span-6">
                            <input 
                                type="text" 
                                value={p.name}
                                onChange={(e) => updatePigment(p.id, 'name', e.target.value)}
                                className="w-full bg-cream-50 border border-transparent focus:border-gold-500 rounded px-2 py-2 text-sm"
                                placeholder="Pigment Name"
                            />
                        </div>
                        <div className="col-span-2">
                            <input 
                                type="number" 
                                min="0"
                                max={ratioMode === 'percentage' ? 100 : undefined}
                                value={p.ratio || ''}
                                onChange={(e) => updatePigment(p.id, 'ratio', parseFloat(e.target.value))}
                                className="w-full text-right bg-cream-50 border border-transparent focus:border-gold-500 rounded px-2 py-2 text-sm font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="col-span-3 text-right font-mono text-sm font-bold text-navy-900">
                            {calculateAmount(p.ratio)}
                        </div>
                        <button onClick={() => removePigment(p.id)} className="col-span-1 flex justify-center text-gray-300 hover:text-red-500">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                
                {/* Total / Validation Inline Row */}
                <div className="grid grid-cols-12 gap-2 items-center px-1 py-3 border-t border-gray-100 bg-cream-50/50 rounded-lg">
                    <div className="col-span-6 text-right text-[10px] font-bold uppercase text-gray-400 tracking-widest">
                        Total
                    </div>
                    <div className={`col-span-2 text-right text-sm font-mono font-bold ${
                        ratioMode === 'percentage' 
                            ? (isValid ? 'text-green-600' : (remainingPercentage > 0 ? 'text-gold-600' : 'text-red-500')) 
                            : 'text-navy-900'
                    }`}>
                        {totalUnits}{ratioMode === 'percentage' ? '%' : ''}
                    </div>
                    <div className="col-span-4 pl-2">
                        {ratioMode === 'percentage' && (
                            <>
                                {isValid ? (
                                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Perfect
                                    </span>
                                ) : (
                                    <span className={`text-[10px] font-bold flex items-center gap-1 ${remainingPercentage > 0 ? 'text-gold-600' : 'text-red-500'}`}>
                                    <AlertCircle size={12} />
                                    {remainingPercentage > 0 ? `Add ${remainingPercentage}%` : `Remove ${Math.abs(remainingPercentage)}%`}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <button 
                    onClick={addPigment}
                    className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-gray-100 rounded-lg text-xs text-gray-400 hover:border-gold-500 hover:text-gold-600 transition-all"
                >
                    <Plus size={14} /> Add Pigment
                </button>
            </div>
        </div>
        </div>
        
        {/* Reusable Confirmation Dialog */}
        <ConfirmDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
};

export default MixingCalculator;
