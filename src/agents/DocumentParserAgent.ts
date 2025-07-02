import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { extractTextFromFile, detectLanguage } from '../utils/fileExtractor';

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

      // Use Vision API for ALL file types - no local processing
      console.log(`🤖 Processing ${file.name} with OpenAI Vision API...`);
      
      let extractedText = '';
      let confidence = 90;
      let language: 'ar' | 'en' = 'ar'; // Default to Arabic for Saudi context

      try {
        // Extract text using Vision API for ALL file types
        extractedText = await extractTextFromFile(file, language);
        
        if (extractedText && extractedText.trim().length > 0) {
          console.log(`✅ Vision API extraction successful: ${extractedText.length} characters`);
          
          // Detect language from extracted text
          language = detectLanguage(extractedText);
          confidence = this.calculateVisionExtractionConfidence(extractedText, file);
          
          console.log(`🌐 Language detected: ${language}`);
          console.log(`📊 Extraction confidence: ${confidence}%`);
        } else {
          throw new Error(`No text could be extracted from "${file.name}". The file may be empty, corrupted, or contain only images without readable text.`);
        }
      } catch (error) {
        console.error(`❌ Vision API processing failed for ${file.name}:`, error);
        throw error;
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
        base64Image: undefined, // Not needed since we're using Vision API directly
        isVisualDocument: true // All documents are processed as visual with Vision API
      };

      console.log(`✅ Document processed successfully with Vision API: ${file.name}
        - Type: ${file.type}
        - Language: ${language}
        - Words: ${wordCount}
        - Confidence: ${confidence}%
        - Text length: ${extractedText.length} characters`);
      
      return metadata;

    } catch (error) {
      console.error(`❌ Vision API processing failed for ${file.name}:`, error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to process document with Vision API';
      
      if (error instanceof Error) {
        if (error.message.includes('unsupported image') || error.message.includes('invalid_image_format')) {
          errorMessage = `File format not supported by Vision API. Please convert "${file.name}" to a supported image format (PNG, JPEG, GIF, WebP) and try again.`;
        } else if (error.message.includes('rate limit')) {
          errorMessage = `AI service rate limit exceeded. Please wait a moment and try again.`;
        } else if (error.message.includes('API key')) {
          errorMessage = `OpenAI API key is invalid or missing. Please check your configuration.`;
        } else if (error.message.includes('No text could be extracted')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Vision API processing failed for "${file.name}": ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  private calculateVisionExtractionConfidence(text: string, file: File): number {
    let confidence = 85; // Base confidence for Vision API

    // Text length bonuses
    if (text.length > 500) confidence += 5;
    if (text.length > 2000) confidence += 5;
    if (text.length > 5000) confidence += 5;

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