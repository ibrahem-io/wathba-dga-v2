import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { extractTextFromFile, detectLanguage, isVisualDocument } from '../utils/fileExtractor';

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
      console.log(`🔍 Starting document parsing for: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})`);

      // Check if this is an image file and handle gracefully
      if (isVisualDocument(file)) {
        throw new Error(`Image file detected: "${file.name}". This system currently processes text documents only. Please upload PDF, DOCX, or TXT files for text analysis.`);
      }

      let extractedText = '';
      let confidence = 70;
      let language: 'ar' | 'en' = 'ar';

      try {
        console.log(`📄 Extracting text from document...`);
        extractedText = await extractTextFromFile(file);
        
        if (extractedText && extractedText.trim().length > 0) {
          console.log(`✅ Text extraction successful: ${extractedText.length} characters`);
          
          // Detect language and calculate metrics
          language = detectLanguage(extractedText);
          confidence = this.calculateExtractionConfidence(extractedText, file, language);
          
          console.log(`🌐 Language detected: ${language}`);
          console.log(`📊 Extraction confidence: ${confidence}%`);
        } else {
          throw new Error(`No readable text content found in "${file.name}". The document may be empty, corrupted, or a scanned document.`);
        }
      } catch (error) {
        console.error(`❌ Text extraction failed for ${file.name}:`, error);
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
        base64Image: undefined,
        isVisualDocument: false // Text-based processing
      };

      console.log(`✅ Document parsed successfully: ${file.name}
        - Type: Text-based
        - Language: ${language}
        - Words: ${wordCount}
        - Confidence: ${confidence}%
        - Text length: ${extractedText.length} characters`);
      
      return metadata;

    } catch (error) {
      console.error(`❌ Document parsing failed for ${file.name}:`, error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to parse document';
      
      if (error instanceof Error) {
        if (error.message.includes('Image file detected')) {
          errorMessage = error.message;
        } else if (error.message.includes('scanned document') || error.message.includes('image-based PDF')) {
          errorMessage = `Document "${file.name}" appears to be a scanned or image-based file. Please upload a text-based document or convert to a different format.`;
        } else if (error.message.includes('No readable text')) {
          errorMessage = `Document "${file.name}" appears to be empty or corrupted. Please check the file and try again.`;
        } else if (error.message.includes('Unsupported file type')) {
          errorMessage = `Unsupported file format: ${file.type}. Please upload PDF, DOCX, or TXT files.`;
        } else if (error.message.includes('password-protected')) {
          errorMessage = `Document "${file.name}" may be password-protected. Please upload an unprotected document.`;
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
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
    let confidence = 70; // Base confidence

    // File type bonuses
    const fileTypeBonus = this.getFileTypeBonus(file.type);
    confidence += fileTypeBonus;

    // Text length bonuses
    if (text.length > 500) confidence += 5;
    if (text.length > 2000) confidence += 10;
    if (text.length > 5000) confidence += 10;

    // Language-specific content quality
    const languageQuality = this.assessLanguageQuality(text, language);
    confidence += languageQuality;

    // Text structure bonuses
    const structureBonus = this.assessTextStructure(text);
    confidence += structureBonus;

    // Penalize very short content
    if (text.length < 100) {
      confidence -= 15;
    } else if (text.length < 300) {
      confidence -= 5;
    }

    return Math.min(95, Math.max(30, confidence));
  }

  private getFileTypeBonus(fileType: string): number {
    const bonuses: Record<string, number> = {
      'text/plain': 15,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 10,
      'application/pdf': 5
    };

    return bonuses[fileType] || 0;
  }

  private assessLanguageQuality(text: string, language: 'ar' | 'en'): number {
    let quality = 0;

    if (language === 'ar') {
      const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const arabicRatio = arabicChars / totalChars;
        quality += arabicRatio * 15;
      }

      const arabicWords = (text.match(/[\u0600-\u06FF]{3,}/g) || []).length;
      if (arabicWords > 10) quality += 5;
      if (arabicWords > 50) quality += 5;

    } else {
      const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
      const totalChars = text.replace(/\s/g, '').length;
      
      if (totalChars > 0) {
        const englishRatio = englishChars / totalChars;
        quality += englishRatio * 15;
      }

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

    // Check for numbers
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