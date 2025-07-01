import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  language: 'ar' | 'en';
  processingTime: number;
}

export class OCRService {
  private static instance: OCRService;
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing OCR service...');
      this.worker = await Tesseract.createWorker('ara+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_char_whitelist: '',
        preserve_interword_spaces: '1',
      });

      this.isInitialized = true;
      console.log('OCR service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw new Error('OCR initialization failed');
    }
  }

  public async recognizeText(
    imageData: ImageData | HTMLCanvasElement | string,
    options: {
      language?: 'ar' | 'en' | 'auto';
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<OCRResult> {
    if (!this.worker || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('OCR worker not available');
    }

    const startTime = Date.now();
    const { language = 'auto', onProgress } = options;

    try {
      // Set language for recognition
      let tesseractLang = 'ara+eng'; // Default to both Arabic and English
      if (language === 'ar') {
        tesseractLang = 'ara';
      } else if (language === 'en') {
        tesseractLang = 'eng';
      }

      await this.worker.reinitialize(tesseractLang);

      const { data } = await this.worker.recognize(imageData, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(m.progress);
          }
        }
      });

      const processingTime = Date.now() - startTime;
      const detectedLanguage = this.detectLanguage(data.text);

      console.log(`OCR completed in ${processingTime}ms with confidence ${data.confidence}%`);
      console.log(`Detected language: ${detectedLanguage}`);
      console.log(`Extracted text length: ${data.text.length} characters`);

      return {
        text: data.text.trim(),
        confidence: data.confidence,
        language: detectedLanguage,
        processingTime
      };
    } catch (error) {
      console.error('OCR recognition failed:', error);
      throw new Error(`OCR recognition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async recognizeFromFile(
    file: File,
    options: {
      language?: 'ar' | 'en' | 'auto';
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<OCRResult> {
    // Convert file to image data
    const imageData = await this.fileToImageData(file);
    return this.recognizeText(imageData, options);
  }

  public async recognizeFromPDF(
    pdfArrayBuffer: ArrayBuffer,
    options: {
      language?: 'ar' | 'en' | 'auto';
      onProgress?: (progress: number) => void;
      maxPages?: number;
    } = {}
  ): Promise<OCRResult> {
    const { maxPages = 10, onProgress } = options;
    
    try {
      // Convert PDF pages to images and run OCR
      const images = await this.pdfToImages(pdfArrayBuffer, maxPages);
      let combinedText = '';
      let totalConfidence = 0;
      let detectedLanguage: 'ar' | 'en' = 'en';
      const startTime = Date.now();

      for (let i = 0; i < images.length; i++) {
        if (onProgress) {
          onProgress((i / images.length) * 0.9); // Reserve 10% for final processing
        }

        const result = await this.recognizeText(images[i], {
          language: options.language,
          onProgress: undefined // Don't pass nested progress
        });

        combinedText += result.text + '\n\n';
        totalConfidence += result.confidence;
        
        // Use the language with highest confidence
        if (result.confidence > 50) {
          detectedLanguage = result.language;
        }
      }

      if (onProgress) {
        onProgress(1.0);
      }

      const averageConfidence = images.length > 0 ? totalConfidence / images.length : 0;
      const processingTime = Date.now() - startTime;

      return {
        text: combinedText.trim(),
        confidence: averageConfidence,
        language: detectedLanguage,
        processingTime
      };
    } catch (error) {
      console.error('PDF OCR failed:', error);
      throw new Error(`PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fileToImageData(file: File): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private async pdfToImages(
    pdfArrayBuffer: ArrayBuffer, 
    maxPages: number = 10
  ): Promise<HTMLCanvasElement[]> {
    // For now, we'll implement a basic PDF to image conversion
    // In a production environment, you might want to use pdf.js or similar
    const images: HTMLCanvasElement[] = [];
    
    try {
      // This is a simplified approach - in reality, you'd use pdf.js
      // For now, we'll try to extract any embedded images from the PDF
      const uint8Array = new Uint8Array(pdfArrayBuffer);
      const pdfText = new TextDecoder('latin1').decode(uint8Array);
      
      // Look for JPEG images in the PDF
      const jpegMatches = pdfText.match(/\xFF\xD8\xFF[\s\S]*?\xFF\xD9/g);
      
      if (jpegMatches && jpegMatches.length > 0) {
        for (let i = 0; i < Math.min(jpegMatches.length, maxPages); i++) {
          try {
            const jpegData = jpegMatches[i];
            const blob = new Blob([jpegData], { type: 'image/jpeg' });
            const canvas = await this.blobToCanvas(blob);
            images.push(canvas);
          } catch (error) {
            console.warn(`Failed to process embedded image ${i}:`, error);
          }
        }
      }
      
      // If no images found, create a placeholder indicating OCR is needed
      if (images.length === 0) {
        console.log('No embedded images found in PDF - document may need external PDF-to-image conversion');
        // Return empty array to indicate OCR couldn't process this PDF
      }
      
      return images;
    } catch (error) {
      console.error('PDF to images conversion failed:', error);
      return [];
    }
  }

  private async blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };

      img.onerror = () => reject(new Error('Failed to load image from blob'));
      img.src = URL.createObjectURL(blob);
    });
  }

  private detectLanguage(text: string): 'ar' | 'en' {
    // Enhanced language detection
    const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
    const englishChars = text.match(/[a-zA-Z]/g);
    
    const arabicCount = arabicChars ? arabicChars.length : 0;
    const englishCount = englishChars ? englishChars.length : 0;
    
    // If more than 30% Arabic characters, consider it Arabic
    const totalLetters = arabicCount + englishCount;
    if (totalLetters > 0 && arabicCount / totalLetters > 0.3) {
      return 'ar';
    }
    
    return 'en';
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('OCR service terminated');
    }
  }
}

// Singleton instance
export const ocrService = OCRService.getInstance();