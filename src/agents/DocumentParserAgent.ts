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
      // Extract text from file
      const extractedText = await this.createErrorBoundary(
        () => extractTextFromFile(file),
        ''
      );

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Insufficient text content extracted from document');
      }

      // Detect language
      const language = detectLanguage(extractedText);

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

      console.log(`Document parsed successfully: ${file.name} (${language}, ${wordCount} words)`);
      return metadata;

    } catch (error) {
      console.error(`Document parsing failed for ${file.name}:`, error);
      throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateWordCount(text: string): number {
    // Handle both Arabic and English text
    const words = text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return words.length;
  }

  private calculateExtractionConfidence(text: string, file: File): number {
    let confidence = 70; // Base confidence

    // Boost confidence based on text length
    if (text.length > 1000) confidence += 10;
    if (text.length > 5000) confidence += 10;

    // Boost confidence for supported file types
    if (file.type === 'text/plain') confidence += 10;
    if (file.type === 'application/pdf') confidence += 5;

    // Check for meaningful content (not just special characters)
    const meaningfulChars = text.match(/[a-zA-Z\u0600-\u06FF]/g);
    if (meaningfulChars && meaningfulChars.length > text.length * 0.5) {
      confidence += 10;
    }

    // Detect if text contains structured content
    if (text.includes('\n') && text.split('\n').length > 5) {
      confidence += 5;
    }

    return Math.min(95, Math.max(50, confidence));
  }
}