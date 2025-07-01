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

      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        openAIApiKey: apiKey,
      });
      
      console.log(`Compliance Scorer Agent ${this.config.id} initialized`);
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
      // If we have very little content, do a basic text analysis instead of relying only on evidence
      const shouldAnalyzeFullText = evidence.length === 0 || documentMetadata.wordCount < 50;
      
      if (shouldAnalyzeFullText && documentMetadata.extractedText.length > 20) {
        console.log(`Performing full text analysis for criteria ${criteriaId} due to limited evidence`);
        return await this.analyzeFullText(documentMetadata, criteriaId, language);
      }

      const prompt = this.buildPrompt(criteriaId, language, documentMetadata, evidence);
      
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];

      console.log(`Scoring compliance for criteria ${criteriaId} with ${evidence.length} evidence pieces`);
      
      const response = await this.llm.invoke(messages);
      const result = this.parseResponse(response.content as string, criteriaId, evidence);

      console.log(`Compliance scoring completed for criteria ${criteriaId}: ${result.status} (${result.score}%)`);
      return result;

    } catch (error) {
      console.error(`Compliance scoring failed for criteria ${criteriaId}:`, error);
      
      // Try full text analysis as fallback if we have content
      if (documentMetadata.extractedText.length > 20) {
        console.log(`Attempting full text analysis as fallback for criteria ${criteriaId}`);
        try {
          return await this.analyzeFullText(documentMetadata, criteriaId, language);
        } catch (fallbackError) {
          console.error(`Full text analysis also failed:`, fallbackError);
        }
      }
      
      // Final fallback
      return this.createFallbackScore(criteriaId, evidence, language, documentMetadata);
    }
  }

  private async analyzeFullText(
    metadata: DocumentMetadata, 
    criteriaId: string, 
    language: 'ar' | 'en'
  ): Promise<ComplianceScore> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    const criteriaDescriptions = {
      '5.4.1': {
        ar: 'إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية اللازمة',
        en: 'Conduct studies to determine agency staff awareness levels of digital transformation and develop necessary awareness programs'
      },
      '5.4.2': {
        ar: 'تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها وتقييم فعاليتها',
        en: 'Implement approved programs to increase agency staff awareness of digital transformation, measure achievement rates, and evaluate effectiveness'
      },
      '5.4.3': {
        ar: 'تحسين استخدام الأدوات التقنية في أعمال منسوبي الجهة وتنظيم ورش التدريب وإنشاء قنوات الدعم التقني',
        en: 'Improve the use of technical tools in agency staff work, organize training workshops, and establish technical support channels'
      },
      '5.4.4': {
        ar: 'وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها',
        en: 'Develop strategies and plans for continuous development of digital culture in the agency, monitor implementation, and measure impact'
      }
    };

    const criteriaDesc = criteriaDescriptions[criteriaId as keyof typeof criteriaDescriptions];
    const description = criteriaDesc ? criteriaDesc[language] : 'Unknown criteria';

    const systemPrompt = language === 'ar' ? `
أنت خبير تدقيق متخصص في تقييم الامتثال لمعايير هيئة الحكومة الرقمية السعودية.

المتطلب ${criteriaId}: ${description}

قم بتحليل النص الكامل للوثيقة وابحث عن أي إشارات أو أدلة تتعلق بهذا المتطلب.

كن متساهلاً في التقييم - ابحث عن:
- أي ذكر للكلمات المفتاحية ذات الصلة
- أي أنشطة أو مبادرات قد تكون مرتبطة
- أي خطط أو استراتيجيات ذات علاقة
- أي عمليات أو إجراءات قد تساهم في تحقيق المتطلب

نظام التقييم:
- "pass": 60+ نقطة - وجود أدلة واضحة أو إشارات قوية
- "partial": 30-59 نقطة - وجود إشارات أو أدلة ضعيفة
- "fail": أقل من 30 نقطة - عدم وجود أي إشارة واضحة

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل يوضح ما تم العثور عليه أو عدم العثور عليه",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}
` : `
You are an expert auditor specialized in evaluating compliance with Saudi Arabia's Digital Governance Authority standards.

Requirement ${criteriaId}: ${description}

Analyze the full document text and look for any references or evidence related to this requirement.

Be lenient in evaluation - look for:
- Any mention of relevant keywords
- Any activities or initiatives that might be related
- Any plans or strategies that are relevant
- Any processes or procedures that might contribute to meeting the requirement

Scoring System:
- "pass": 60+ points - Clear evidence or strong references found
- "partial": 30-59 points - Some references or weak evidence found
- "fail": Less than 30 points - No clear reference found

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis explaining what was found or not found",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}
`;

    // Limit text to prevent token overflow
    const maxTextLength = 8000;
    const textToAnalyze = metadata.extractedText.length > maxTextLength 
      ? metadata.extractedText.substring(0, maxTextLength) + '...'
      : metadata.extractedText;

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
عدد الكلمات: ${metadata.wordCount}

النص الكامل للتحليل:
${textToAnalyze}

قم بتحليل هذا النص للبحث عن أي دليل على الامتثال للمتطلب ${criteriaId}.
` : `
Document: ${metadata.filename}
Word Count: ${metadata.wordCount}

Full text for analysis:
${textToAnalyze}

Analyze this text for any evidence of compliance with requirement ${criteriaId}.
`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ];

    const response = await this.llm.invoke(messages);
    return this.parseResponse(response.content as string, criteriaId, []);
  }

  private buildPrompt(
    criteriaId: string, 
    language: 'ar' | 'en', 
    metadata: DocumentMetadata, 
    evidence: Evidence[]
  ) {
    const criteriaDescriptions = {
      '5.4.1': {
        ar: 'إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية اللازمة',
        en: 'Conduct studies to determine agency staff awareness levels of digital transformation and develop necessary awareness programs'
      },
      '5.4.2': {
        ar: 'تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها وتقييم فعاليتها',
        en: 'Implement approved programs to increase agency staff awareness of digital transformation, measure achievement rates, and evaluate effectiveness'
      },
      '5.4.3': {
        ar: 'تحسين استخدام الأدوات التقنية في أعمال منسوبي الجهة وتنظيم ورش التدريب وإنشاء قنوات الدعم التقني',
        en: 'Improve the use of technical tools in agency staff work, organize training workshops, and establish technical support channels'
      },
      '5.4.4': {
        ar: 'وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها',
        en: 'Develop strategies and plans for continuous development of digital culture in the agency, monitor implementation, and measure impact'
      }
    };

    const criteriaDesc = criteriaDescriptions[criteriaId as keyof typeof criteriaDescriptions];
    const description = criteriaDesc ? criteriaDesc[language] : 'Unknown criteria';

    const systemPrompt = language === 'ar' ? `
أنت خبير تدقيق متخصص في تقييم الامتثال لمعايير هيئة الحكومة الرقمية السعودية.

المتطلب ${criteriaId}: ${description}

قم بتحليل الأدلة المقدمة وتقييم مستوى الامتثال بعقلية إيجابية ومتوازنة:

معايير التقييم:
- وجود أدلة واضحة (40%)
- جودة وتفصيل الأدلة (30%) 
- التطبيق العملي (20%)
- التوثيق والمتابعة (10%)

نظام التقييم المحدث:
- "pass": 60+ نقطة - امتثال مقبول مع أدلة واضحة
- "partial": 30-59 نقطة - امتثال جزئي يحتاج تحسين
- "fail": أقل من 30 نقطة - عدم امتثال أو أدلة ضعيفة

كن إيجابياً ومشجعاً في تحليلك. ابحث عن نقاط القوة أولاً.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل ومتوازن يبرز نقاط القوة أولاً",
  "recommendations": ["توصية بناءة 1", "توصية بناءة 2", "توصية بناءة 3"]
}
` : `
You are an expert auditor specialized in evaluating compliance with Saudi Arabia's Digital Governance Authority standards.

Requirement ${criteriaId}: ${description}

Analyze the provided evidence and assess compliance level with a positive and balanced mindset:

Evaluation Criteria:
- Clear evidence presence (40%)
- Evidence quality and detail (30%)
- Practical implementation (20%)
- Documentation and monitoring (10%)

Updated Scoring System:
- "pass": 60+ points - Acceptable compliance with clear evidence
- "partial": 30-59 points - Partial compliance needing improvement
- "fail": Less than 30 points - Non-compliance or weak evidence

Be positive and encouraging in your analysis. Look for strengths first.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed and balanced analysis highlighting strengths first",
  "recommendations": ["constructive recommendation 1", "constructive recommendation 2", "constructive recommendation 3"]
}
`;

    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (${language === 'ar' ? 'الصلة' : 'Relevance'}: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لا توجد أدلة مباشرة' : 'No direct evidence found');

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
اللغة: ${metadata.language}
عدد الكلمات: ${metadata.wordCount}
ثقة الاستخراج: ${metadata.confidence}%

الأدلة المستخرجة:
${evidenceText}

قم بتقييم الامتثال للمتطلب ${criteriaId} بعقلية إيجابية.
` : `
Document: ${metadata.filename}
Language: ${metadata.language}
Word Count: ${metadata.wordCount}
Extraction Confidence: ${metadata.confidence}%

Extracted Evidence:
${evidenceText}

Evaluate compliance for requirement ${criteriaId} with a positive mindset.
`;

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }

  private parseResponse(content: string, criteriaId: string, evidence: Evidence[]): ComplianceScore {
    try {
      // Clean the content by removing markdown code block delimiters
      let cleanedContent = content.trim();
      
      // Remove leading ```json or ``` and trailing ```
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.substring(7);
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.substring(3);
      }
      
      if (cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3);
      }
      
      // Trim any remaining whitespace
      cleanedContent = cleanedContent.trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      return {
        criteriaId,
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        status: ['pass', 'fail', 'partial'].includes(parsed.status) ? parsed.status : 'fail',
        confidence: Math.max(70, Math.min(95, parsed.confidence || 75)),
        evidence,
        findings: parsed.findings || 'No detailed findings available',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : []
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      console.log('Raw response:', content);
      throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createFallbackScore(
    criteriaId: string, 
    evidence: Evidence[], 
    language: 'ar' | 'en',
    metadata: DocumentMetadata
  ): ComplianceScore {
    // Simple fallback scoring based on evidence
    const evidenceCount = evidence.length;
    const avgRelevance = evidence.length > 0 
      ? evidence.reduce((sum, e) => sum + e.relevance, 0) / evidence.length 
      : 0;

    let score = 0;
    let status: 'pass' | 'fail' | 'partial' = 'fail';

    if (evidenceCount >= 3 && avgRelevance > 0.7) {
      score = 75;
      status = 'pass';
    } else if (evidenceCount >= 2 && avgRelevance > 0.5) {
      score = 60;
      status = 'pass';
    } else if (evidenceCount >= 1 && avgRelevance > 0.4) {
      score = 45;
      status = 'partial';
    } else if (metadata.wordCount > 100) {
      score = 25;
      status = 'partial';
    } else {
      score = 15;
      status = 'fail';
    }

    const findings = language === 'ar' 
      ? `تم العثور على ${evidenceCount} دليل بمتوسط صلة ${Math.round(avgRelevance * 100)}%. الوثيقة تحتوي على ${metadata.wordCount} كلمة. التقييم الآلي بسبب عدم توفر التحليل المتقدم.`
      : `Found ${evidenceCount} evidence pieces with average relevance ${Math.round(avgRelevance * 100)}%. Document contains ${metadata.wordCount} words. Automated assessment due to unavailable advanced analysis.`;

    const recommendations = language === 'ar' 
      ? [
          'تحسين توثيق الأنشطة المتعلقة بالمتطلب',
          'إضافة تفاصيل أكثر حول التطبيق العملي',
          'تطوير آليات القياس والمتابعة'
        ]
      : [
          'Improve documentation of requirement-related activities',
          'Add more details about practical implementation',
          'Develop measurement and monitoring mechanisms'
        ];

    return {
      criteriaId,
      score,
      status,
      confidence: 70,
      evidence,
      findings,
      recommendations
    };
  }
}