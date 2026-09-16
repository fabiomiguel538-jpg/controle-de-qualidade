import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Camera, 
  RefreshCw, 
  Upload, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Calendar, 
  Layers, 
  Tag, 
  Zap, 
  ZapOff,
  Copy,
  ScanLine,
  Box,
  Maximize2,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Barcode
} from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { parseDataMatrixCode, ParsedDataMatrix, GS1ParsedField } from '../lib/dataMatrixParser';
import { decodeBarcodeFromImageFile } from '../lib/imageBarcodeScanner';

export interface DataMatrixScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (parsed: ParsedDataMatrix, options?: {
    applyDate?: boolean;
    applyLot?: boolean;
    applyShade?: boolean;
    applyCalibre?: boolean;
    applyMetrics?: boolean;
  }) => void;
  currentDate?: string;
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  reportContext?: {
    shift?: string;
    line?: string;
    reportId?: string;
    lot?: string;
    tone?: string;
    reference?: string;
  };
}

export const DataMatrixScannerModal: React.FC<DataMatrixScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  currentDate,
  title,
  subtitle,
  badgeLabel,
  reportContext,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ParsedDataMatrix | null>(null);
  const [applied, setApplied] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [showManual, setShowManual] = useState<boolean>(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
  const [analyzingStep, setAnalyzingStep] = useState<string>('');

  // Seleções do que aplicar ao relatório
  const [applyOptions, setApplyOptions] = useState({
    applyDate: true,
    applyLot: true,
    applyShade: true,
    applyCalibre: true,
    applyMetrics: true,
  });

  // Som de confirmação via Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // AudioContext restrito
    }
    if (navigator.vibrate) {
      try {
        navigator.vibrate(120);
      } catch {
        // ignorar
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      setScanResult(null);
      setApplied(false);
      setErrorMessage(null);
      return;
    }

    startCamera();

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const stopScanning = () => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // ignorar
      }
      readerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignorar
        }
      });
      streamRef.current = null;
    }

    setIsScanning(false);
    setIsTorchOn(false);
  };

  const startCamera = async (deviceId?: string) => {
    setErrorMessage(null);
    stopScanning();

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.AZTEC,
        BarcodeFormat.PDF_417,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const codeReader = new BrowserMultiFormatReader(hints);
      readerRef.current = codeReader;

      let videoDevices: MediaDeviceInfo[] = [];
      try {
        videoDevices = await codeReader.listVideoInputDevices();
        setCameras(videoDevices);
      } catch {
        // Ignora
      }

      let targetDeviceId = deviceId || selectedDeviceId;
      if (!targetDeviceId && videoDevices.length > 0) {
        const backCam = videoDevices.find((d) =>
          /back|rear|traseira|ambiente|environment/i.test(d.label)
        );
        targetDeviceId = backCam ? backCam.deviceId : videoDevices[videoDevices.length - 1].deviceId;
        setSelectedDeviceId(targetDeviceId);
      }

      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities?.() || {};
        setHasTorch(!!capabilities.torch);
      }

      setIsScanning(true);

      codeReader.decodeFromVideoDevice(
        targetDeviceId || undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            const raw = result.getText();
            if (raw) {
              handleCodeDetected(raw);
            }
          }
        }
      );
    } catch (err: any) {
      console.error('Erro ao acessar a câmera:', err);
      let msg = 'Não foi possível acessar a câmera do dispositivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permissão de acesso à câmera negada. Ative a câmera no navegador ou utilize o envio de foto/arquivo.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Nenhuma câmera encontrada neste dispositivo.';
      } else if (err.name === 'NotReadableError') {
        msg = 'A câmera está sendo utilizada por outro aplicativo ou aba.';
      }
      setErrorMessage(msg);
      setIsScanning(false);
    }
  };

  const handleCodeDetected = (rawText: string) => {
    if (!rawText || rawText.trim() === '') return;
    playBeep();
    const parsed = parseDataMatrixCode(rawText);
    setScanResult(parsed);
    if (readerRef.current) {
      readerRef.current.reset();
    }
    setIsScanning(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (e) {
      console.warn('Erro ao alternar lanterna:', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsAnalyzingImage(true);
    setAnalyzingStep('Iniciando análise da imagem...');

    try {
      const result = await decodeBarcodeFromImageFile(file, (step) => {
        setAnalyzingStep(step);
      });

      if (result && result.rawText) {
        handleCodeDetected(result.rawText);
      } else {
        setErrorMessage('Nenhum código Data Matrix ou etiqueta legível detectado nesta imagem.');
      }
    } catch (err: any) {
      console.warn('Falha ao decodificar imagem:', err);
      setErrorMessage(
        err?.message || 'Nenhum código Data Matrix detectado na imagem. Tente uma foto mais aproximada ou utilize a digitação manual.'
      );
    } finally {
      setIsAnalyzingImage(false);
      setAnalyzingStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApply = () => {
    if (!scanResult) return;
    onScanComplete(scanResult, applyOptions);
    setApplied(true);
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleResumeScan = () => {
    setScanResult(null);
    setApplied(false);
    startCamera(selectedDeviceId);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCodeDetected(manualInput.trim());
    setManualInput('');
    setShowManual(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // fallback
    }
  };

  const loadScanditExample = () => {
    const example = `0207908482805010240490810000000493772314200021900079084828017406718`;
    handleCodeDetected(example);
    setShowManual(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-matrix-title"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ScanLine size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="data-matrix-title" className="text-sm font-bold text-neutral-100">
                  {title || 'Leitor Data Matrix 2D'}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40">
                  {badgeLabel || 'GS1 DataMatrix'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {subtitle || 'Extração automática de GTIN, Lote, Calibre, Tonalidade, Metragem e SSCC'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar leitor"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo principal do scanner */}
        <div className="relative flex-1 bg-black flex flex-col items-center justify-center min-h-[260px] max-h-[460px] overflow-hidden">
          {/* Vídeo da Câmera */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover max-h-[380px] ${scanResult ? 'opacity-25 filter blur-xs' : 'opacity-100'}`}
          />

          {/* Mira e Retículo de Enquadramento */}
          {!scanResult && !errorMessage && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 border-2 border-dashed border-emerald-400/70 rounded-xl flex items-center justify-center shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Cantoneiras */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md"></div>
                
                {/* Linha laser de leitura animada */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse"></div>

                <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-emerald-300/80 bg-black/70 px-2 py-0.5 rounded">
                  DATA MATRIX 2D
                </span>
              </div>
              <p className="mt-4 text-xs font-medium text-white/90 bg-black/80 px-3 py-1 rounded-full border border-white/10 shadow-lg">
                Aponte para o código quadrado da peça, etiqueta ou palete
              </p>
            </div>
          )}

          {/* Overlay de Análise de Imagem (Canvas + IA) */}
          {isAnalyzingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-neutral-950/92 text-center z-20 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-14 h-14 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-3 shadow-lg">
                <ScanLine size={28} className="text-emerald-400 animate-pulse" />
                <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30 animate-ping pointer-events-none"></div>
              </div>
              <h3 className="text-sm font-bold text-neutral-100 mb-1">Processando Imagem...</h3>
              <p className="text-xs text-emerald-400 font-medium font-mono mb-2">
                {analyzingStep || 'Aplicando filtros ópticos e inteligência visual...'}
              </p>
              <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                Decodificando matriz 2D (GTIN, Lote, Calibre, Tonalidade e SSCC da etiqueta)
              </p>
            </div>
          )}

          {/* Mensagem de Erro / Sem Permissão */}
          {errorMessage && !isAnalyzingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-neutral-950 text-center z-10 animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-3">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-neutral-200 mb-1">
                {/câmera|permissão|dispositivo/i.test(errorMessage)
                  ? 'Câmera indisponível'
                  : 'Não foi possível decodificar a foto'}
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">{errorMessage}</p>
              
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Upload size={14} /> Enviar Outra Foto
                </button>
                <button
                  type="button"
                  onClick={loadScanditExample}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  title="Carregar os dados da etiqueta do aplicativo Scandit Demo"
                >
                  <Barcode size={14} /> Carregar Exemplo (Scandit)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setShowManual(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Digitar Código
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    startCamera(selectedDeviceId);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} /> Ativar Câmera
                </button>
              </div>
            </div>
          )}

          {/* Se lido com sucesso, mostra overlay no vídeo se não estiver com resultado maximizado */}
          {scanResult && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Leitura realizada com sucesso!</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                {scanResult.gs1Fields.length} campos detectados
              </span>
            </div>
          )}
        </div>

        {/* Painel com as Informações Extraídas (Design idêntico e aprimorado ao Scandit Demo) */}
        {scanResult && (
          <div className="bg-neutral-900 border-t border-neutral-800 flex-1 overflow-y-auto max-h-[50vh] p-4 flex flex-col gap-3">
            {/* Header da Leitura */}
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-neutral-800">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-white break-all line-clamp-1">
                    {scanResult.rawText}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(scanResult.rawText, 'raw')}
                    className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-800 transition-colors"
                    title="Copiar texto bruto"
                  >
                    {copiedKey === 'raw' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-400 font-mono tracking-wider">
                    {scanResult.codeType}
                  </span>
                  {scanResult.gs1Fields.length > 0 && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                      {scanResult.gs1Fields.length} Itens Identificados
                    </span>
                  )}
                </div>
              </div>

              {/* Botão Retomar Leitura / Ler Outro */}
              <button
                type="button"
                onClick={handleResumeScan}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw size={13} />
                <span>Ler Outro</span>
              </button>
            </div>

            {/* Lista dos Campos GS1 (Idêntica ao layout da captura Scandit Demo) */}
            <div className="space-y-2">
              {scanResult.gs1Fields.map((field) => (
                <div
                  key={field.ai}
                  className="flex items-start justify-between gap-3 p-2.5 bg-neutral-950/70 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                      <span className="text-emerald-400 font-mono font-black">{field.ai}.</span>
                      <span>{field.titleEn}</span>
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {field.titlePt}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-neutral-100 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                        {field.formattedDisplay}
                      </div>
                      {field.extraMeta?.decimals && (
                        <span className="text-[9px] text-neutral-500 block font-mono">
                          314x: {field.value}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(field.value, field.ai)}
                      className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                      title={`Copiar ${field.label}`}
                    >
                      {copiedKey === field.ai ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Se não for GS1 com múltiplos campos, exibe os campos detectados convencionais */}
              {scanResult.gs1Fields.length === 0 && (
                <div className="p-3 bg-neutral-950/70 rounded-xl border border-neutral-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Data Detectada:</span>
                    <span className="font-bold text-neutral-100">{scanResult.formattedDisplayDate || 'Não encontrada'}</span>
                  </div>
                  {scanResult.detectedShift && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Turno:</span>
                      <span className="font-bold text-neutral-100">{scanResult.detectedShift}</span>
                    </div>
                  )}
                  {scanResult.detectedLot && (
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Lote:</span>
                      <span className="font-bold text-neutral-100">{scanResult.detectedLot}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Opções de Aplicação ao Relatório */}
            <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase text-neutral-400 flex items-center gap-1.5">
                  <SlidersHorizontal size={12} className="text-emerald-400" />
                  Campos a Aplicar no Relatório
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  Preenchimento Automático
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Lote (10) */}
                {scanResult.lot && (
                  <label className="flex items-center gap-2 p-1.5 bg-neutral-900/60 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={applyOptions.applyLot}
                      onChange={(e) => setApplyOptions({ ...applyOptions, applyLot: e.target.checked })}
                      className="rounded text-emerald-500 focus:ring-emerald-400 bg-neutral-950 border-neutral-700"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 block font-medium">Lote (10)</span>
                      <span className="font-bold text-neutral-200 truncate block">{scanResult.lot}</span>
                    </div>
                  </label>
                )}

                {/* Tonalidade (240) */}
                {scanResult.shade && (
                  <label className="flex items-center gap-2 p-1.5 bg-neutral-900/60 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={applyOptions.applyShade}
                      onChange={(e) => setApplyOptions({ ...applyOptions, applyShade: e.target.checked })}
                      className="rounded text-emerald-500 focus:ring-emerald-400 bg-neutral-950 border-neutral-700"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 block font-medium">Tom / Tonalidade (240)</span>
                      <span className="font-bold text-neutral-200 truncate block">{scanResult.shade}</span>
                    </div>
                  </label>
                )}

                {/* Calibre (90) */}
                {scanResult.calibre && (
                  <label className="flex items-center gap-2 p-1.5 bg-neutral-900/60 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-700">
                    <input
                      type="checkbox"
                      checked={applyOptions.applyCalibre}
                      onChange={(e) => setApplyOptions({ ...applyOptions, applyCalibre: e.target.checked })}
                      className="rounded text-emerald-500 focus:ring-emerald-400 bg-neutral-950 border-neutral-700"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] text-emerald-400 block font-medium">Calibre (90)</span>
                      <span className="font-bold text-neutral-200 truncate block">{scanResult.calibre}</span>
                    </div>
                  </label>
                )}

                {/* Data */}
                <label className="flex items-center gap-2 p-1.5 bg-neutral-900/60 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-700">
                  <input
                    type="checkbox"
                    checked={applyOptions.applyDate}
                    onChange={(e) => setApplyOptions({ ...applyOptions, applyDate: e.target.checked })}
                    className="rounded text-emerald-500 focus:ring-emerald-400 bg-neutral-950 border-neutral-700"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] text-neutral-400 block font-medium">Data do Relatório</span>
                    <span className="font-bold text-neutral-200 truncate block">
                      {scanResult.formattedDisplayDate || (currentDate ? currentDate.split('-').reverse().join('/') : 'Data atual')}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Ações Inferiores */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleApply}
                disabled={applied}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                {applied ? (
                  <>
                    <Check size={16} className="stroke-[3]" />
                    <span>Dados Aplicados com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Aplicar Dados ao Relatório</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const fullText = JSON.stringify(scanResult, null, 2);
                  copyToClipboard(fullText, 'full');
                }}
                className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copiar todas as informações"
              >
                {copiedKey === 'full' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>Copiar Tudo</span>
              </button>
            </div>
          </div>
        )}

        {/* Barra de Ferramentas / Controles Inferiores */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-300 shrink-0">
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  startCamera(e.target.value);
                }}
                className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-emerald-500 cursor-pointer"
                title="Selecionar Câmera"
              >
                {cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Câmera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
                title={isTorchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
              >
                {isTorchOn ? <Zap size={14} /> : <ZapOff size={14} />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              title="Ler foto de código Data Matrix salvo"
            >
              <Upload size={12} />
              <span>Foto/Arquivo</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 underline decoration-dotted transition-colors cursor-pointer"
            >
              {showManual ? 'Fechar Digitação' : 'Digitar/Colar'}
            </button>
          </div>
        </div>

        {/* Painel expansível de entrada manual ou teste com exemplo Scandit Demo */}
        {showManual && (
          <form onSubmit={handleManualSubmit} className="p-3 bg-neutral-900 border-t border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Cole o código bruto, texto do Scandit ou formato GS1:</span>
              <button
                type="button"
                onClick={loadScanditExample}
                className="text-emerald-400 hover:text-emerald-300 underline font-semibold"
              >
                Carregar Exemplo da Imagem
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ex: 0207908482805010240490810000000493772314200021900079084828017406718"
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Extrair
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
