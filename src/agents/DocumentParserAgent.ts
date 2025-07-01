import { BaseAgent } from './BaseAgent';
import { DocumentMetadata } from './types';
import { extractTextFromFile, detectLanguage } from '../utils/fileExtractor';

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
      console.log(`Starting document parsing for: ${file.name} (${file.type}, ${this.formatFileSize(file.size)})`);

      // Extract text from file (now includes OCR support)
      const extractedText = await this.createErrorBoundary(
        () => extractTextFromFile(file),
        ''
      );

      console.log(`Text extraction completed: ${extractedText.length} characters extracted`);

      if (!extractedText || extractedText.trim().length < 10) {
        console.warn(`Insufficient text content extracted from ${file.name}`);
        throw new Error('Insufficient text content extracted from document. The document may be empty, corrupted, or contain only images without readable text.');
      }

      // Detect language
      const language = detectLanguage(extractedText);
      console.log(`Language detected: ${language}`);

      // Calculate word count
      const wordCount = this.calculateWordCount(extractedText);

      // Calculate extraction confidence
      const confidence = this.calculateExtractionConfidence(extractedText, file);

      const metadata: DocumentMetadata = {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        language,
        extractedText: extractedText.substring(0, 50000), // Limit text size
        wordCount,
        confidence
      };

      console.log(`Document parsed successfully: ${file.name} (${language}, ${wordCount} words, ${confidence}% confidence)`);
      return metadata;

    } catch (error) {
      console.error(`Document parsing failed for ${file.name}:`, error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to parse document';
      
      if (error instanceof Error) {
        if (error.message.includes('OCR')) {
          errorMessage = `OCR processing failed: ${error.message}`;
        } else if (error.message.includes('Insufficient text')) {
          errorMessage = `Document appears to be empty or unreadable: ${error.message}`;
        } else {
          errorMessage = `Document parsing error: ${error.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  private calculateWordCount(text: string): number {
    // Handle both Arabic and English text
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0 && /[a-zA-Z\u0600-\u06FF]/.test(word)); // Only count words with letters
    
    return words.length;
  }

  private calculateExtractionConfidence(text: string, file: File): number {
    let confidence = 70; // Base confidence

    // Boost confidence based on text length
    if (text.length > 1000) confidence += 10;
    if (text.length > 5000) confidence += 10;

    // Boost confidence for supported file types
    if (file.type === 'text/plain') confidence += 15;
    if (file.type === 'application/pdf') confidence += 5;
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') confidence += 10;
    if (file.type.startsWith('image/')) confidence += 5; // OCR has inherent uncertainty

    // Check for meaningful content (not just special characters)
    const meaningfulChars = text.match(/[a-zA-Z\u0600-\u06FF]/g);
    if (meaningfulChars && meaningfulChars.length > text.length * 0.5) {
      confidence += 10;
    }

    // Detect if text contains structured content
    if (text.includes('\n') && text.split('\n').length > 5) {
      confidence += 5;
    }

    // Check for Arabic text quality
    const arabicChars = text.match(/[\u0600-\u06FF]/g);
    if (arabicChars && arabicChars.length > 0) {
      confidence += 5; // Bonus for Arabic content
    }

    // Penalize very short content
    if (text.length < 100) {
      confidence -= 20;
    }

    return Math.min(95, Math.max(50, confidence));
  }

  private formatFileSize(bytes: number): string {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}