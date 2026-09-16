import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

export interface ImageDecodeResult {
  rawText: string;
  source: 'native' | 'zxing' | 'ai';
  extraData?: any;
}

/**
 * Carrega um File de imagem em um HTMLImageElement
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Falha ao carregar os dados da imagem.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Cria um canvas redimensionado com limites de largura/altura
 */
function createScaledCanvas(
  img: HTMLImageElement,
  maxDimension: number,
  cropCenterRatio?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  let srcX = 0;
  let srcY = 0;
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  if (cropCenterRatio && cropCenterRatio > 0 && cropCenterRatio < 1) {
    const cropW = srcW * cropCenterRatio;
    const cropH = srcH * cropCenterRatio;
    srcX = (srcW - cropW) / 2;
    srcY = (srcH - cropH) / 2;
    srcW = cropW;
    srcH = cropH;
  }

  let targetW = srcW;
  let targetH = srcH;

  if (srcW > maxDimension || srcH > maxDimension) {
    if (srcW >= srcH) {
      targetW = maxDimension;
      targetH = Math.round((srcH / srcW) * maxDimension);
    } else {
      targetH = maxDimension;
      targetW = Math.round((srcW / srcH) * maxDimension);
    }
  }

  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
  }
  return canvas;
}

/**
 * Inverte as cores de um canvas (para códigos Data Matrix gravados em relevo ou peças escuras)
 */
function invertCanvasColors(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const inverted = document.createElement('canvas');
  inverted.width = canvas.width;
  inverted.height = canvas.height;
  const ctx = inverted.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];         // R
    d[i + 1] = 255 - d[i + 1]; // G
    d[i + 2] = 255 - d[i + 2]; // B
  }
  ctx.putImageData(imgData, 0, 0);
  return inverted;
}

/**
 * Aplica alto contraste e escala de cinza
 */
function contrastCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const dest = document.createElement('canvas');
  dest.width = canvas.width;
  dest.height = canvas.height;
  const ctx = dest.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Luminância
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contraste acentuado
    const val = gray > 128 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
  return dest;
}

/**
 * Executa a decodificação multi-camada:
 * 1. BarcodeDetector nativo do navegador (se suportado)
 * 2. Canvas otimizado em múltiplos passos com ZXing
 * 3. Fallback para Inteligência Visual Gemini (/api/scan-datamatrix-image)
 */
export async function decodeBarcodeFromImageFile(
  file: File,
  onProgress?: (step: string) => void
): Promise<ImageDecodeResult> {
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
  const zxingReader = new BrowserMultiFormatReader(hints);

  let loadedImg: HTMLImageElement | null = null;
  try {
    loadedImg = await loadImageFromFile(file);
  } catch (err: any) {
    console.warn('Falha ao instanciar elemento de imagem:', err);
  }

  // =========================================================================
  // Camada 1: BarcodeDetector Nativo (Chrome / Android / iOS moderno)
  // =========================================================================
  if (loadedImg && 'BarcodeDetector' in window) {
    try {
      onProgress?.('Verificando leitor acelerado por hardware...');
      const detector = new (window as any).BarcodeDetector({
        formats: ['data_matrix', 'qr_code', 'aztec', 'code_128', 'ean_13'],
      });
      const results = await detector.detect(loadedImg);
      if (results && results.length > 0 && results[0].rawValue) {
        return {
          rawText: results[0].rawValue,
          source: 'native',
        };
      }
    } catch (nativeErr) {
      console.warn('BarcodeDetector nativo falhou ou formato não suportado:', nativeErr);
    }
  }

  // =========================================================================
  // Camada 2: Multi-Pass Canvas com ZXing (redimensionamento + contraste + negativo)
  // =========================================================================
  if (loadedImg) {
    onProgress?.('Processando filtros ópticos e escala...');
    const passes: { name: string; canvas: HTMLCanvasElement }[] = [];

    // Pass 1: Redimensionado para 1200px (tamanho ideal para decodificadores 2D)
    const canvas1200 = createScaledCanvas(loadedImg, 1200);
    passes.push({ name: 'scaled-1200', canvas: canvas1200 });

    // Pass 2: Inversão de cores (peças cerâmicas escuras ou telas invertidas)
    const invertedCanvas = invertCanvasColors(canvas1200);
    passes.push({ name: 'inverted', canvas: invertedCanvas });

    // Pass 3: Alto contraste
    const contrastCanvasObj = contrastCanvas(canvas1200);
    passes.push({ name: 'contrast', canvas: contrastCanvasObj });

    // Pass 4: Escala média (800px)
    const canvas800 = createScaledCanvas(loadedImg, 800);
    passes.push({ name: 'scaled-800', canvas: canvas800 });

    // Pass 5: Recorte central (foco na área do código)
    const centerCrop = createScaledCanvas(loadedImg, 1000, 0.65);
    passes.push({ name: 'center-crop', canvas: centerCrop });

    for (const pass of passes) {
      try {
        const dataUrl = pass.canvas.toDataURL('image/png');
        const result = await zxingReader.decodeFromImageUrl(dataUrl);
        if (result && result.getText()) {
          return {
            rawText: result.getText(),
            source: 'zxing',
          };
        }
      } catch {
        // Tenta o próximo filtro
      }
    }
  }

  // =========================================================================
  // Camada 3: Inteligência Visual Gemini (/api/scan-datamatrix-image)
  // Essencial quando o usuário envia captura de tela (ex: Scandit Demo) ou
  // fotos com texto de etiqueta de palete onde o leitor óptico puro falha.
  // =========================================================================
  onProgress?.('Analisando etiqueta com Inteligência Visual...');
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Erro na leitura do arquivo'));
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/scan-datamatrix-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: file.type || 'image/jpeg',
      }),
    });

    if (response.ok) {
      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const data = resJson.data;
        const hasAnyField = !!(
          (data.rawCode && String(data.rawCode).trim() && !/^(null|undefined)$/i.test(String(data.rawCode))) ||
          data.gtin ||
          data.lote ||
          data.tom ||
          data.calibre ||
          data.sscc ||
          data.areaM2 ||
          data.quantidade
        );
        if (hasAnyField) {
          const raw = data.rawCode || JSON.stringify(data);
          return {
            rawText: raw,
            source: 'ai',
            extraData: data,
          };
        }
      }
    }
  } catch (aiErr: any) {
    console.warn('Fallback de Inteligência Visual falhou:', aiErr);
  }

  throw new Error('Nenhum código Data Matrix ou etiqueta legível detectado nesta imagem.');
}
