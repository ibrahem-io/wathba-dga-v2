import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { fileToBase64 } from '../utils/fileUtils';
import { extractTextFromImageWithVision } from '../services/openaiService';
import * as pdfjsLib from 'pdfjs-dist';

interface DocumentParserInput {
  file: File;
}

export class DocumentParserAgent extends BaseAgent {
  protected async onInitialize(): Promise<void> {
    console.log(`Document Parser Agent ${this.config.id} initialized`);
    
    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }

  protected async onExecute(input: DocumentParserInput): Promise<DocumentMetadata> {
    const { file } = input;

    try {
      console.log(`🔍 Starting document processing for: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})`);

      // Determine file type and use appropriate extraction method
      const fileType = this.getFileType(file);
      
      let extractedText = '';
      let base64Image: string | undefined;
      let confidence = 90;
      let language: 'ar' | 'en' = 'ar'; // Default to Arabic for Saudi context
      let isVisualDocument = false;

      if (fileType === 'pdf') {
        console.log(`📄 Processing PDF file: ${file.name}`);
        extractedText = await this.extractTextFromPDF(file);
        confidence = this.calculatePDFExtractionConfidence(extractedText, file);
        isVisualDocument = false;
      } else if (fileType === 'image') {
        console.log(`📷 Processing image file: ${file.name}`);
        base64Image = await fileToBase64(file);
        extractedText = await extractTextFromImageWithVision(base64Image, language);
        confidence = this.calculateExtractionConfidence(extractedText, file, language);
        isVisualDocument = true;
      } else {
        throw new Error(`Unsupported file type: ${file.type}. Please upload PDF files or image files (PNG, JPEG, GIF, WebP).`);
      }

      if (extractedText && extractedText.trim().length > 0) {
        console.log(`✅ Text extraction successful: ${extractedText.length} characters`);
        
        // Detect language from extracted text
        language = this.detectLanguage(extractedText);
        
        console.log(`🌐 Language detected: ${language}`);
        console.log(`📊 Extraction confidence: ${confidence}%`);
      } else {
        throw new Error(`No text could be extracted from "${file.name}". The file may be empty, corrupted, or contain only images without text.`);
      }

      // Calculate word count
      const wordCount = this.calculateWordCount(extractedText, language);

      const metadata: DocumentMetadata = {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        language,
        extractedText: extractedText.substring(0, 50000), // Limit text size
        wordCount,
        confidence,
        base64Image,
        isVisualDocument
      };

      console.log(`✅ Document processed successfully: ${file.name}
        - Type: ${file.type}
        - Language: ${language}
        - Words: ${wordCount}
        - Confidence: ${confidence}%
        - Text length: ${extractedText.length} characters`);
      
      return metadata;

    } catch (error) {
      console.error(`❌ Document processing failed for ${file.name}:`, error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to process document';
      
      if (error instanceof Error) {
        if (error.message.includes('unsupported image') || error.message.includes('invalid_image_format')) {
          errorMessage = `File format not supported by Vision API. Please convert "${file.name}" to PNG, JPEG, GIF, or WebP format and try again.`;
        } else if (error.message.includes('Unsupported file type')) {
          errorMessage = error.message;
        } else if (error.message.includes('No text could be extracted')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Processing failed for "${file.name}": ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  private getFileType(file: File): 'pdf' | 'image' | 'unsupported' {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    // Check for PDF
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'pdf';
    }

    // Check for supported image formats
    const supportedImageTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp'
    ];

    if (supportedImageTypes.includes(mimeType) || 
        fileName.match(/\.(png|jpe?g|gif|webp)$/)) {
      return 'image';
    }

    return 'unsupported';
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      
      console.log(`📄 PDF has ${numPages} pages`);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          if (pageText.trim()) {
            fullText += pageText + '\n\n';
            console.log(`📄 Extracted text from page ${pageNum}: ${pageText.length} characters`);
          }
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract text from page ${pageNum}:`, pageError);
          // Continue with other pages
        }
      }

      if (!fullText.trim()) {
        throw new Error('PDF appears to contain no extractable text. It may be a scanned document or contain only images.');
      }

      return fullText.trim();
    } catch (error) {
      console.error('❌ PDF text extraction failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('The uploaded file is not a valid PDF document.');
        } else if (error.message.includes('no extractable text')) {
          throw error; // Re-throw our custom message
        } else {
          throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
      }
      
      throw new Error('Failed to extract text from PDF due to an unknown error.');
    }
  }

  private calculatePDFExtractionConfidence(text: string, file: File): number {
    let confidence = 95; // High confidence for PDF text extraction

    // Text length bonuses
    if (text.length > 500) confidence += 2;
    if (text.length > 2000) confidence += 2;
    if (text.length > 5000) confidence += 1;

    // Penalize very short content
    if (text.length < 100) {
      confidence -= 15;
    } else if (text.length < 300) {
      confidence -= 10;
    }

    // Text structure bonuses
    const structureBonus = this.assessTextStructure(text);
    confidence += structureBonus;

    return Math.min(98, Math.max(75, confidence));
  }

  private detectLanguage(text: string): 'ar' | 'en' {
    if (!text || text.trim().length === 0) return 'ar';
    
    const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g);
    const englishChars = text.match(/[a-zA-Z]/g);
    
    const arabicCount = arabicChars ? arabicChars.length : 0;
    const englishCount = englishChars ? englishChars.length : 0;
    const totalChars = text.replace(/\s/g, '').length;
    
    const arabicRatio = totalChars > 0 ? arabicCount / totalChars : 0;
    
    console.log(`🌐 Language detection - Arabic: ${arabicCount}, English: ${englishCount}, Arabic ratio: ${(arabicRatio * 100).toFixed(1)}%`);
    
    // If more than 15% Arabic characters, consider it Arabic
    if (arabicRatio > 0.15) {
      return 'ar';
    }
    
    // If we have English characters and very few Arabic, it's English
    if (englishCount > 10 && arabicCount < 5) {
      return 'en';
    }
    
    // Default to Arabic for Saudi government context
    return 'ar';
  }

  private calculateWordCount(text: string, language: 'ar' | 'en'): number {
    if (!text || text.trim().length === 0) return 0;
    
    if (language === 'ar') {
      // Arabic word counting
      const arabicWords = text
        .trim()
        .split(/\s+/)
        .filter(word => {
          const cleanWord = word.replace(/[^\u0600-\u06FF]/g, '');
          return cleanWord.length >= 2;
        });
      
      return arabicWords.length;
    } else {
      // English word counting
      const englishWords = text
        .trim()
        .split(/\s+/)
        .filter(word => {
          const cleanWord = word.replace(/[^a-zA-Z]/g, '');
          return cleanWord.length >= 2;
        });
      
      return englishWords.length;
    }
  }

  private calculateExtractionConfidence(text: string, file: File, language: 'ar' | 'en'): number {
    let confidence = 85; // Base confidence for Vision API

    // Text length bonuses
    if (text.length > 500) confidence += 5;
    if (text.length > 2000) confidence += 5;
    if (text.length > 5000) confidence += 5;

    // Language-specific content quality
    const languageQuality = this.assessLanguageQuality(text, language);
    confidence += languageQuality;

    // Text structure bonuses
    const structureBonus = this.assessTextStructure(text);
    confidence += structureBonus;

    // Penalize very short content
    if (text.length < 100) {
      confidence -= 10;
    } else if (text.length < 300) {
      confidence -= 5;
    }

    return Math.min(95, Math.max(70, confidence));
  }

  private assessLanguageQuality(text: string, language: 'ar' | 'en'): number {
    let quality = 0;

    if (language === 'ar') {
      const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const arabicRatio = arabicChars / totalChars;
        quality += arabicRatio * 10;
      }

      const arabicWords = (text.match(/[\u0600-\u06FF]{3,}/g) || []).length;
      if (arabicWords > 10) quality += 3;
      if (arabicWords > 50) quality += 2;

    } else {
      const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const englishRatio = englishChars / totalChars;
        quality += englishRatio * 10;
      }

      const englishWords = (text.match(/[a-zA-Z]{3,}/g) || []).length;
      if (englishWords > 10) quality += 3;
      if (englishWords > 50) quality += 2;
    }

    return Math.min(quality, 10);
  }

  private assessTextStructure(text: string): number {
    let structureBonus = 0;

    // Check for paragraph structure
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) structureBonus += 2;
    if (paragraphs.length > 5) structureBonus += 1;

    // Check for sentence structure
    const sentences = text.split(/[.!?؟]/).filter(s => s.trim().length > 10);
    if (sentences.length > 3) structureBonus += 2;
    if (sentences.length > 10) structureBonus += 1;

    // Check for proper punctuation
    const punctuationMarks = (text.match(/[.!?؟،,;:]/g) || []).length;
    if (punctuationMarks > 5) structureBonus += 1;

    return Math.min(structureBonus, 5);
  }

  private formatFileSize(bytes: number): string {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}