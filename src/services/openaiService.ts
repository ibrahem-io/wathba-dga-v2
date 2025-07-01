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

const DETAILED_CRITERIA_PROMPTS = {
  '5.4.1': {
    ar: `أنت خبير مدقق متخصص في المتطلب 5.4.1 فقط: "دراسات وبرامج الوعي بالتحول الرقمي"

المتطلب المحدد: إعداد دراسات لتحديد مستوى وعي منسوبي الجهة بعملية التحول الرقمي وإعداد البرامج التوعوية اللازمة لزيادة الوعي والثقافة الرقمية في بيئة العمل.

ابحث بدقة عن هذه العناصر المحددة:

الدراسات والمسوحات:
- دراسات تقييم مستوى الوعي الرقمي للموظفين
- استطلاعات أو مسوحات للثقافة الرقمية
- تقييمات أولية لمستوى المعرفة التقنية
- دراسات احتياجات التدريب الرقمي
- بحوث حول الفجوات في المهارات الرقمية

البرامج التوعوية:
- برامج تثقيفية حول التحول الرقمي
- ورش عمل للتوعية بالثقافة الرقمية
- حملات توعوية داخلية
- مواد تعليمية وإرشادية
- منصات التعلم الإلكتروني للتوعية

مؤشرات القياس:
- مقاييس مستوى الوعي قبل وبعد البرامج
- معايير تقييم فعالية البرامج التوعوية
- مؤشرات أداء للثقافة الرقمية

الكلمات المفتاحية الأساسية: دراسة الوعي، مسح الثقافة الرقمية، تقييم المعرفة، برامج التوعية، التثقيف الرقمي، حملات التوعية، مستوى الوعي، الفجوات المعرفية

تجاهل تماماً أي محتوى متعلق بـ:
- التنفيذ والتطبيق (هذا للمتطلب 5.4.2)
- الأدوات التقنية والدعم (هذا للمتطلب 5.4.3)
- الاستراتيجيات طويلة المدى (هذا للمتطلب 5.4.4)

ركز فقط على الدراسات والبرامج التوعوية الأولية.`,
    en: `You are an expert auditor specialized in requirement 5.4.1 ONLY: "Digital Transformation Awareness Studies and Programs"

Specific Requirement: Conduct studies to determine agency staff awareness levels of digital transformation and develop necessary awareness programs to increase digital awareness and culture in the work environment.

Search precisely for these specific elements:

Studies and Surveys:
- Digital awareness assessment studies for employees
- Digital culture surveys or assessments
- Initial evaluations of technical knowledge levels
- Digital training needs studies
- Research on digital skills gaps

Awareness Programs:
- Educational programs about digital transformation
- Digital culture awareness workshops
- Internal awareness campaigns
- Educational and guidance materials
- E-learning platforms for awareness

Measurement Indicators:
- Awareness level metrics before and after programs
- Effectiveness evaluation criteria for awareness programs
- Digital culture performance indicators

Key Keywords: awareness study, digital culture survey, knowledge assessment, awareness programs, digital education, awareness campaigns, awareness level, knowledge gaps

Completely ignore any content related to:
- Implementation and execution (this is for requirement 5.4.2)
- Technical tools and support (this is for requirement 5.4.3)
- Long-term strategies (this is for requirement 5.4.4)

Focus ONLY on initial studies and awareness programs.`
  },
  '5.4.2': {
    ar: `أنت خبير مدقق متخصص في المتطلب 5.4.2 فقط: "تنفيذ وتقييم برامج رفع الوعي"

المتطلب المحدد: تنفيذ البرامج المعتمدة لزيادة وعي منسوبي الجهة بعملية التحول الرقمي وقياس نسب إنجازها وتقييم فعاليتها وتحديثها بشكل دوري.

ابحث بدقة عن هذه العناصر المحددة:

التنفيذ الفعلي:
- تطبيق البرامج التوعوية المعتمدة
- تنفيذ الخطط التدريبية
- إجراء ورش العمل والدورات
- تفعيل الحملات التوعوية
- تشغيل منصات التعلم

القياس والمتابعة:
- قياس نسب الإنجاز والمشاركة
- تتبع معدلات الحضور والمشاركة
- مراقبة التقدم في البرامج
- إحصائيات الأداء والنتائج
- تقارير دورية عن التقدم

التقييم والفعالية:
- تقييم أثر البرامج على الوعي
- قياس فعالية الأنشطة التوعوية
- تحليل النتائج والمخرجات
- تقييم رضا المشاركين
- دراسات ما بعد التدريب

التحديث والتطوير:
- تحديث المحتوى التدريبي
- تطوير البرامج بناءً على التغذية الراجعة
- تحسين الأساليب والطرق
- تعديل الخطط حسب النتائج

الكلمات المفتاحية الأساسية: تنفيذ البرامج، تطبيق الخطط، قياس الإنجاز، نسب المشاركة، تقييم الفعالية، التحديث الدوري، مراقبة التقدم، تحليل النتائج

تجاهل تماماً أي محتوى متعلق بـ:
- الدراسات الأولية (هذا للمتطلب 5.4.1)
- الأدوات التقنية (هذا للمتطلب 5.4.3)
- الاستراتيجيات المستقبلية (هذا للمتطلب 5.4.4)

ركز فقط على التنفيذ الفعلي والتقييم والمتابعة.`,
    en: `You are an expert auditor specialized in requirement 5.4.2 ONLY: "Implementation and Evaluation of Awareness Programs"

Specific Requirement: Implement approved programs to increase agency staff awareness of digital transformation, measure achievement rates, evaluate effectiveness, and update them periodically.

Search precisely for these specific elements:

Actual Implementation:
- Execution of approved awareness programs
- Implementation of training plans
- Conducting workshops and courses
- Activating awareness campaigns
- Operating learning platforms

Measurement and Monitoring:
- Measuring achievement and participation rates
- Tracking attendance and participation rates
- Monitoring progress in programs
- Performance statistics and results
- Periodic progress reports

Evaluation and Effectiveness:
- Evaluating program impact on awareness
- Measuring effectiveness of awareness activities
- Analyzing results and outputs
- Evaluating participant satisfaction
- Post-training studies

Updates and Development:
- Updating training content
- Developing programs based on feedback
- Improving methods and approaches
- Modifying plans based on results

Key Keywords: program implementation, plan execution, achievement measurement, participation rates, effectiveness evaluation, periodic updates, progress monitoring, results analysis

Completely ignore any content related to:
- Initial studies (this is for requirement 5.4.1)
- Technical tools (this is for requirement 5.4.3)
- Future strategies (this is for requirement 5.4.4)

Focus ONLY on actual implementation, evaluation, and monitoring.`
  },
  '5.4.3': {
    ar: `أنت خبير مدقق متخصص في المتطلب 5.4.3 فقط: "استخدام ودعم الأدوات التقنية"

المتطلب المحدد: تحسين استخدام الأدوات التقنية في أعمال منسوبي الجهة وتنظيم ورش التدريب وإنشاء قنوات الدعم التقني وقياس مستوى اعتماد الأدوات الرقمية.

ابحث بدقة عن هذه العناصر المحددة:

الأدوات التقنية والرقمية:
- أنظمة إدارة المحتوى والوثائق
- منصات التعاون والتواصل الرقمي
- أدوات الإنتاجية والمكتب الرقمي
- تطبيقات الهاتف المحمول للعمل
- أنظمة إدارة المشاريع الرقمية
- أدوات التحليل والتقارير

التدريب على الأدوات:
- ورش تدريبية على الأدوات التقنية
- دورات استخدام البرمجيات
- تدريب على المنصات الرقمية
- برامج تطوير المهارات التقنية
- جلسات التدريب العملي

الدعم التقني:
- مراكز الدعم التقني
- خطوط المساعدة التقنية
- فرق الدعم الفني
- أدلة الاستخدام والمساعدة
- منصات الدعم الذاتي
- تذاكر الدعم وحل المشاكل

قياس الاعتماد:
- إحصائيات استخدام الأدوات
- معدلات اعتماد التقنيات الجديدة
- مؤشرات الاستخدام الفعال
- تقييم مستوى الكفاءة التقنية
- مراقبة الأداء التقني

الكلمات المفتاحية الأساسية: الأدوات التقنية، البرمجيات، المنصات الرقمية، التدريب التقني، الدعم الفني، المساعدة التقنية، اعتماد الأدوات، الاستخدام الفعال

تجاهل تماماً أي محتوى متعلق بـ:
- الدراسات والبرامج التوعوية (هذا للمتطلب 5.4.1)
- التنفيذ والتقييم العام (هذا للمتطلب 5.4.2)
- الاستراتيجيات والتطوير المستقبلي (هذا للمتطلب 5.4.4)

ركز فقط على الأدوات التقنية واستخدامها ودعمها.`,
    en: `You are an expert auditor specialized in requirement 5.4.3 ONLY: "Use and Support of Technical Tools"

Specific Requirement: Improve the use of technical tools in agency staff work, organize training workshops, establish technical support channels, and measure digital tools adoption levels.

Search precisely for these specific elements:

Technical and Digital Tools:
- Content and document management systems
- Digital collaboration and communication platforms
- Productivity and digital office tools
- Mobile applications for work
- Digital project management systems
- Analysis and reporting tools

Tool Training:
- Technical tools training workshops
- Software usage courses
- Digital platform training
- Technical skills development programs
- Hands-on training sessions

Technical Support:
- Technical support centers
- Technical helplines
- Technical support teams
- User guides and help documentation
- Self-service support platforms
- Support tickets and problem resolution

Adoption Measurement:
- Tool usage statistics
- New technology adoption rates
- Effective usage indicators
- Technical competency assessment
- Technical performance monitoring

Key Keywords: technical tools, software, digital platforms, technical training, technical support, technical assistance, tool adoption, effective usage

Completely ignore any content related to:
- Studies and awareness programs (this is for requirement 5.4.1)
- General implementation and evaluation (this is for requirement 5.4.2)
- Strategies and future development (this is for requirement 5.4.4)

Focus ONLY on technical tools, their usage, and support.`
  },
  '5.4.4': {
    ar: `أنت خبير مدقق متخصص في المتطلب 5.4.4 فقط: "التطوير المستمر للثقافة الرقمية"

المتطلب المحدد: وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها على الأداء العام والتحسين المستمر.

ابحث بدقة عن هذه العناصر المحددة:

الاستراتيجيات والخطط:
- استراتيجية الثقافة الرقمية طويلة المدى
- خطط التطوير المستقبلية
- رؤية الجهة للتحول الرقمي
- أهداف استراتيجية للثقافة الرقمية
- خارطة طريق التطوير الرقمي

المتابعة والتطبيق:
- آليات متابعة تنفيذ الاستراتيجيات
- لجان الإشراف على التطوير
- تقارير دورية عن التقدم
- مراجعات استراتيجية منتظمة
- تحديث الخطط والأهداف

قياس الأثر:
- مؤشرات أداء الثقافة الرقمية
- قياس أثر التحول على الإنتاجية
- تحليل العائد على الاستثمار الرقمي
- مقاييس النضج الرقمي للمؤسسة
- تقييم التحسن في الأداء العام

التحسين المستمر:
- عمليات التحسين المستمر
- تطوير القدرات المؤسسية
- تحديث الممارسات والعمليات
- الابتكار في الحلول الرقمية
- التعلم من أفضل الممارسات

الكلمات المفتاحية الأساسية: استراتيجية الثقافة الرقمية، خطط التطوير، التحسين المستمر، قياس الأثر، النضج الرقمي، التطوير المؤسسي، الابتكار الرقمي

تجاهل تماماً أي محتوى متعلق بـ:
- الدراسات الأولية (هذا للمتطلب 5.4.1)
- التنفيذ قصير المدى (هذا للمتطلب 5.4.2)
- الأدوات التقنية المحددة (هذا للمتطلب 5.4.3)

ركز فقط على الاستراتيجيات طويلة المدى والتطوير المستمر.`,
    en: `You are an expert auditor specialized in requirement 5.4.4 ONLY: "Continuous Development of Digital Culture"

Specific Requirement: Develop strategies and plans for continuous development of digital culture in the agency, monitor their implementation, and measure their impact on overall performance and continuous improvement.

Search precisely for these specific elements:

Strategies and Plans:
- Long-term digital culture strategy
- Future development plans
- Agency's digital transformation vision
- Strategic objectives for digital culture
- Digital development roadmap

Monitoring and Implementation:
- Mechanisms for monitoring strategy implementation
- Development oversight committees
- Periodic progress reports
- Regular strategic reviews
- Plan and objective updates

Impact Measurement:
- Digital culture performance indicators
- Measuring transformation impact on productivity
- Digital investment return analysis
- Organizational digital maturity metrics
- Overall performance improvement assessment

Continuous Improvement:
- Continuous improvement processes
- Institutional capacity development
- Practice and process updates
- Innovation in digital solutions
- Learning from best practices

Key Keywords: digital culture strategy, development plans, continuous improvement, impact measurement, digital maturity, institutional development, digital innovation

Completely ignore any content related to:
- Initial studies (this is for requirement 5.4.1)
- Short-term implementation (this is for requirement 5.4.2)
- Specific technical tools (this is for requirement 5.4.3)

Focus ONLY on long-term strategies and continuous development.`
  }
};

export async function analyzeDocumentForCriteria(
  documentText: string, 
  criteriaId: string, 
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  try {
    const prompt = DETAILED_CRITERIA_PROMPTS[criteriaId as keyof typeof DETAILED_CRITERIA_PROMPTS];
    if (!prompt) {
      throw new Error(`Unknown criteria ID: ${criteriaId}`);
    }

    const criteriaPrompt = prompt[language];
    
    const systemPrompt = language === 'ar' ? `
${criteriaPrompt}

قم بتحليل الوثيقة المقدمة مقابل هذا المتطلب المحدد فقط. لا تخلط بين المتطلبات المختلفة.

معايير التقييم الدقيقة:
- التغطية الكاملة للمتطلب (40%): هل تغطي الوثيقة جميع جوانب هذا المتطلب المحدد؟
- جودة التنفيذ والتفاصيل (30%): هل التنفيذ مفصل وواضح ومناسب؟
- وضوح الأدلة والمؤشرات (30%): هل توجد أدلة واضحة وقابلة للقياس؟

نظام التقييم:
- "pass": 70+ نقطة - يلبي المتطلب بشكل كامل أو ممتاز مع أدلة واضحة
- "partial": 40-69 نقطة - يلبي المتطلب جزئياً أو بحاجة لتحسين
- "fail": أقل من 40 نقطة - لا يلبي المتطلب أو غير موجود أو غير واضح

تأكد من أن تحليلك يركز فقط على المتطلب المحدد ولا يتأثر بمحتوى متطلبات أخرى.

أرجع استجابة JSON بهذا الهيكل:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["اقتباس محدد 1", "اقتباس محدد 2", "اقتباس محدد 3"],
  "findings": "تحليل مفصل باللغة العربية يشرح بدقة مدى تلبية هذا المتطلب المحدد فقط، مع ذكر النقاط القوية والضعيفة والأدلة الموجودة",
  "recommendations": ["توصية محددة وقابلة للتنفيذ 1", "توصية محددة وقابلة للتنفيذ 2", "توصية محددة وقابلة للتنفيذ 3"]
}
` : `
${criteriaPrompt}

Analyze the provided document against this specific requirement only. Do not mix different requirements.

Precise Evaluation Criteria:
- Complete requirement coverage (40%): Does the document cover all aspects of this specific requirement?
- Implementation quality and details (30%): Is the implementation detailed, clear, and appropriate?
- Evidence and indicators clarity (30%): Are there clear and measurable evidence?

Scoring System:
- "pass": 70+ points - Fully or excellently meets the requirement with clear evidence
- "partial": 40-69 points - Partially meets the requirement or needs improvement
- "fail": Less than 40 points - Does not meet the requirement, absent, or unclear

Ensure your analysis focuses only on the specified requirement and is not influenced by content from other requirements.

Return a JSON response with this structure:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (0-100),
  "evidence": ["specific quote 1", "specific quote 2", "specific quote 3"],
  "findings": "detailed analysis in English explaining precisely how this specific requirement is met, mentioning strengths, weaknesses, and existing evidence",
  "recommendations": ["specific actionable recommendation 1", "specific actionable recommendation 2", "specific actionable recommendation 3"]
}
`;

    // Limit document text to prevent token overflow
    const maxTextLength = 40000; // Reduced further to ensure response fits
    let limitedText = documentText;
    if (documentText.length > maxTextLength) {
      limitedText = documentText.substring(0, maxTextLength) + '\n\n[Text truncated due to length...]';
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${language === 'ar' ? 'محتوى الوثيقة للتحليل مقابل المتطلب' : 'Document content for analysis against requirement'} ${criteriaId}:\n\n${limitedText}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2500, // Increased from 1500 to 2500
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('Empty response from OpenAI API');
    }

    let result;
    try {
      result = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Response content:', responseContent);
      throw new Error('Invalid JSON response from OpenAI API');
    }
    
    // Validate the result has required fields with default values
    const validatedResult: CriteriaAnalysis = {
      score: typeof result.score === 'number' ? result.score : 0,
      status: ['pass', 'fail', 'partial'].includes(result.status) ? result.status : 'fail',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0,
      evidence: Array.isArray(result.evidence) ? result.evidence : [],
      findings: typeof result.findings === 'string' ? result.findings : 'No analysis available',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : []
    };

    // Additional validation to ensure we have meaningful data
    if (!validatedResult.findings || validatedResult.findings === 'No analysis available') {
      throw new Error('Analysis result missing required findings');
    }
    
    return validatedResult;
  } catch (error) {
    console.error('OpenAI API Error for criteria', criteriaId, ':', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        throw new Error(language === 'ar' 
          ? 'خطأ في تحليل استجابة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.'
          : 'Error parsing AI response. Please try again.');
      } else if (error.message.includes('API')) {
        throw new Error(language === 'ar' 
          ? 'فشل في الاتصال بخدمة الذكاء الاصطناعي. يرجى التحقق من مفتاح API.'
          : 'Failed to connect to AI service. Please check your API key.');
      }
    }
    
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