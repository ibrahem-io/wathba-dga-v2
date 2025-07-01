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
  '5.4.1.1': {
    ar: `تحليل الوثيقة للمتطلب 5.4.1.1: دراسات وبرامج الوعي بالتحول الرقمي

ابحث عن:
- دراسات لتحديد مستوى وعي المنسوبين بالتحول الرقمي
- برامج لزيادة الوعي والثقافة الرقمية
- استطلاعات أو مسوحات للوعي الرقمي
- خطط لتطوير الثقافة الرقمية
- مؤشرات قياس مستوى الوعي

الكلمات المفتاحية: دراسة الوعي، التحول الرقمي، الثقافة الرقمية، مستوى الوعي، برامج التوعية`,
    en: `Analyze document for requirement 5.4.1.1: Digital Transformation Awareness Studies and Programs

Look for:
- Studies to determine staff digital transformation awareness levels
- Programs to increase digital awareness and culture
- Digital awareness surveys or assessments
- Digital culture development plans
- Awareness level measurement indicators

Keywords: awareness study, digital transformation, digital culture, awareness level, awareness programs`
  },
  '5.4.1.2': {
    ar: `تحليل الوثيقة للمتطلب 5.4.1.2: برامج توعوية للثقافة الرقمية

ابحث عن:
- برامج توعوية للمنسوبين
- أهمية عمليات التحول الرقمي
- تعزيز الثقافة الرقمية في بيئة العمل
- ورش عمل أو دورات تدريبية
- مواد توعوية أو تثقيفية

الكلمات المفتاحية: برامج توعوية، الثقافة الرقمية، بيئة العمل، التوعية، التثقيف الرقمي`,
    en: `Analyze document for requirement 5.4.1.2: Digital Culture Awareness Programs

Look for:
- Awareness programs for staff
- Importance of digital transformation processes
- Promoting digital culture in work environment
- Workshops or training courses
- Awareness or educational materials

Keywords: awareness programs, digital culture, work environment, awareness, digital education`
  },
  '5.4.2.1': {
    ar: `تحليل الوثيقة للمتطلب 5.4.2.1: تنفيذ برامج رفع الوعي وقياس الأثر

ابحث عن:
- تنفيذ البرامج المعتمدة
- قياس نسب الإنجاز
- مجالات التحول الرقمي
- مؤشرات الأداء
- تقييم الأثر والنتائج

الكلمات المفتاحية: تنفيذ البرامج، قياس الأثر، نسب الإنجاز، مؤشرات الأداء، التقييم`,
    en: `Analyze document for requirement 5.4.2.1: Implementation of Awareness Programs and Impact Measurement

Look for:
- Implementation of approved programs
- Measuring achievement rates
- Digital transformation areas
- Performance indicators
- Impact assessment and results

Keywords: program implementation, impact measurement, achievement rates, performance indicators, evaluation`
  },
  '5.4.2.2': {
    ar: `تحليل الوثيقة للمتطلب 5.4.2.2: تقييم وتحسين البرامج التوعوية

ابحث عن:
- تقييم فعالية البرامج التوعوية
- التحديث الدوري للبرامج
- التغذية الراجعة
- النتائج المحققة
- التحسين المستمر

الكلمات المفتاحية: تقييم الفعالية، التحديث الدوري، التغذية الراجعة، التحسين المستمر`,
    en: `Analyze document for requirement 5.4.2.2: Evaluation and Improvement of Awareness Programs

Look for:
- Evaluation of awareness program effectiveness
- Periodic program updates
- Feedback mechanisms
- Achieved results
- Continuous improvement

Keywords: effectiveness evaluation, periodic updates, feedback, continuous improvement`
  },
  '5.4.3.1': {
    ar: `تحليل الوثيقة للمتطلب 5.4.3.1: استخدام الأدوات التقنية في أعمال الجهة

ابحث عن:
- نسب الأدوات التقنية
- تحسين أعمال المنسوبين
- آليات أو توجيهات أو سياسات
- الأعمال اليومية
- الأدوات الرقمية

الكلمات المفتاحية: الأدوات التقنية، الأدوات الرقمية، آليات العمل، السياسات، الأعمال اليومية`,
    en: `Analyze document for requirement 5.4.3.1: Use of Technical Tools in Agency Operations

Look for:
- Technical tools ratios
- Improving staff work
- Mechanisms, guidelines, or policies
- Daily operations
- Digital tools

Keywords: technical tools, digital tools, work mechanisms, policies, daily operations`
  },
  '5.4.3.2': {
    ar: `تحليل الوثيقة للمتطلب 5.4.3.2: تنظيم ورش التدريب لدعم الأدوات الرقمية

ابحث عن:
- ورش التدريب للموظفين
- مختلف الوحدات والمستويات الإدارية
- زيادة الوعي بالتحول الرقمي
- سبل التنفيذ
- تعزيز الثقافة الرقمية

الكلمات المفتاحية: ورش التدريب، التدريب، الوحدات الإدارية، سبل التنفيذ، تعزيز الثقافة`,
    en: `Analyze document for requirement 5.4.3.2: Organizing Training Workshops for Digital Tools Support

Look for:
- Training workshops for employees
- Different units and administrative levels
- Increasing digital transformation awareness
- Implementation methods
- Promoting digital culture

Keywords: training workshops, training, administrative units, implementation methods, culture promotion`
  },
  '5.4.3.3': {
    ar: `تحليل الوثيقة للمتطلب 5.4.3.3: إنشاء قنوات الدعم التقني الفعالة

ابحث عن:
- قنوات الدعم التقني
- المتاحة للموظفين
- حل المشاكل التقنية
- الإرشادات اللازمة
- تعزيز استخدام الأدوات الرقمية

الكلمات المفتاحية: الدعم التقني، قنوات الدعم، المشاكل التقنية، الإرشادات، الأدوات الرقمية`,
    en: `Analyze document for requirement 5.4.3.3: Establishing Effective Technical Support Channels

Look for:
- Technical support channels
- Available to employees
- Solving technical problems
- Necessary guidance
- Enhancing digital tools usage

Keywords: technical support, support channels, technical problems, guidance, digital tools`
  },
  '5.4.3.4': {
    ar: `تحليل الوثيقة للمتطلب 5.4.3.4: قياس مستوى اعتماد الأدوات الرقمية

ابحث عن:
- قياس ومراقبة مستوى الاعتماد
- اعتماد الموظفين للأدوات الرقمية
- الأعمال اليومية
- مجالات التحسين
- الثقافة الرقمية

الكلمات المفتاحية: قياس الاعتماد، مراقبة الاستخدام، الأدوات الرقمية، مجالات التحسين`,
    en: `Analyze document for requirement 5.4.3.4: Measuring Digital Tools Adoption Level

Look for:
- Measuring and monitoring adoption level
- Employee adoption of digital tools
- Daily work activities
- Areas for improvement
- Digital culture

Keywords: adoption measurement, usage monitoring, digital tools, improvement areas`
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
- "pass": 70+ نقطة، يلبي المتطلب بشكل كامل
- "partial": 40-69 نقطة، يلبي المتطلب جزئياً
- "fail": أقل من 40 نقطة، لا يلبي المتطلب

أرجع استجابة JSON بهذا الهيكل:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["اقتباس1", "اقتباس2"],
  "findings": "تحليل مفصل باللغة العربية",
  "recommendations": ["توصية1", "توصية2"]
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
- "pass": 70+ points, fully meets requirement
- "partial": 40-69 points, partially meets requirement  
- "fail": Less than 40 points, does not meet requirement

Return a JSON response with this structure:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["quote1", "quote2"],
  "findings": "detailed analysis in English",
  "recommendations": ["recommendation1", "recommendation2"]
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

قم بتحليل الوثيقة المقدمة مقابل هذه المتطلبات المحددة:

5.4.1.1 - دراسات وبرامج الوعي بالتحول الرقمي
5.4.1.2 - برامج توعوية للثقافة الرقمية
5.4.2.1 - تنفيذ برامج رفع الوعي وقياس الأثر
5.4.2.2 - تقييم وتحسين البرامج التوعوية
5.4.3.1 - استخدام الأدوات التقنية في أعمال الجهة
5.4.3.2 - تنظيم ورش التدريب لدعم الأدوات الرقمية
5.4.3.3 - إنشاء قنوات الدعم التقني الفعالة
5.4.3.4 - قياس مستوى اعتماد الأدوات الرقمية

الكلمات المفتاحية العربية للبحث عنها:
- الثقافة الرقمية، التحول الرقمي، الوعي الرقمي
- التدريب، ورش العمل، البرامج التوعوية
- التنفيذ، التطبيق، القياس، التقييم
- الأدوات التقنية، الأدوات الرقمية، التقنيات الحديثة
- الدعم التقني، المساعدة التقنية، الإرشاد التقني
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
      "requirementId": "5.4.1.1",
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

Analyze the provided document against these specific requirements:

5.4.1.1 - Digital Transformation Awareness Studies and Programs
5.4.1.2 - Digital Culture Awareness Programs  
5.4.2.1 - Implementation of Awareness Programs and Impact Measurement
5.4.2.2 - Evaluation and Improvement of Awareness Programs
5.4.3.1 - Use of Technical Tools in Agency Operations
5.4.3.2 - Organizing Training Workshops for Digital Tools Support
5.4.3.3 - Establishing Effective Technical Support Channels
5.4.3.4 - Measuring Digital Tools Adoption Level

English keywords to search for:
- Digital culture, digital transformation, digital awareness
- Training, workshops, awareness programs
- Implementation, execution, measurement, evaluation
- Technical tools, digital tools, modern technologies
- Technical support, technical assistance, technical guidance
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
      "requirementId": "5.4.1.1",
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