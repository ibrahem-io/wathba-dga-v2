import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { extractTextFromFile, detectLanguage, fileToBase64, isVisualDocument } from '../utils/fileExtractor';

interface DocumentParserInput {
  file: File;
}

export class DocumentParserAgent extends BaseAgent {
  protected async onInitialize(): Promise<void> {
    // Initialize any resources needed for document parsing
    console.log(`Document Parser Agent ${this.config.id} initialized`);
  }

  protected async onExecute(input: DocumentParserInput): Promise<DocumentMetadata> {
    const { file } = input;

    try {
      console.log(`🔍 Starting enhanced document parsing for: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})`);

      // Check if this is a visual document that should use Vision API
      const isVisual = isVisualDocument(file);
      console.log(`📄 Document type: ${isVisual ? 'Visual (will use Vision API)' : 'Text-based'}`);

      let extractedText = '';
      let base64Image: string | undefined;
      let confidence = 70;

      if (isVisual) {
        // For visual documents, convert to base64 for Vision API
        try {
          base64Image = await fileToBase64(file);
          console.log(`📷 Converted to base64 for Vision API: ${base64Image.length} characters`);
          
          // Try to extract text first, but don't fail if it doesn't work
          try {
            extractedText = await this.createErrorBoundary(
              () => extractTextFromFile(file),
              ''
            );
            
            // If we got meaningful text, use it; otherwise rely on Vision API
            if (extractedText && extractedText.trim().length > 50 && !extractedText.includes('[VISUAL_DOCUMENT_FOR_VISION_API]')) {
              console.log(`📄 Text extraction successful: ${extractedText.length} characters`);
              confidence = 80;
            } else {
              console.log(`📷 Text extraction insufficient, will rely on Vision API`);
              extractedText = `[VISUAL_DOCUMENT_FOR_VISION_API]`;
              confidence = 85; // High confidence for Vision API processing
            }
          } catch (textError) {
            console.log(`📷 Text extraction failed, will use Vision API only:`, textError);
            extractedText = `[VISUAL_DOCUMENT_FOR_VISION_API]`;
            confidence = 85;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to convert visual document to base64:`, error);
          throw new Error(`Failed to process visual document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // For text-based documents (DOCX, TXT), use traditional extraction
        extractedText = await this.createErrorBoundary(
          () => extractTextFromFile(file),
          ''
        );
        console.log(`📄 Text extraction completed: ${extractedText.length} characters extracted`);
        
        // Validate text content for non-visual documents
        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error(`Insufficient text content extracted from ${file.name}. The document may be empty, corrupted, or in an unsupported format.`);
        }
      }

      // Detect language (for visual documents with placeholder text, default to Arabic)
      const language = (extractedText === '[VISUAL_DOCUMENT_FOR_VISION_API]') ? 'ar' : detectLanguage(extractedText);
      console.log(`🌐 Language detected: ${language}`);

      // Calculate word count (for visual documents with placeholder, set to 0)
      const wordCount = (extractedText === '[VISUAL_DOCUMENT_FOR_VISION_API]') ? 0 : this.calculateWordCount(extractedText, language);

      // Calculate extraction confidence
      if (!isVisual && extractedText !== '[VISUAL_DOCUMENT_FOR_VISION_API]') {
        confidence = this.calculateExtractionConfidence(extractedText, file, language);
      }

      const metadata: DocumentMetadata = {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        language,
        extractedText: extractedText.substring(0, 50000), // Limit text size
        wordCount,
        confidence,
        base64Image,
        isVisualDocument: isVisual
      };

      console.log(`✅ Document parsed successfully: ${file.name}
        - Type: ${isVisual ? 'Visual (Vision API)' : 'Text-based'}
        - Language: ${language}
        - Words: ${wordCount}
        - Confidence: ${confidence}%
        - Text length: ${extractedText.length} characters
        - Has base64: ${!!base64Image}`);
      
      return metadata;

    } catch (error) {
      console.error(`❌ Document parsing failed for ${file.name}:`, error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to parse document';
      
      if (error instanceof Error) {
        if (error.message.includes('Vision API')) {
          errorMessage = `Vision API processing failed: ${error.message}. Please ensure the image contains clear, readable text.`;
        } else if (error.message.includes('Insufficient text')) {
          errorMessage = `Document content issue: ${error.message}`;
        } else if (error.message.includes('PDF extraction failed')) {
          errorMessage = `PDF processing failed: ${error.message}. The PDF may be corrupted, password-protected, or contain only images.`;
        } else if (error.message.includes('Unsupported file type')) {
          errorMessage = `Unsupported file format: ${file.type}. Please upload PDF, DOCX, TXT, or image files.`;
        } else {
          errorMessage = `Document parsing error: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  private calculateWordCount(text: string, language: 'ar' | 'en'): number {
    // Enhanced word counting for both Arabic and English
    if (language === 'ar') {
      // Arabic word counting - split by spaces and filter meaningful words
      const arabicWords = text
        .trim()
        .split(/\s+/)
        .filter(word => {
          // Remove punctuation and check if word contains Arabic characters
          const cleanWord = word.replace(/[^\u0600-\u06FF]/g, '');
          return cleanWord.length >= 2; // Minimum 2 Arabic characters
        });
      
      return arabicWords.length;
    } else {
      // English word counting
      const englishWords = text
        .trim()
        .split(/\s+/)
        .filter(word => {
          // Remove punctuation and check if word contains English letters
          const cleanWord = word.replace(/[^a-zA-Z]/g, '');
          return cleanWord.length >= 2; // Minimum 2 English characters
        });
      
      return englishWords.length;
    }
  }

  private calculateExtractionConfidence(text: string, file: File, language: 'ar' | 'en'): number {
    let confidence = 70; // Base confidence

    // File type bonuses
    const fileTypeBonus = this.getFileTypeBonus(file.type);
    confidence += fileTypeBonus;

    // Text length bonuses
    if (text.length > 1000) confidence += 10;
    if (text.length > 5000) confidence += 10;
    if (text.length > 10000) confidence += 5;

    // Language-specific content quality
    const languageQuality = this.assessLanguageQuality(text, language);
    confidence += languageQuality;

    // Text structure bonuses
    const structureBonus = this.assessTextStructure(text);
    confidence += structureBonus;

    // Penalize very short content
    if (text.length < 100) {
      confidence -= 20;
    } else if (text.length < 300) {
      confidence -= 10;
    }

    // Special handling for image files (will use Vision API)
    if (file.type.startsWith('image/')) {
      confidence = 85; // High confidence for Vision API
    }

    return Math.min(95, Math.max(50, confidence));
  }

  private getFileTypeBonus(fileType: string): number {
    const bonuses: Record<string, number> = {
      'text/plain': 15,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10,
      'application/pdf': 5,
      'image/jpeg': 10, // Higher bonus for Vision API
      'image/png': 10,
      'image/tiff': 12,
      'image/bmp': 8,
      'image/webp': 10
    };

    return bonuses[fileType] || 0;
  }

  private assessLanguageQuality(text: string, language: 'ar' | 'en'): number {
    let quality = 0;

    if (language === 'ar') {
      // Arabic text quality assessment
      const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const arabicRatio = arabicChars / totalChars;
        quality += arabicRatio * 15; // Up to 15 points for high Arabic content
      }

      // Check for Arabic word patterns
      const arabicWords = (text.match(/[\u0600-\u06FF]{3,}/g) || []).length;
      if (arabicWords > 10) quality += 5;
      if (arabicWords > 50) quality += 5;

    } else {
      // English text quality assessment
      const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const englishRatio = englishChars / totalChars;
        quality += englishRatio * 15; // Up to 15 points for high English content
      }

      // Check for English word patterns
      const englishWords = (text.match(/[a-zA-Z]{3,}/g) || []).length;
      if (englishWords > 10) quality += 5;
      if (englishWords > 50) quality += 5;
    }

    return Math.min(quality, 15);
  }

  private assessTextStructure(text: string): number {
    let structureBonus = 0;

    // Check for paragraph structure
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) structureBonus += 3;
    if (paragraphs.length > 5) structureBonus += 2;

    // Check for sentence structure
    const sentences = text.split(/[.!?؟]/).filter(s => s.trim().length > 10);
    if (sentences.length > 3) structureBonus += 3;
    if (sentences.length > 10) structureBonus += 2;

    // Check for proper punctuation
    const punctuationMarks = (text.match(/[.!?؟،,;:]/g) || []).length;
    if (punctuationMarks > 5) structureBonus += 2;

    // Check for numbers (often indicate structured content)
    const numbers = (text.match(/\d+/g) || []).length;
    if (numbers > 0) structureBonus += 1;
    if (numbers > 10) structureBonus += 1;

    return Math.min(structureBonus, 10);
  }

  private formatFileSize(bytes: number): string {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}