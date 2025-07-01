import { BaseAgent } from './BaseAgent';
import { ComplianceScore, Evidence, DocumentMetadata } from './types';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

interface ComplianceScorerInput {
  documentMetadata: DocumentMetadata;
  evidence: Evidence[];
  criteriaId: string;
  language: 'ar' | 'en';
}

export class ComplianceScorerAgent extends BaseAgent {
  private llm: ChatOpenAI | null = null;

  protected async onInitialize(): Promise<void> {
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      // FIXED VERSION - Using exact model and settings from your debug checklist
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o', // Make sure using gpt-4o, not gpt-4-vision-preview
        temperature: 0.1,    // Lower temperature for more consistent results
        maxTokens: 4000,     // Increased token limit
        openAIApiKey: apiKey,
      });
      
      console.log(`Compliance Scorer Agent ${this.config.id} initialized with gpt-4o`);
    } catch (error) {
      console.error(`Failed to initialize LLM for agent ${this.config.id}:`, error);
      throw error;
    }
  }

  protected async onExecute(input: ComplianceScorerInput): Promise<ComplianceScore> {
    const { documentMetadata, evidence, criteriaId, language } = input;

    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    try {
      console.log(`🔍 Starting compliance scoring for criteria ${criteriaId}`);
      console.log(`📄 Document: ${documentMetadata.filename} (${documentMetadata.fileType})`);
      console.log(`📊 Text length: ${documentMetadata.extractedText.length} characters`);
      console.log(`🔍 Evidence pieces: ${evidence.length}`);

      // Debug extracted text immediately
      this.debugExtractedText(documentMetadata.extractedText);

      // Determine analysis strategy based on document type and content
      const result = this.shouldUseVisionAPI(documentMetadata)
        ? await this.analyzeWithVision(documentMetadata, criteriaId, language, evidence)
        : await this.analyzeWithText(documentMetadata, criteriaId, language, evidence);

      console.log(`✅ Compliance scoring completed for criteria ${criteriaId}: ${result.status} (${result.score}%)`);
      return result;

    } catch (error) {
      console.error(`❌ Compliance scoring failed for criteria ${criteriaId}:`, error);
      return this.createErrorScore(criteriaId, evidence, language, documentMetadata, error);
    }
  }

  // Debug function to see what we're actually getting
  private debugExtractedText(text: string): void {
    console.log('=== DEBUG TEXT ===');
    console.log('Length:', text.length);
    console.log('First 50 chars:', text.substring(0, 50));
    console.log('Has Arabic:', /[\u0600-\u06FF]/.test(text));
    console.log('Raw character codes:', text.substring(0, 10).split('').map(c => c.charCodeAt(0)));
    console.log('==================');
  }

  private shouldUseVisionAPI(metadata: DocumentMetadata): boolean {
    // Only use Vision API for actual image files with base64 data
    const imageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp'
    ];
    
    return imageTypes.includes(metadata.fileType) && 
           metadata.isVisualDocument && 
           !!metadata.base64Image;
  }

  private async analyzeWithVision(
    metadata: DocumentMetadata,
    criteriaId: string,
    language: 'ar' | 'en',
    evidence: Evidence[]
  ): Promise<ComplianceScore> {
    if (!this.llm || !metadata.base64Image) {
      throw new Error('Vision analysis not available');
    }

    console.log(`👁️ Using Vision API for image analysis`);

    // FIXED VERSION - Copy this exactly from your debug checklist
    const response = await this.llm.invoke([
      new SystemMessage("استخرج النص العربي بدقة. اكتب النص بترميز UTF-8 الصحيح. لا تستخدم رموز خاصة."),
      new HumanMessage({
        content: [
          { type: "text", text: "استخرج النص العربي من هذه الصورة:" },
          { 
            type: "image_url", 
            image_url: { 
              url: `data:image/png;base64,${metadata.base64Image}`,
              detail: "high" 
            }
          }
        ]
      })
    ]);

    // Debug the response immediately
    const extractedText = response.content as string;
    this.debugExtractedText(extractedText);

    // Now analyze the extracted text for compliance
    const systemPrompt = this.getDetailedAuditPrompt(criteriaId, language);
    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (صلة: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لا توجد أدلة مباشرة مستخرجة مسبقاً' : 'No direct evidence extracted previously');

    const userPrompt = language === 'ar' ? `
الملف: ${metadata.filename}
نوع الملف: ${metadata.fileType}
حجم الملف: ${this.formatFileSize(metadata.fileSize)}

النص المستخرج من الصورة:
${extractedText}

الأدلة المستخرجة مسبقاً (إن وجدت):
${evidenceText}

قم بتحليل النص المستخرج من الصورة للبحث عن أي دليل على الامتثال للمتطلب ${criteriaId} وفقاً للإرشادات التفصيلية المحددة.
` : `
File: ${metadata.filename}
File Type: ${metadata.fileType}
File Size: ${this.formatFileSize(metadata.fileSize)}

Text extracted from image:
${extractedText}

Previously extracted evidence (if any):
${evidenceText}

Analyze the text extracted from the image for any evidence of compliance with requirement ${criteriaId} according to the detailed guidelines specified.
`;

    const analysisResponse = await this.llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ]);

    return this.parseResponse(analysisResponse.content as string, criteriaId, evidence, metadata);
  }

  private async analyzeWithText(
    metadata: DocumentMetadata, 
    criteriaId: string, 
    language: 'ar' | 'en',
    evidence: Evidence[]
  ): Promise<ComplianceScore> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    console.log(`📝 Using text analysis for document`);

    const systemPrompt = this.getDetailedAuditPrompt(criteriaId, language);

    // Clean the text to ensure proper UTF-8 encoding
    let textToAnalyze = this.cleanTextForAPI(metadata.extractedText);
    let analysisNote = '';

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      const fallbackMessage = language === 'ar' 
        ? `هذه وثيقة ${metadata.fileType} (${metadata.filename}) لم يتم استخراج نص منها. قد تكون وثيقة ممسوحة ضوئياً أو تحتوي على صور بشكل أساسي.`
        : `This is a ${metadata.fileType} document (${metadata.filename}) with no extracted text. It may be a scanned document or primarily contain images.`;
      
      textToAnalyze = fallbackMessage;
      analysisNote = language === 'ar' ? 'وثيقة بدون نص مستخرج' : 'Document with no extracted text';
    } else if (textToAnalyze.length < 50) {
      analysisNote = language === 'ar' ? 'محتوى نصي محدود' : 'Limited text content';
    }

    // Limit text to prevent token overflow
    const maxTextLength = 12000;
    if (textToAnalyze.length > maxTextLength) {
      textToAnalyze = textToAnalyze.substring(0, maxTextLength) + '...';
    }

    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (صلة: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لم يتم العثور على أدلة مباشرة' : 'No direct evidence found');

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
نوع الملف: ${metadata.fileType}
اللغة المكتشفة: ${metadata.language}
عدد الكلمات: ${metadata.wordCount}
ثقة الاستخراج: ${metadata.confidence}%
${analysisNote ? `ملاحظة: ${analysisNote}` : ''}

الأدلة المستخرجة:
${evidenceText}

النص المتاح للتحليل:
${textToAnalyze}

قم بتحليل هذا المحتوى بعناية للبحث عن أي دليل على الامتثال للمتطلب ${criteriaId} وفقاً للإرشادات التفصيلية المحددة.
` : `
Document: ${metadata.filename}
File Type: ${metadata.fileType}
Detected Language: ${metadata.language}
Word Count: ${metadata.wordCount}
Extraction Confidence: ${metadata.confidence}%
${analysisNote ? `Note: ${analysisNote}` : ''}

Extracted Evidence:
${evidenceText}

Available text for analysis:
${textToAnalyze}

Carefully analyze this content for any evidence of compliance with requirement ${criteriaId} according to the detailed guidelines specified.
`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ];

    const response = await this.llm.invoke(messages);
    return this.parseResponse(response.content as string, criteriaId, evidence, metadata);
  }

  // Clean text to ensure proper UTF-8 encoding and remove problematic characters
  private cleanTextForAPI(text: string): string {
    if (!text) return '';
    
    // Remove control characters and non-printable characters that could break API calls
    let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
    
    // Remove any remaining problematic characters
    cleaned = cleaned.replace(/[^\u0020-\u007E\u0600-\u06FF\u0750-\u077F\u0590-\u05FF\s]/g, ' ');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  private getDetailedAuditPrompt(criteriaId: string, language: 'ar' | 'en'): string {
    const prompts = {
      '5.4.1': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.1: "إعداد دراسات وبرامج لتعزيز الثقافة والبيئة الرقمية"

الهدف: تحديد مستوى وعي منسوبي الجهة الحكومية بالتحول الرقمي وإعداد الدراسات والبرامج اللازمة لزيادة هذا الوعي.

ابحث عن أي إشارة إلى:
- دراسات أو تقييمات أو مسوحات
- تحليل الوعي أو المعرفة أو المهارات
- التحول الرقمي أو الرقمنة أو التقنية
- فهم أو إدراك أو وعي الموظفين
- خطط أو مبادرات أو مشاريع رقمية
- برامج تدريبية أو توعوية أو تطويرية

كن متساهلاً جداً - أي إشارة لهذه المفاهيم حتى لو كانت بسيطة تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل يوضح ما تم العثور عليه مع ربطه بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.1: "Preparing Studies and Programs for Enhancing Digital Culture and Environment"

Objective: Determine the level of digital transformation awareness among government entity employees and prepare necessary studies and programs to increase this awareness.

Look for any reference to:
- Studies, assessments, or surveys
- Analysis of awareness, knowledge, or skills
- Digital transformation, digitization, or technology
- Employee understanding, perception, or awareness
- Digital plans, initiatives, or projects
- Training, awareness, or development programs

Be very lenient - any reference to these concepts, even simple ones, counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis explaining what was found linked to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"],
  "documentContent": "summary of actual content found in the document that was analyzed"
}`
      },
      '5.4.2': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.2: "تنفيذ برامج التوعية بالتحول الرقمي وقياس أثرها"

ابحث عن أي إشارة إلى:
- تنفيذ أو تطبيق أو تطبق أو ينفذ
- أنشطة أو فعاليات أو مبادرات منفذة
- برامج أو ورش أو دورات تم تقديمها
- قياس أو تقييم أو مراجعة
- مؤشرات أو نسب أو إحصائيات
- نتائج أو تقارير أو تقدم

كن متساهلاً جداً في التقييم - أي إشارة للتنفيذ أو الأنشطة تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.2: "Implementing Digital Transformation Awareness Programs and Measuring Their Impact"

Look for any reference to:
- Implementation, execution, or application
- Activities, events, or implemented initiatives
- Programs, workshops, or courses delivered
- Measurement, evaluation, or review
- Indicators, rates, or statistics
- Results, reports, or progress

Be very lenient in evaluation - any reference to implementation or activities counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"],
  "documentContent": "summary of actual content found in the document that was analyzed"
}`
      },
      '5.4.3': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.3: "استخدام الأدوات التقنية لمساعدة عمليات الجهة"

ابحث عن أي إشارة إلى:
- أدوات تقنية أو رقمية أو إلكترونية
- أنظمة أو برمجيات أو تطبيقات
- منصات أو حلول تقنية
- استخدام أو اعتماد أو تطبيق
- تدريب على الأدوات أو الأنظمة
- دعم تقني أو مساعدة فنية

كن متساهلاً - أي إشارة للتقنية أو الأدوات تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`
      },
      '5.4.4': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.4: "التطوير المستمر للثقافة الرقمية"

ابحث عن أي إشارة إلى:
- استراتيجية أو استراتيجيات
- خطة أو خطط أو تخطيط
- التطوير المستمر أو التحسين المستمر
- متابعة أو مراقبة أو رصد
- قياس الأثر أو تقييم الأثر
- ثقافة رقمية أو ثقافة تقنية

كن متساهلاً جداً - أي إشارة للتطوير أو التحسين تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`
      }
    };

    return prompts[criteriaId as keyof typeof prompts]?.[language] || this.getGenericPrompt(criteriaId, language);
  }

  private getGenericPrompt(criteriaId: string, language: 'ar' | 'en'): string {
    return language === 'ar' ? `
أنت خبير مدقق متخصص في تقييم معايير هيئة الحكومة الرقمية السعودية.

قم بتحليل الوثيقة للبحث عن أدلة الامتثال للمتطلب ${criteriaId}.

كن متساهلاً وشاملاً في تقييمك وقدم رؤى قابلة للتنفيذ.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة"
}
` : `
You are an expert auditor specialized in evaluating Saudi Arabia's Digital Governance Authority standards.

Analyze the document for evidence of compliance with requirement ${criteriaId}.

Be lenient, thorough, and provide actionable insights in your assessment.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "documentContent": "summary of actual content found in the document"
}
`;
  }

  private parseResponse(content: string, criteriaId: string, evidence: Evidence[], metadata: DocumentMetadata): ComplianceScore {
    try {
      // Clean the content by removing markdown code block delimiters
      let cleanedContent = content.trim();
      
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.substring(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.substring(3);
      }
      
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
      }
      
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      return {
        criteriaId,
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        status: ['pass', 'fail', 'partial'].includes(parsed.status) ? parsed.status : 'fail',
        confidence: Math.max(70, Math.min(95, parsed.confidence || 75)),
        evidence,
        findings: parsed.findings || 'No detailed findings available',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
        documentContent: parsed.documentContent || this.generateDocumentContentSummary(metadata)
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.log('Raw response:', content);
      throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateDocumentContentSummary(metadata: DocumentMetadata): string {
    const text = metadata.extractedText;
    const language = metadata.language;
    
    if (this.shouldUseVisionAPI(metadata)) {
      return language === 'ar' 
        ? `صورة (${metadata.fileType}) تم تحليلها باستخدام تقنية الرؤية الاصطناعية. الملف: ${metadata.filename}`
        : `Image (${metadata.fileType}) analyzed using AI Vision technology. File: ${metadata.filename}`;
    }
    
    if (!text || text.trim().length < 10) {
      return language === 'ar' 
        ? `وثيقة ${metadata.fileType} (${metadata.filename}) مع محتوى نصي محدود. قد تكون وثيقة ممسوحة ضوئياً.`
        : `${metadata.fileType} document (${metadata.filename}) with limited text content. May be a scanned document.`;
    }

    // Extract first few sentences as a summary
    const sentences = text.split(/[.!?؟]/);
    const meaningfulSentences = sentences
      .filter(s => s.trim().length > 20)
      .slice(0, 3)
      .map(s => s.trim());

    if (meaningfulSentences.length === 0) {
      return language === 'ar'
        ? `الوثيقة تحتوي على ${metadata.wordCount} كلمة لكن النص غير واضح أو مجزأ`
        : `Document contains ${metadata.wordCount} words but text is unclear or fragmented`;
    }

    const summary = meaningfulSentences.join('. ');
    const prefix = language === 'ar' 
      ? `الوثيقة تحتوي على ${metadata.wordCount} كلمة. المحتوى الرئيسي: `
      : `Document contains ${metadata.wordCount} words. Main content: `;

    return prefix + summary.substring(0, 300) + (summary.length > 300 ? '...' : '');
  }

  private createErrorScore(
    criteriaId: string, 
    evidence: Evidence[], 
    language: 'ar' | 'en',
    metadata: DocumentMetadata,
    error: any
  ): ComplianceScore {
    const analysisMethod = this.shouldUseVisionAPI(metadata) ? 'Vision API' : 'text analysis';
    
    const findings = language === 'ar' 
      ? `حدث خطأ أثناء تحليل الوثيقة "${metadata.filename}" باستخدام ${analysisMethod}: ${error instanceof Error ? error.message : 'خطأ غير معروف'}. تم العثور على ${evidence.length} دليل. الوثيقة تحتوي على ${metadata.wordCount} كلمة بثقة استخراج ${metadata.confidence}%.`
      : `Error occurred while analyzing document "${metadata.filename}" using ${analysisMethod}: ${error instanceof Error ? error.message : 'Unknown error'}. Found ${evidence.length} evidence pieces. Document contains ${metadata.wordCount} words with ${metadata.confidence}% extraction confidence.`;

    const recommendations = language === 'ar' 
      ? [
          'تحقق من جودة الوثيقة ووضوح النص',
          'تأكد من أن الوثيقة تحتوي على محتوى ذي صلة بالمتطلب',
          'جرب رفع الوثيقة بتنسيق مختلف إذا أمكن'
        ]
      : [
          'Check document quality and text clarity',
          'Ensure document contains content relevant to the requirement',
          'Try uploading the document in a different format if possible'
        ];

    return {
      criteriaId,
      score: 0,
      status: 'fail',
      confidence: 70,
      evidence,
      findings,
      recommendations,
      documentContent: this.generateDocumentContentSummary(metadata)
    };
  }

  private formatFileSize(bytes: number): string {
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}