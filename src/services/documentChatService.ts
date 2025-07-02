import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface DocumentChatResponse {
  answer: string;
  confidence: number;
  sources: string[];
}

export class DocumentChatService {
  private llm: ChatOpenAI | null = null;

  public async initialize(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 2000,
        openAIApiKey: apiKey,
      });
      
      console.log('Document Chat Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Document Chat Service:', error);
      throw error;
    }
  }

  public async askQuestion(
    question: string,
    documentTexts: { filename: string; content: string }[],
    language: 'ar' | 'en'
  ): Promise<DocumentChatResponse> {
    if (!this.llm) {
      await this.initialize();
    }

    if (!this.llm) {
      throw new Error('Chat service not initialized');
    }

    try {
      console.log(`🤖 Processing question: "${question}" for ${documentTexts.length} documents`);

      // Combine all document texts with clear separation
      const combinedContext = documentTexts
        .map(doc => `=== ${doc.filename} ===\n${doc.content}`)
        .join('\n\n');

      const systemPrompt = this.getSystemPrompt(language);
      const userPrompt = this.getUserPrompt(question, combinedContext, language);

      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      const answer = response.content as string;

      // Extract sources mentioned in the answer
      const sources = this.extractSources(answer, documentTexts.map(d => d.filename));

      // Calculate confidence based on answer quality
      const confidence = this.calculateConfidence(answer, question, language);

      console.log(`✅ Question answered with ${confidence}% confidence`);

      return {
        answer: answer.trim(),
        confidence,
        sources
      };

    } catch (error) {
      console.error('❌ Question processing failed:', error);
      throw new Error(`Failed to process question: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(language: 'ar' | 'en'): string {
    return language === 'ar' ? `
أنت مساعد ذكي متخصص في تحليل الوثائق العربية والإجابة على الأسئلة بناءً على محتواها.

مهامك:
1. اقرأ الوثائق المرفقة بعناية
2. أجب على أسئلة المستخدم بناءً على محتوى الوثائق فقط
3. إذا لم تجد الإجابة في الوثائق، قل ذلك بوضوح
4. اقتبس من النص الأصلي عند الإمكان
5. كن دقيقاً ومفيداً ومختصراً
6. أجب باللغة العربية بوضوح وبساطة

إرشادات مهمة:
- لا تختلق معلومات غير موجودة في الوثائق
- إذا كانت المعلومات غير واضحة، اذكر ذلك
- استخدم أمثلة من النص عند الإمكان
- رتب إجابتك بشكل منطقي ومفهوم
` : `
You are a smart assistant specialized in analyzing Arabic documents and answering questions based on their content.

Your tasks:
1. Read the attached documents carefully
2. Answer user questions based only on document content
3. If you can't find the answer in the documents, say so clearly
4. Quote from the original text when possible
5. Be accurate, helpful, and concise
6. Answer in English clearly and simply

Important guidelines:
- Don't make up information not found in the documents
- If information is unclear, mention that
- Use examples from the text when possible
- Structure your answer logically and understandably
`;
  }

  private getUserPrompt(question: string, context: string, language: 'ar' | 'en'): string {
    return language === 'ar' ? `
الوثائق المتاحة:
${context}

سؤال المستخدم: ${question}

يرجى الإجابة على السؤال بناءً على محتوى الوثائق المرفقة فقط. إذا لم تجد الإجابة في الوثائق، قل ذلك بوضوح.
` : `
Available documents:
${context}

User question: ${question}

Please answer the question based only on the content of the attached documents. If you can't find the answer in the documents, say so clearly.
`;
  }

  private extractSources(answer: string, filenames: string[]): string[] {
    const sources: string[] = [];
    
    // Look for filename mentions in the answer
    filenames.forEach(filename => {
      if (answer.includes(filename) || answer.includes(filename.replace(/\.[^/.]+$/, ""))) {
        sources.push(filename);
      }
    });

    // If no specific sources found but answer seems to reference documents
    if (sources.length === 0 && answer.length > 50 && !answer.includes('لم أجد') && !answer.includes("can't find")) {
      return filenames; // Assume all documents were potentially used
    }

    return sources;
  }

  private calculateConfidence(answer: string, question: string, language: 'ar' | 'en'): number {
    let confidence = 70; // Base confidence

    // Check answer length and quality
    if (answer.length > 100) confidence += 10;
    if (answer.length > 300) confidence += 10;

    // Check for specific indicators
    const highConfidenceIndicators = language === 'ar' 
      ? ['وفقاً للوثيقة', 'كما ذكر في', 'حسب النص', 'المذكور في']
      : ['according to the document', 'as mentioned in', 'the text states', 'as stated in'];

    const lowConfidenceIndicators = language === 'ar'
      ? ['لم أجد', 'غير واضح', 'قد يكون', 'ربما']
      : ["can't find", 'unclear', 'might be', 'possibly'];

    // Boost confidence for specific references
    highConfidenceIndicators.forEach(indicator => {
      if (answer.includes(indicator)) confidence += 5;
    });

    // Reduce confidence for uncertainty
    lowConfidenceIndicators.forEach(indicator => {
      if (answer.includes(indicator)) confidence -= 15;
    });

    // Check if answer directly addresses the question
    const questionWords = question.toLowerCase().split(' ').filter(word => word.length > 3);
    const answerWords = answer.toLowerCase().split(' ');
    const overlap = questionWords.filter(word => answerWords.some(answerWord => answerWord.includes(word)));
    
    if (overlap.length > questionWords.length * 0.3) {
      confidence += 10;
    }

    return Math.min(95, Math.max(30, confidence));
  }
}

// Singleton instance
export const documentChatService = new DocumentChatService();