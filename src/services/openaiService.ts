import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ComplianceAnalysis {
  requirementId: string;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

export interface AnalysisResult {
  overallScore: number;
  language: 'ar' | 'en';
  requirements: ComplianceAnalysis[];
  summary: string;
  criticalIssues: string[];
}

export interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

const CRITERIA_PROMPTS = {
  '5.4.1': {
    ar: `تحليل الوثيقة للمتطلب 5.4.1: دراسات وبرامج الوعي بالتحول الرقمي

ابحث عن:
- دراسات لتحديد مستوى وعي المنسوبين بالتحول الرقمي
- استطلاعات أو مسوحات للوعي الرقمي
- برامج توعوية للثقافة الرقمية
- خطط لتطوير الوعي الرقمي
- مؤشرات قياس مستوى الوعي
- مواد تثقيفية أو توعوية
- ورش عمل أو دورات تدريبية للوعي

الكلمات المفتاحية: دراسة الوعي، التحول الرقمي، الثقافة الرقمية، مستوى الوعي، برامج التوعية، استطلاع، مسح، تقييم الوعي، المواد التثقيفية`,
    en: `Analyze document for requirement 5.4.1: Digital Transformation Awareness Studies and Programs

Look for:
- Studies to determine staff digital transformation awareness levels
- Digital awareness surveys or assessments
- Digital culture awareness programs
- Digital awareness development plans
- Awareness level measurement indicators
- Educational or awareness materials
- Awareness workshops or training courses

Keywords: awareness study, digital transformation, digital culture, awareness level, awareness programs, survey, assessment, awareness evaluation, educational materials`
  },
  '5.4.2': {
    ar: `تحليل الوثيقة للمتطلب 5.4.2: تنفيذ وتقييم برامج رفع الوعي

ابحث عن:
- تنفيذ البرامج المعتمدة للتوعية
- قياس نسب الإنجاز والتقدم
- تقييم فعالية البرامج التوعوية
- التحديث الدوري للبرامج
- التغذية الراجعة من المشاركين
- مؤشرات الأداء والنتائج
- التحسين المستمر للبرامج
- تقارير التقييم والمتابعة

الكلمات المفتاحية: تنفيذ البرامج، قياس الأثر، نسب الإنجاز، تقييم الفعالية، التحديث الدوري، التغذية الراجعة، مؤشرات الأداء، التحسين المستمر`,
    en: `Analyze document for requirement 5.4.2: Implementation and Evaluation of Awareness Programs

Look for:
- Implementation of approved awareness programs
- Measuring achievement rates and progress
- Evaluation of awareness program effectiveness
- Periodic program updates
- Participant feedback
- Performance indicators and results
- Continuous program improvement
- Evaluation and monitoring reports

Keywords: program implementation, impact measurement, achievement rates, effectiveness evaluation, periodic updates, feedback, performance indicators, continuous improvement`
  },
  '5.4.3': {
    ar: `تحليل الوثيقة للمتطلب 5.4.3: استخدام ودعم الأدوات التقنية

ابحث عن:
- استخدام الأدوات التقنية في العمل اليومي
- ورش التدريب على الأدوات الرقمية
- قنوات الدعم التقني للموظفين
- قياس مستوى اعتماد الأدوات الرقمية
- آليات وسياسات استخدام التقنية
- حل المشاكل التقنية والإرشاد
- تعزيز استخدام الأدوات الرقمية
- مراقبة ومتابعة الاستخدام

الكلمات المفتاحية: الأدوات التقنية، الأدوات الرقمية، ورش التدريب، الدعم التقني، قياس الاعتماد، آليات العمل، السياسات التقنية، الإرشاد التقني`,
    en: `Analyze document for requirement 5.4.3: Use and Support of Technical Tools

Look for:
- Use of technical tools in daily work
- Training workshops on digital tools
- Technical support channels for employees
- Measuring digital tools adoption levels
- Mechanisms and policies for technology use
- Technical problem solving and guidance
- Enhancing digital tools usage
- Usage monitoring and follow-up

Keywords: technical tools, digital tools, training workshops, technical support, adoption measurement, work mechanisms, technical policies, technical guidance`
  },
  '5.4.4': {
    ar: `تحليل الوثيقة للمتطلب 5.4.4: التطوير المستمر للثقافة الرقمية

ابحث عن:
- استراتيجيات التطوير المستمر للثقافة الرقمية
- خطط طويلة المدى للثقافة الرقمية
- متابعة تطبيق الاستراتيجيات
- قياس أثر الثقافة الرقمية على الأداء
- التحسين المستمر للعمليات
- مراجعة وتحديث الاستراتيجيات
- مؤشرات النجاح والتقدم
- التطوير المؤسسي الرقمي

الكلمات المفتاحية: التطوير المستمر، استراتيجيات الثقافة الرقمية، خطط طويلة المدى، قياس الأثر، التحسين المستمر، مراجعة الاستراتيجيات، مؤشرات النجاح، التطوير المؤسسي`,
    en: `Analyze document for requirement 5.4.4: Continuous Development of Digital Culture

Look for:
- Continuous development strategies for digital culture
- Long-term digital culture plans
- Monitoring strategy implementation
- Measuring digital culture impact on performance
- Continuous process improvement
- Strategy review and updates
- Success indicators and progress metrics
- Digital institutional development

Keywords: continuous development, digital culture strategies, long-term plans, impact measurement, continuous improvement, strategy review, success indicators, institutional development`
  }
};

export async function analyzeDocumentForCriteria(
  documentText: string, 
  criteriaId: string, 
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  try {
    const prompt = CRITERIA_PROMPTS[criteriaId as keyof typeof CRITERIA_PROMPTS];
    if (!prompt) {
      throw new Error(`Unknown criteria ID: ${criteriaId}`);
    }

    const criteriaPrompt = prompt[language];
    
    const systemPrompt = language === 'ar' ? `
أنت خبير مدقق لمعيار هيئة الحكومة الرقمية السعودية 5.4 "الثقافة والبيئة الرقمية".

قم بتحليل الوثيقة المقدمة مقابل المتطلب المحدد فقط.

${criteriaPrompt}

قدم تحليلاً مفصلاً وموضوعياً. أعط نتيجة من 0-100 بناءً على:
- مدى تغطية المتطلب في الوثيقة (40%)
- جودة التنفيذ والتفاصيل (30%)
- وضوح الأدلة والمؤشرات (30%)

الحالة:
- "pass": 70+ نقطة، يلبي المتطلب بشكل كامل أو ممتاز
- "partial": 40-69 نقطة، يلبي المتطلب جزئياً أو بحاجة لتحسين
- "fail": أقل من 40 نقطة، لا يلبي المتطلب أو غير موجود

أرجع استجابة JSON بهذا الهيكل:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["اقتباس1", "اقتباس2", "اقتباس3"],
  "findings": "تحليل مفصل باللغة العربية يشرح مدى الامتثال والنقاط القوية والضعيفة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"]
}
` : `
You are an expert auditor for Saudi Arabia's Digital Governance Authority (DGA) Standard 5.4 "Digital Culture and Environment".

Analyze the provided document against the specific requirement only.

${criteriaPrompt}

Provide detailed and objective analysis. Give a score from 0-100 based on:
- Requirement coverage in document (40%)
- Implementation quality and details (30%)
- Evidence and indicators clarity (30%)

Status:
- "pass": 70+ points, fully or excellently meets requirement
- "partial": 40-69 points, partially meets requirement or needs improvement
- "fail": Less than 40 points, does not meet requirement or not present

Return a JSON response with this structure:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["quote1", "quote2", "quote3"],
  "findings": "detailed analysis in English explaining compliance level, strengths and weaknesses",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${language === 'ar' ? 'محتوى الوثيقة' : 'Document content'}:\n\n${documentText}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as CriteriaAnalysis;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(language === 'ar' 
      ? 'فشل في تحليل الوثيقة. يرجى التحقق من مفتاح API والمحاولة مرة أخرى.'
      : 'Failed to analyze document. Please check your API key and try again.');
  }
}

export async function analyzeDocument(documentText: string, language: 'ar' | 'en'): Promise<AnalysisResult> {
  try {
    const prompt = language === 'ar' ? DGA_STANDARD_PROMPT_AR : DGA_STANDARD_PROMPT_EN;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `${language === 'ar' ? 'يرجى تحليل هذه الوثيقة للامتثال لمعيار هيئة الحكومة الرقمية 5.4. لغة الوثيقة' : 'Please analyze this document for DGA Standard 5.4 compliance. Document language'}: ${language}\n\n${language === 'ar' ? 'محتوى الوثيقة' : 'Document content'}:\n${documentText}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as AnalysisResult;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(language === 'ar' 
      ? 'فشل في تحليل الوثيقة. يرجى التحقق من مفتاح API والمحاولة مرة أخرى.'
      : 'Failed to analyze document. Please check your API key and try again.');
  }
}

const DGA_STANDARD_PROMPT_AR = `
أنت خبير مدقق لمعيار هيئة الحكومة الرقمية السعودية 5.4 "الثقافة والبيئة الرقمية".

قم بتحليل الوثيقة المقدمة مقابل هذه المتطلبات الأساسية:

5.4.1 - دراسات وبرامج الوعي بالتحول الرقمي
5.4.2 - تنفيذ وتقييم برامج رفع الوعي
5.4.3 - استخدام ودعم الأدوات التقنية
5.4.4 - التطوير المستمر للثقافة الرقمية

الكلمات المفتاحية العربية للبحث عنها:
- الثقافة الرقمية، التحول الرقمي، الوعي الرقمي
- التدريب، ورش العمل، البرامج التوعوية
- التنفيذ، التطبيق، القياس، التقييم
- الأدوات التقنية، الأدوات الرقمية، التقنيات الحديثة
- الدعم التقني، المساعدة التقنية، الإرشاد التقني
- التطوير المستمر، الاستراتيجيات، التحسين
- المنسوبون، الموظفون، الكوادر البشرية
- الجهة الحكومية، المؤسسة، الوزارة

لكل متطلب، قدم:
1. الحالة: "pass" أو "fail" أو "partial"
2. درجة الثقة (0-100%)
3. اقتباسات الأدلة من الوثيقة
4. النتائج التفصيلية
5. توصيات محددة للتحسين

أرجع استجابة JSON بهذا الهيكل:
{
  "overallScore": number,
  "language": "ar",
  "requirements": [
    {
      "requirementId": "5.4.1",
      "status": "pass" | "fail" | "partial",
      "confidence": number,
      "evidence": ["اقتباس1", "اقتباس2"],
      "findings": "تحليل مفصل",
      "recommendations": ["توصية1", "توصية2"]
    }
  ],
  "summary": "تقييم شامل",
  "criticalIssues": ["قضية1", "قضية2"]
}

كن شاملاً وموضوعياً وقدم رؤى قابلة للتنفيذ. ادعم الوثائق العربية والإنجليزية.
`;

const DGA_STANDARD_PROMPT_EN = `
You are an expert auditor for Saudi Arabia's Digital Governance Authority (DGA) Standard 5.4 "Digital Culture and Environment".

Analyze the provided document against these main requirements:

5.4.1 - Digital Transformation Awareness Studies and Programs
5.4.2 - Implementation and Evaluation of Awareness Programs
5.4.3 - Use and Support of Technical Tools
5.4.4 - Continuous Development of Digital Culture

English keywords to search for:
- Digital culture, digital transformation, digital awareness
- Training, workshops, awareness programs
- Implementation, execution, measurement, evaluation
- Technical tools, digital tools, modern technologies
- Technical support, technical assistance, technical guidance
- Continuous development, strategies, improvement
- Staff, employees, human resources
- Government agency, institution, ministry

For each requirement, provide:
1. Status: "pass", "fail", or "partial"
2. Confidence score (0-100%)
3. Evidence quotes from the document
4. Detailed findings
5. Specific recommendations for improvement

Return a JSON response with this structure:
{
  "overallScore": number,
  "language": "en",
  "requirements": [
    {
      "requirementId": "5.4.1",
      "status": "pass" | "fail" | "partial",
      "confidence": number,
      "evidence": ["quote1", "quote2"],
      "findings": "detailed analysis",
      "recommendations": ["recommendation1", "recommendation2"]
    }
  ],
  "summary": "overall assessment",
  "criticalIssues": ["issue1", "issue2"]
}

Be thorough, objective, and provide actionable insights. Support both Arabic and English documents.
`;

export async function checkApiKey(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}