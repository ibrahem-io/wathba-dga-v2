import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { fileToBase64 } from '../utils/fileUtils';
import { extractTextFromImageWithVision } from '../services/openaiService';

interface DocumentParserInput {
  file: File;
}

export class DocumentParserAgent extends BaseAgent {
  protected async onInitialize(): Promise<void> {
    console.log(`Document Parser Agent ${this.config.id} initialized`);
  }

  protected async onExecute(input: DocumentParserInput): Promise<DocumentMetadata> {
    const { file } = input;

    try {
      console.log(`🔍 Starting Vision API processing for: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})`);

      // ALWAYS use Vision API first for ALL file types
      let extractedText = '';
      let base64Image: string | undefined;
      let confidence = 90; // High confidence for Vision API
      let language: 'ar' | 'en' = 'ar'; // Default to Arabic for Saudi context

      try {
        console.log(`📷 Converting file to base64: ${file.name}`);
        base64Image = await fileToBase64(file);
        console.log(`✅ File converted to base64: ${base64Image.length} characters`);
        
        console.log(`🤖 Using Vision API to extract text from: ${file.name}`);
        extractedText = await extractTextFromImageWithVision(base64Image, language);
        
        if (extractedText && extractedText.trim().length > 0) {
          console.log(`✅ Vision API extraction successful: ${extractedText.length} characters`);
          
          // Detect language from extracted text
          language = this.detectLanguage(extractedText);
          confidence = this.calculateExtractionConfidence(extractedText, file, language);
          
          console.log(`🌐 Language detected: ${language}`);
          console.log(`📊 Extraction confidence: ${confidence}%`);
        } else {
          throw new Error('No text extracted from Vision API');
        }
        
      } catch (visionError) {
        console.error(`❌ Vision API failed for ${file.name}:`, visionError);
        throw new Error(`Vision API processing failed for "${file.name}": ${visionError instanceof Error ? visionError.message : 'Unknown error'}`);
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
        isVisualDocument: true // All files are processed as visual documents now
      };

      console.log(`✅ Document processed successfully with Vision API: ${file.name}
        - Type: ${file.type}
        - Language: ${language}
        - Words: ${wordCount}
        - Confidence: ${confidence}%
        - Text length: ${extractedText.length} characters`);
      
      return metadata;

    } catch (error) {
      console.error(`❌ Document processing failed for ${file.name}:`, error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to process document with Vision API';
      
      if (error instanceof Error) {
        if (error.message.includes('unsupported image') || error.message.includes('invalid_image_format')) {
          errorMessage = `File format not supported by Vision API. Please convert "${file.name}" to PNG, JPEG, GIF, or WebP format and try again.`;
        } else if (error.message.includes('Vision API')) {
          errorMessage = `Vision API processing failed: ${error.message}`;
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
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