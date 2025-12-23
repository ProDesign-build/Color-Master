import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Pipette, X, Maximize2, Check, ZoomIn, RefreshCw, Target, AlertTriangle } from 'lucide-react';
import { colord, RgbaColor } from 'colord';

interface ColorCanvasProps {
  onColorSelected: (hex: string) => void;
}

type ViewMode = 'idle' | 'camera' | 'image_preview' | 'sampler';

const ColorCanvas: React.FC<ColorCanvasProps> = ({ onColorSelected }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const samplerCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [sampledColor, setSampledColor] = useState<string | null>(null);
  
  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false); // Toggle in camera
  const [calibrationStep, setCalibrationStep] = useState<'none' | 'pick_white'>('none');
  const [whiteReference, setWhiteReference] = useState<RgbaColor | null>(null);
  const [showCalibInfo, setShowCalibInfo] = useState(false);

  // Focus State
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusPos, setFocusPos] = useState({ x: 0, y: 0 });

  // Loupe / Interaction State
  const [loupe, setLoupe] = useState<{x: number, y: number, color: string, rawColor?: string} | null>(null);

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // --- CONNECT STREAM TO VIDEO ---
  useEffect(() => {
    if (viewMode === 'camera' && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure it plays (sometimes autoplay needs a kick)
      videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
    }
  }, [viewMode, stream]);

  // --- CAMERA CONTROL ---
  const startCamera = async () => {
    try {
      // Use constraints that prefer high resolution and environment facing camera
      const constraints: MediaStreamConstraints = { 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        } 
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      // Attempt to enable continuous autofocus initially
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any; // Cast to allow accessing focusMode

      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
         try {
             await track.applyConstraints({
                 advanced: [{ focusMode: 'continuous' } as any]
             });
         } catch(e) {
             console.log("Auto-focus init failed", e);
         }
      }

      setViewMode('camera');
      setSampledColor(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setViewMode(imageSrc ? 'image_preview' : 'idle');
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setImageSrc(dataUrl);
      
      // Stop stream
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      
      // Transition
      if (isCalibrating) {
        setCalibrationStep('pick_white');
        setViewMode('sampler');
      } else {
        setCalibrationStep('none');
        setViewMode('sampler');
      }
    }
  };

  const handleTapFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      // Prevent focus if we are clicking controls (handled by stopPropagation on buttons usually, but checking helps)
      // Get coordinates
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }
      
      // Visual Feedback
      setFocusPos({ x: clientX, y: clientY });
      setIsFocusing(true);
      setTimeout(() => setIsFocusing(false), 1000);

      // Hardware Focus Logic
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;

      if (capabilities.focusMode) {
          try {
              // 1. Switch to 'auto' (often triggers a one-shot macro focus scan) or 'manual' if supported
              // 'auto' is generally the safest "refocus" request
              await track.applyConstraints({
                  advanced: [{ focusMode: 'auto' } as any]
              });

              // 2. Return to continuous after a short delay to maintain tracking
              setTimeout(() => {
                  track.applyConstraints({
                      advanced: [{ focusMode: 'continuous' } as any]
                  }).catch(() => {});
              }, 1200);

          } catch(err) {
              console.debug("Focus adjustment failed", err);
          }
      }
  };

  // --- FILE UPLOAD ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target?.result as string);
        setSampledColor(null);
        setViewMode('sampler');
        // Reset calibration for new upload
        setWhiteReference(null);
        setIsCalibrating(false);
        setCalibrationStep('none');
      };
      reader.readAsDataURL(file);
    }
  };

  // --- CALIBRATION LOGIC ---
  const toggleCalibration = () => {
      if (isCalibrating) {
          setIsCalibrating(false);
      } else {
          // Check if we should show info
          const skip = localStorage.getItem('lm_skip_calib_info');
          if (!skip) {
              setShowCalibInfo(true);
          } else {
              setIsCalibrating(true);
          }
      }
  };

  const confirmCalibInfo = (dontShowAgain: boolean) => {
      if (dontShowAgain) localStorage.setItem('lm_skip_calib_info', 'true');
      setShowCalibInfo(false);
      setIsCalibrating(true);
  };

  const getCorrectedColor = (hex: string): string => {
      if (!whiteReference) return hex;
      
      const rgb = colord(hex).toRgb();
      // Simple White Balance: Scale channels so reference becomes pure white (255,255,255)
      // Cap at 255. 
      // Avoid division by zero
      const scaleR = 255 / Math.max(whiteReference.r, 1);
      const scaleG = 255 / Math.max(whiteReference.g, 1);
      const scaleB = 255 / Math.max(whiteReference.b, 1);

      return colord({
          r: Math.min(255, Math.round(rgb.r * scaleR)),
          g: Math.min(255, Math.round(rgb.g * scaleG)),
          b: Math.min(255, Math.round(rgb.b * scaleB)),
          a: rgb.a
      }).toHex();
  };

  // --- RENDERING HELPERS ---
  // Keep the small preview canvas updated
  useEffect(() => {
      if (imageSrc && previewCanvasRef.current && viewMode !== 'camera') {
          const ctx = previewCanvasRef.current.getContext('2d');
          const img = new Image();
          img.src = imageSrc;
          img.onload = () => {
              if (previewCanvasRef.current) {
                previewCanvasRef.current.width = img.width;
                previewCanvasRef.current.height = img.height;
                ctx?.drawImage(img, 0, 0);
              }
          };
      }
  }, [imageSrc, viewMode]);

  // Keep sampler canvas updated
  useEffect(() => {
      if (viewMode === 'sampler' && imageSrc && samplerCanvasRef.current) {
          const ctx = samplerCanvasRef.current.getContext('2d');
          const img = new Image();
          img.src = imageSrc;
          img.onload = () => {
              if (samplerCanvasRef.current) {
                  samplerCanvasRef.current.width = img.width;
                  samplerCanvasRef.current.height = img.height;
                  ctx?.drawImage(img, 0, 0);
              }
          };
      }
  }, [viewMode, imageSrc]);

  // --- POINTER EVENTS (Sampling) ---
  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = samplerCanvasRef.current;
      if (!canvas) return;

      if (e.type === 'pointerup') {
          if (loupe) {
              if (calibrationStep === 'pick_white') {
                  // Set White Ref
                  setWhiteReference(colord(loupe.rawColor || loupe.color).toRgb());
                  setCalibrationStep('none');
              } else {
                  // Standard Pick
                  setSampledColor(loupe.color);
                  onColorSelected(loupe.color);
              }
          }
          setLoupe(null);
          return;
      }
      
      if (e.type === 'pointerleave') {
          setLoupe(null);
          return;
      }

      // Calculate Position
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Get Pixel
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      
      try {
          const p = ctx.getImageData(x, y, 1, 1).data;
          const rawHex = colord({ r: p[0], g: p[1], b: p[2] }).toHex();
          
          // If we are currently picking white, show RAW.
          // If we are picking color, show CORRECTED (if ref exists).
          const finalHex = calibrationStep === 'pick_white' ? rawHex : getCorrectedColor(rawHex);

          setLoupe({
              x: e.clientX,
              y: e.clientY,
              color: finalHex,
              rawColor: rawHex
          });
      } catch (err) {
          // ignore out of bounds
      }
  };


  return (
    <>
      {/* 1. DASHBOARD CARD (Embedded in page) */}
      <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow-sm border border-cream-100 h-full relative overflow-hidden">
         <div className="flex justify-between items-center h-8">
            <h2 className="text-xl font-serif text-navy-900 font-bold flex items-center gap-2">
               <Pipette className="text-gold-500" /> Color Sampler
            </h2>
            <div className="flex items-center gap-2">
                 {whiteReference && (
                     <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold">
                        <Check size={12} /> CALIBRATED
                        <button onClick={() => setWhiteReference(null)} className="ml-1 hover:text-red-500"><X size={12}/></button>
                     </div>
                 )}
                 {imageSrc && (
                     <button onClick={() => {
                         setImageSrc(null); 
                         setWhiteReference(null); 
                         setSampledColor(null);
                     }} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors">
                         <RefreshCw size={14} />
                     </button>
                 )}
            </div>
         </div>

         <div className="relative w-full aspect-[4/3] bg-navy-900 rounded-lg overflow-hidden border border-navy-800 shadow-inner group">
             
             {/* Preview Canvas */}
             <canvas ref={previewCanvasRef} className={`w-full h-full object-contain bg-black/20 ${imageSrc ? 'block' : 'hidden'}`} />
             
             {/* Empty State */}
             {!imageSrc && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #D4AF37 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                    <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-xs">
                        <button onClick={startCamera} className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gold-500/50 transition-all group">
                            <div className="p-2 bg-navy-800 rounded-full border border-white/10 group-hover:border-gold-500/50">
                                <Camera className="text-gray-300 group-hover:text-gold-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Use Camera</span>
                        </button>
                        <label className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gold-500/50 transition-all group cursor-pointer">
                            <div className="p-2 bg-navy-800 rounded-full border border-white/10 group-hover:border-gold-500/50">
                                <Upload className="text-gray-300 group-hover:text-gold-400" />
                            </div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Upload Image</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                 </div>
             )}

             {/* View Actions */}
             {imageSrc && (
                 <div className="absolute inset-0 flex items-center justify-center bg-navy-900/40 opacity-0 hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                     <button onClick={() => setViewMode('sampler')} className="bg-white text-navy-900 px-6 py-2 rounded-full font-bold shadow-xl flex items-center gap-2 transform hover:scale-105 transition-all">
                        <Maximize2 size={16} className="text-gold-600" /> Open Sampler
                     </button>
                 </div>
             )}
         </div>
         
         {sampledColor && (
             <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                 <span className="text-xs font-bold text-gray-500 uppercase">Selected Pigment</span>
                 <div className="flex items-center gap-2">
                     <span className="font-mono font-bold text-navy-900">{sampledColor.toUpperCase()}</span>
                     <div className="w-6 h-6 rounded border border-gray-200 shadow-sm" style={{ backgroundColor: sampledColor }} />
                 </div>
             </div>
         )}
      </div>

      {/* 2. FULL SCREEN CAMERA OVERLAY */}
      {viewMode === 'camera' && (
          <div className="fixed inset-0 z-[100] bg-black">
              {/* Tap to Focus Area */}
              <div 
                  className="absolute inset-0 z-0 cursor-crosshair"
                  onClick={handleTapFocus}
              >
                  {/* Video Feed */}
                  <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      className="w-full h-full object-cover"
                      onCanPlay={() => {
                          if (videoRef.current) videoRef.current.play().catch(e => console.log(e));
                      }}
                  />
                  
                  {/* Focus Reticle Animation */}
                  {isFocusing && (
                      <div 
                          className="absolute w-16 h-16 border-2 border-gold-400 rounded-full animate-ping pointer-events-none"
                          style={{ 
                              left: focusPos.x, 
                              top: focusPos.y, 
                              transform: 'translate(-50%, -50%)',
                              boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)'
                          }} 
                      />
                  )}
                  {isFocusing && (
                      <div 
                          className="absolute w-2 h-2 bg-gold-500 rounded-full pointer-events-none"
                          style={{ 
                              left: focusPos.x, 
                              top: focusPos.y, 
                              transform: 'translate(-50%, -50%)' 
                          }} 
                      />
                  )}
              </div>

              {/* Controls Layer */}
              <div className="absolute inset-0 flex flex-col justify-between z-10 pointer-events-none">
                  
                  {/* Top Bar */}
                  <div className="bg-gradient-to-b from-black/80 to-transparent p-6 flex justify-between items-start pointer-events-auto">
                      <button onClick={stopCamera} className="text-white p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 transition-all">
                          <X size={24} />
                      </button>
                      
                      <button 
                        onClick={toggleCalibration}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm backdrop-blur transition-all ${isCalibrating ? 'bg-gold-500 text-navy-900' : 'bg-black/50 text-white border border-white/20'}`}
                      >
                          <Target size={16} />
                          {isCalibrating ? 'Calibration ON' : 'Calibrate'}
                      </button>
                  </div>

                  {/* Calibration Hint */}
                  {isCalibrating && (
                      <div className="self-center bg-black/60 backdrop-blur px-4 py-2 rounded-full text-white text-xs font-bold border border-gold-500/50 animate-in fade-in slide-in-from-bottom-4">
                          Include a white reference card in view
                      </div>
                  )}

                  {/* Bottom Bar */}
                  <div className="bg-gradient-to-t from-black/80 to-transparent p-10 flex flex-col items-center justify-end gap-4 pointer-events-auto pb-20">
                      
                      <div className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-2 animate-pulse">
                          Tap screen to focus
                      </div>

                      <button 
                        onClick={capturePhoto}
                        className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] active:scale-95 transition-transform flex items-center justify-center group"
                      >
                          <div className="w-16 h-16 bg-white rounded-full border-2 border-black/10 group-hover:bg-gray-100 transition-colors" />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 3. FULL SCREEN SAMPLER OVERLAY */}
      {viewMode === 'sampler' && (
          <div className="fixed inset-0 z-[100] bg-navy-900 flex flex-col animate-in fade-in">
              {/* Header */}
              <div className={`p-4 flex justify-between items-center z-10 shadow-md ${calibrationStep === 'pick_white' ? 'bg-gold-500 text-navy-900' : 'bg-navy-900 text-white border-b border-white/10'}`}>
                   <h3 className="font-bold flex items-center gap-2">
                       {calibrationStep === 'pick_white' ? (
                           <>
                             <Target className="animate-pulse" /> Tap White Card
                           </>
                       ) : (
                           <>
                             <Pipette className="text-gold-500" /> Sample Color
                           </>
                       )}
                   </h3>
                   
                   <div className="flex items-center gap-4">
                       {/* Selected Color Preview in Sampler View */}
                       {sampledColor && calibrationStep !== 'pick_white' && (
                           <div className="flex items-center gap-3 mr-2 animate-in slide-in-from-right-4 fade-in">
                                <div className="text-right hidden sm:block">
                                    <div className="text-[10px] font-bold uppercase opacity-70 leading-none text-gray-400">Selected</div>
                                    <div className="font-mono font-bold text-sm leading-none">{sampledColor.toUpperCase()}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10" style={{ backgroundColor: sampledColor }} />
                           </div>
                       )}

                       {whiteReference && calibrationStep !== 'pick_white' && (
                           <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30 flex items-center gap-1">
                               <Check size={10} /> CALIBRATED
                           </span>
                       )}
                       <button onClick={() => setViewMode('idle')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                           <Check size={24} />
                       </button>
                   </div>
              </div>

              {/* Canvas Area */}
              <div className="flex-grow relative bg-black overflow-hidden touch-none flex items-center justify-center cursor-crosshair">
                   <canvas 
                       ref={samplerCanvasRef}
                       className="max-w-full max-h-full object-contain"
                       onPointerDown={handlePointer}
                       onPointerMove={handlePointer}
                       onPointerUp={handlePointer}
                       onPointerLeave={handlePointer}
                   />

                   {/* Loupe */}
                   {loupe && (
                       <div 
                         className="fixed pointer-events-none z-50 rounded-full overflow-hidden border-4 shadow-2xl flex items-center justify-center"
                         style={{
                             width: 120, height: 120,
                             left: loupe.x, top: loupe.y - 80,
                             transform: 'translate(-50%, -50%)',
                             backgroundColor: loupe.color,
                             borderColor: calibrationStep === 'pick_white' ? '#0B1F44' : '#fff'
                         }}
                       >
                           {/* Crosshair */}
                           <div className="absolute inset-0 flex items-center justify-center opacity-50">
                               <div className="w-full h-0.5 bg-white/50 absolute" />
                               <div className="h-full w-0.5 bg-white/50 absolute" />
                           </div>
                           {/* Hex Label */}
                           <div className="mt-16 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-white text-[10px] font-mono">
                               {loupe.color.toUpperCase()}
                           </div>
                       </div>
                   )}
              </div>

              {/* Footer Instruction */}
              <div className={`p-3 text-center text-xs font-bold uppercase tracking-widest ${calibrationStep === 'pick_white' ? 'bg-gold-600 text-navy-900' : 'bg-navy-900 text-gray-500 border-t border-white/5'}`}>
                  {calibrationStep === 'pick_white' 
                    ? "Tap the white reference object in the image" 
                    : "Drag to explore • Release to select pigment"}
              </div>
          </div>
      )}

      {/* 4. CALIBRATION INFO MODAL */}
      {showCalibInfo && (
          <div className="fixed inset-0 z-[200] bg-navy-900/80 backdrop-blur flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95">
                  <div className="bg-gold-50 p-6 flex flex-col items-center text-center border-b border-gold-100">
                      <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                          <Target className="text-gold-600" size={24} />
                      </div>
                      <h3 className="text-lg font-serif font-bold text-navy-900">Calibrate White Balance</h3>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4">
                          Place a white card (e.g., printer paper) in your shot. After taking the photo, you will be asked to tap it to neutralize lighting colors.
                      </p>
                      <label className="flex items-center gap-2 text-xs text-gray-500 mb-6 cursor-pointer">
                          <input type="checkbox" id="dontShow" className="rounded text-navy-900 focus:ring-gold-500" />
                          <span>Don't show this again</span>
                      </label>
                      <div className="flex gap-3">
                          <button onClick={() => setShowCalibInfo(false)} className="flex-1 py-2 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                          <button 
                            onClick={() => {
                                const cb = document.getElementById('dontShow') as HTMLInputElement;
                                confirmCalibInfo(cb?.checked);
                            }}
                            className="flex-1 py-2 bg-navy-900 text-white font-bold rounded-lg hover:bg-navy-800"
                          >
                              Enable
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default ColorCanvas;