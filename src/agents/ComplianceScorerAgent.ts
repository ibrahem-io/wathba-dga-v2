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
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 2000,
        openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
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
      const prompt = this.buildPrompt(criteriaId, language, documentMetadata, evidence);
      
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];

      const response = await this.llm.invoke(messages);
      const result = this.parseResponse(response.content as string, criteriaId, evidence);

      console.log(`Compliance scoring completed for criteria ${criteriaId}: ${result.status} (${result.score}%)`);
      return result;

    } catch (error) {
      console.error(`Compliance scoring failed for criteria ${criteriaId}:`, error);
      
      // Fallback scoring based on evidence count and relevance
      return this.createFallbackScore(criteriaId, evidence, language);
    }
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

قم بتحليل الأدلة المقدمة وتقييم مستوى الامتثال:

معايير التقييم:
- وجود أدلة واضحة (40%)
- جودة وتفصيل الأدلة (30%) 
- التطبيق العملي (20%)
- التوثيق والمتابعة (10%)

نظام التقييم:
- "pass": 70+ نقطة - امتثال كامل مع أدلة قوية
- "partial": 40-69 نقطة - امتثال جزئي يحتاج تحسين
- "fail": أقل من 40 نقطة - عدم امتثال أو أدلة ضعيفة

أرجع استجابة JSON بهذا الهيكل:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل للأدلة",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"]
}
` : `
You are an expert auditor specialized in evaluating compliance with Saudi Arabia's Digital Governance Authority standards.

Requirement ${criteriaId}: ${description}

Analyze the provided evidence and assess compliance level:

Evaluation Criteria:
- Clear evidence presence (40%)
- Evidence quality and detail (30%)
- Practical implementation (20%)
- Documentation and monitoring (10%)

Scoring System:
- "pass": 70+ points - Full compliance with strong evidence
- "partial": 40-69 points - Partial compliance needing improvement
- "fail": Less than 40 points - Non-compliance or weak evidence

Return a JSON response with this structure:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis of evidence",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}
`;

    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (${language === 'ar' ? 'الصلة' : 'Relevance'}: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لا توجد أدلة مباشرة' : 'No direct evidence found');

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
اللغة: ${metadata.language}
عدد الكلمات: ${metadata.wordCount}

الأدلة المستخرجة:
${evidenceText}

قم بتقييم الامتثال للمتطلب ${criteriaId}.
` : `
Document: ${metadata.filename}
Language: ${metadata.language}
Word Count: ${metadata.wordCount}

Extracted Evidence:
${evidenceText}

Evaluate compliance for requirement ${criteriaId}.
`;

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }

  private parseResponse(content: string, criteriaId: string, evidence: Evidence[]): ComplianceScore {
    try {
      const parsed = JSON.parse(content);
      
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
      return this.createFallbackScore(criteriaId, evidence, 'en');
    }
  }

  private createFallbackScore(criteriaId: string, evidence: Evidence[], language: 'ar' | 'en'): ComplianceScore {
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
    } else if (evidenceCount >= 1 && avgRelevance > 0.5) {
      score = 55;
      status = 'partial';
    } else {
      score = 25;
      status = 'fail';
    }

    const findings = language === 'ar' 
      ? `تم العثور على ${evidenceCount} دليل بمتوسط صلة ${Math.round(avgRelevance * 100)}%. التقييم الآلي بسبب عدم توفر التحليل المتقدم.`
      : `Found ${evidenceCount} evidence pieces with average relevance ${Math.round(avgRelevance * 100)}%. Automated assessment due to unavailable advanced analysis.`;

    const recommendations = language === 'ar' 
      ? ['تحسين توثيق الأنشطة', 'إضافة تفاصيل أكثر', 'تطوير آليات القياس']
      : ['Improve activity documentation', 'Add more details', 'Develop measurement mechanisms'];

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