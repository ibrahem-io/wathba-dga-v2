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

export async function checkApiKey(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}