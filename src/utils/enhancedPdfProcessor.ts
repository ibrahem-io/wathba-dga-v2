export interface PDFExtractionResult {
  text: string;
  confidence: number;
  method: 'text' | 'ocr' | 'hybrid';
  metadata: {
    totalPages: number;
    extractionTime: number;
    qualityScore: number;
    arabicRatio: number;
  };
}

export interface ExtractionStrategy {
  strategy: 'auto' | 'text' | 'ocr' | 'hybrid';
  qualityThreshold: number;
  maxPages?: number;
}

export class EnhancedPDFProcessor {
  private static instance: EnhancedPDFProcessor;
  private qualityThreshold = 0.7;

  private constructor() {}

  public static getInstance(): EnhancedPDFProcessor {
    if (!EnhancedPDFProcessor.instance) {
      EnhancedPDFProcessor.instance = new EnhancedPDFProcessor();
    }
    return EnhancedPDFProcessor.instance;
  }

  public async extractFromPDF(
    arrayBuffer: ArrayBuffer,
    options: ExtractionStrategy = { strategy: 'auto', qualityThreshold: 0.7 }
  ): Promise<PDFExtractionResult> {
    const startTime = Date.now();
    this.qualityThreshold = options.qualityThreshold;

    console.log(`🔍 Starting PDF extraction with strategy: ${options.strategy}`);

    try {
      switch (options.strategy) {
        case 'auto':
          return await this.autoExtract(arrayBuffer, startTime);
        case 'text':
          return await this.textExtract(arrayBuffer, startTime);
        case 'ocr':
          return await this.ocrExtract(arrayBuffer, startTime, options.maxPages);
        case 'hybrid':
          return await this.hybridExtract(arrayBuffer, startTime, options.maxPages);
        default:
          throw new Error(`Unknown extraction strategy: ${options.strategy}`);
      }
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async autoExtract(arrayBuffer: ArrayBuffer, startTime: number): Promise<PDFExtractionResult> {
    console.log('📄 Attempting text extraction first...');
    
    try {
      // First try text extraction
      const textResult = await this.textExtract(arrayBuffer, startTime);
      
      if (this.assessTextQuality(textResult.text)) {
        console.log('✅ Text extraction successful (high quality)');
        return textResult;
      }
      
      console.log('⚠️ Text extraction quality insufficient, trying OCR...');
    } catch (error) {
      console.log('❌ Text extraction failed, falling back to OCR...');
    }

    // Fallback to OCR
    try {
      const ocrResult = await this.ocrExtract(arrayBuffer, startTime);
      console.log('📷 OCR extraction completed');
      return ocrResult;
    } catch (error) {
      console.log('❌ OCR failed, trying hybrid approach...');
    }

    // Last resort: hybrid
    try {
      const hybridResult = await this.hybridExtract(arrayBuffer, startTime);
      console.log('🔄 Hybrid extraction completed');
      return hybridResult;
    } catch (error) {
      throw new Error('All extraction methods failed');
    }
  }

  private async textExtract(arrayBuffer: ArrayBuffer, startTime: number): Promise<PDFExtractionResult> {
    const extractedText = await this.extractPDFTextAdvanced(arrayBuffer);
    const cleanedText = this.cleanArabicText(extractedText);
    
    if (!cleanedText || cleanedText.length < 50) {
      throw new Error('Insufficient text content extracted');
    }

    const qualityScore = this.calculateTextScore(cleanedText);
    const arabicRatio = this.calculateArabicRatio(cleanedText);

    return {
      text: cleanedText,
      confidence: qualityScore,
      method: 'text',
      metadata: {
        totalPages: this.estimatePageCount(arrayBuffer),
        extractionTime: Date.now() - startTime,
        qualityScore,
        arabicRatio
      }
    };
  }

  private async ocrExtract(arrayBuffer: ArrayBuffer, startTime: number, maxPages = 10): Promise<PDFExtractionResult> {
    // Import OCR service dynamically
    const { ocrService } = await import('./ocrService');
    
    const ocrResult = await ocrService.recognizeFromPDF(arrayBuffer, {
      language: 'auto',
      maxPages,
      onProgress: (progress) => {
        console.log(`OCR Progress: ${Math.round(progress * 100)}%`);
      }
    });

    const cleanedText = this.cleanArabicText(ocrResult.text);
    const postProcessedText = this.postProcessOCRText(cleanedText);
    
    if (!postProcessedText || postProcessedText.length < 50) {
      throw new Error('OCR extracted insufficient text content');
    }

    const qualityScore = Math.min(ocrResult.confidence / 100, 0.95); // OCR confidence is 0-100
    const arabicRatio = this.calculateArabicRatio(postProcessedText);

    return {
      text: postProcessedText,
      confidence: qualityScore,
      method: 'ocr',
      metadata: {
        totalPages: this.estimatePageCount(arrayBuffer),
        extractionTime: Date.now() - startTime,
        qualityScore,
        arabicRatio
      }
    };
  }

  private async hybridExtract(arrayBuffer: ArrayBuffer, startTime: number, maxPages = 10): Promise<PDFExtractionResult> {
    let textResult: PDFExtractionResult | null = null;
    let ocrResult: PDFExtractionResult | null = null;

    // Try both methods
    try {
      textResult = await this.textExtract(arrayBuffer, startTime);
    } catch (error) {
      console.log('Text extraction failed in hybrid mode:', error);
    }

    try {
      ocrResult = await this.ocrExtract(arrayBuffer, startTime, maxPages);
    } catch (error) {
      console.log('OCR extraction failed in hybrid mode:', error);
    }

    // Choose the best result
    if (!textResult && !ocrResult) {
      throw new Error('Both text and OCR extraction failed');
    }

    if (!textResult) return ocrResult!;
    if (!ocrResult) return textResult;

    // Compare quality and choose the better one
    const textQuality = textResult.confidence;
    const ocrQuality = ocrResult.confidence;

    const chosenResult = textQuality >= ocrQuality ? textResult : ocrResult;
    
    return {
      ...chosenResult,
      method: 'hybrid',
      metadata: {
        ...chosenResult.metadata,
        extractionTime: Date.now() - startTime
      }
    };
  }

  private async extractPDFTextAdvanced(arrayBuffer: ArrayBuffer): Promise<string> {
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
    
    let extractedText = '';

    // Method 1: Enhanced BT/ET text object extraction
    extractedText = this.extractFromTextObjects(text);
    
    // Method 2: Stream object extraction if Method 1 insufficient
    if (extractedText.length < 100) {
      extractedText += this.extractFromStreams(text);
    }

    // Method 3: Font-based text extraction
    if (extractedText.length < 100) {
      extractedText += this.extractFromFontObjects(text);
    }

    // Method 4: Unicode text extraction
    if (extractedText.length < 50) {
      extractedText += this.extractUnicodeText(text);
    }

    console.log(`Advanced PDF extraction: ${extractedText.length} characters extracted`);
    return extractedText;
  }

  private extractFromTextObjects(pdfText: string): string {
    let extractedText = '';

    // Enhanced BT/ET extraction with better Arabic support
    const textObjectMatches = pdfText.match(/BT\s*(.*?)\s*ET/gs);
    if (textObjectMatches) {
      for (const match of textObjectMatches) {
        // Extract from Tj operators
        const tjMatches = match.match(/\((.*?)\)\s*Tj/g);
        if (tjMatches) {
          for (const tjMatch of tjMatches) {
            const textContent = tjMatch.match(/\((.*?)\)/);
            if (textContent && textContent[1]) {
              extractedText += this.decodePDFString(textContent[1]) + ' ';
            }
          }
        }

        // Extract from TJ arrays (better for Arabic)
        const tjArrayMatches = match.match(/\[(.*?)\]\s*TJ/g);
        if (tjArrayMatches) {
          for (const tjArrayMatch of tjArrayMatches) {
            const arrayContent = tjArrayMatch.match(/\[(.*?)\]/);
            if (arrayContent && arrayContent[1]) {
              const strings = arrayContent[1].match(/\((.*?)\)/g);
              if (strings) {
                for (const str of strings) {
                  const content = str.match(/\((.*?)\)/);
                  if (content && content[1]) {
                    extractedText += this.decodePDFString(content[1]) + ' ';
                  }
                }
              }
            }
          }
        }
      }
    }

    return extractedText;
  }

  private extractFromStreams(pdfText: string): string {
    let extractedText = '';

    const streamMatches = pdfText.match(/stream\s*(.*?)\s*endstream/gs);
    if (streamMatches) {
      for (const match of streamMatches) {
        const streamContent = match.replace(/stream\s*|\s*endstream/g, '');
        
        // Look for Arabic and English text patterns
        const readableText = streamContent.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F][a-zA-Z\u0600-\u06FF\u0750-\u077F\s\d.,!?;:()]{2,}/g);
        if (readableText) {
          extractedText += readableText.join(' ') + ' ';
        }
      }
    }

    return extractedText;
  }

  private extractFromFontObjects(pdfText: string): string {
    let extractedText = '';

    // Look for font definitions and associated text
    const fontMatches = pdfText.match(/\/Font\s*<<.*?>>/gs);
    if (fontMatches) {
      // Extract text near font definitions
      for (const fontMatch of fontMatches) {
        const fontIndex = pdfText.indexOf(fontMatch);
        const surroundingText = pdfText.substring(
          Math.max(0, fontIndex - 1000),
          Math.min(pdfText.length, fontIndex + 1000)
        );
        
        const textMatches = surroundingText.match(/\((.*?)\)/g);
        if (textMatches) {
          for (const textMatch of textMatches) {
            const content = textMatch.match(/\((.*?)\)/);
            if (content && content[1] && content[1].length > 2) {
              extractedText += this.decodePDFString(content[1]) + ' ';
            }
          }
        }
      }
    }

    return extractedText;
  }

  private extractUnicodeText(pdfText: string): string {
    let extractedText = '';

    // Look for Unicode escape sequences
    const unicodeMatches = pdfText.match(/\\u[0-9a-fA-F]{4}/g);
    if (unicodeMatches) {
      for (const match of unicodeMatches) {
        const codePoint = parseInt(match.substring(2), 16);
        if (codePoint >= 0x0600 && codePoint <= 0x06FF) { // Arabic block
          extractedText += String.fromCharCode(codePoint);
        }
      }
    }

    // Look for direct Arabic characters
    const arabicMatches = pdfText.match(/[\u0600-\u06FF\u0750-\u077F]+/g);
    if (arabicMatches) {
      extractedText += arabicMatches.join(' ') + ' ';
    }

    return extractedText;
  }

  private decodePDFString(pdfString: string): string {
    // Handle PDF string encoding
    let decoded = pdfString;

    // Handle octal escape sequences
    decoded = decoded.replace(/\\([0-7]{1,3})/g, (match, octal) => {
      return String.fromCharCode(parseInt(octal, 8));
    });

    // Handle hex escape sequences
    decoded = decoded.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // Handle Unicode escape sequences
    decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (match, unicode) => {
      return String.fromCharCode(parseInt(unicode, 16));
    });

    // Handle common escape sequences
    decoded = decoded.replace(/\\n/g, '\n');
    decoded = decoded.replace(/\\r/g, '\r');
    decoded = decoded.replace(/\\t/g, '\t');
    decoded = decoded.replace(/\\\\/g, '\\');
    decoded = decoded.replace(/\\'/g, "'");
    decoded = decoded.replace(/\\"/g, '"');

    return decoded;
  }

  private cleanArabicText(text: string): string {
    if (!text) return '';

    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ');

    // Normalize Arabic characters
    text = text.replace(/[إأآ]/g, 'ا'); // Normalize Alef
    text = text.replace(/[ىي]/g, 'ي');   // Normalize Yeh
    text = text.replace(/ة/g, 'ه');      // Common OCR confusion

    // Remove diacritics (optional for better matching)
    text = text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');

    // Remove non-printable characters
    text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Fix common spacing issues
    text = text.replace(/(\d+)/g, ' $1 '); // Space around numbers
    text = text.replace(/\s+/g, ' ');      // Normalize spaces again

    // Remove lines with mostly symbols or artifacts
    const lines = text.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 3) return false;
      
      const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
      const englishChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
      const totalLetters = arabicChars + englishChars;
      
      // Keep lines with meaningful content
      return totalLetters > trimmed.length * 0.3;
    });

    return cleanedLines.join('\n').trim();
  }

  private postProcessOCRText(text: string): string {
    if (!text) return '';

    // Additional OCR-specific cleaning
    const lines = text.split('\n');
    const cleanedLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 3) continue;

      // Check if line has meaningful Arabic content
      const arabicChars = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = trimmed.replace(/\s/g, '').length;

      if (totalChars > 0 && (arabicChars / totalChars) > 0.2) {
        cleanedLines.push(trimmed);
      } else if (trimmed.match(/[a-zA-Z]{3,}/)) {
        // Keep English lines with meaningful words
        cleanedLines.push(trimmed);
      }
    }

    return cleanedLines.join('\n');
  }

  private assessTextQuality(text: string): boolean {
    if (!text || text.length < 50) return false;
    
    const score = this.calculateTextScore(text);
    return score >= this.qualityThreshold;
  }

  private calculateTextScore(text: string): number {
    if (!text || text.length < 50) return 0.0;

    let score = 0.0;

    // Length bonus (up to 0.3)
    score += Math.min(text.length / 500, 0.3);

    // Arabic content ratio (up to 0.4)
    const arabicRatio = this.calculateArabicRatio(text);
    score += arabicRatio * 0.4;

    // Word coherence (up to 0.3)
    const arabicWords = (text.match(/[\u0600-\u06FF]{3,}/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]{3,}/g) || []).length;
    const totalWords = arabicWords + englishWords;
    const wordScore = Math.min(totalWords / 20, 0.3);
    score += wordScore;

    return Math.min(score, 1.0);
  }

  private calculateArabicRatio(text: string): number {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    return totalChars > 0 ? arabicChars / totalChars : 0;
  }

  private estimatePageCount(arrayBuffer: ArrayBuffer): number {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  }
}

// Singleton instance
export const enhancedPdfProcessor = EnhancedPDFProcessor.getInstance();