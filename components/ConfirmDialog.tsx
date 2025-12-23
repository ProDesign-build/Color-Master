import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

export type DialogType = 'alert' | 'confirm';

export interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  onConfirm?: () => void;
}

interface ConfirmDialogProps {
  dialog: DialogState;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ dialog, onClose }) => {
  if (!dialog.isOpen) return null;

  return (
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
            <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
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
                        onClick={onClose} 
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
                    onClick={onClose} 
                    className="w-full px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-md hover:bg-gray-300 transition-colors"
                >
                    Understood
                </button>
            )}
        </div>
        </div>
    </div>
  );
};