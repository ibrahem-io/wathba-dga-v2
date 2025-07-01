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

      // Use gpt-4o for enhanced document analysis
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
      console.log(`🔍 Starting compliance scoring for criteria ${criteriaId}`);
      console.log(`📄 Document: ${documentMetadata.filename} (${documentMetadata.wordCount} words, ${documentMetadata.confidence}% confidence)`);
      console.log(`🔍 Evidence pieces: ${evidence.length}`);
      console.log(`📁 File type: ${documentMetadata.fileType}`);

      // Only use Vision API for actual image files, not PDFs
      const shouldUseVision = this.shouldUseVisionAPI(documentMetadata);
      console.log(`👁️ Using Vision API: ${shouldUseVision}`);

      const result = shouldUseVision && documentMetadata.base64Image
        ? await this.analyzeWithVision(documentMetadata, criteriaId, language, evidence)
        : await this.analyzeWithText(documentMetadata, criteriaId, language, evidence);

      console.log(`✅ Compliance scoring completed for criteria ${criteriaId}: ${result.status} (${result.score}%)`);
      return result;

    } catch (error) {
      console.error(`❌ Compliance scoring failed for criteria ${criteriaId}:`, error);
      
      // Create a fallback score with error information
      return this.createErrorScore(criteriaId, evidence, language, documentMetadata, error);
    }
  }

  private shouldUseVisionAPI(metadata: DocumentMetadata): boolean {
    // Only use Vision API for actual image files, not PDFs
    const imageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp'
    ];
    
    return imageTypes.includes(metadata.fileType) && metadata.isVisualDocument;
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

    const systemPrompt = this.getDetailedAuditPrompt(criteriaId, language);
    
    // Include evidence context if available
    const evidenceText = evidence.length > 0 
      ? evidence.map((e, i) => `${i + 1}. ${e.text} (صلة: ${Math.round(e.relevance * 100)}%)`).join('\n')
      : (language === 'ar' ? 'لا توجد أدلة مباشرة مستخرجة مسبقاً' : 'No direct evidence extracted previously');

    const userPrompt = language === 'ar' ? `
الوثيقة: ${metadata.filename}
نوع الملف: ${metadata.fileType}
حجم الملف: ${this.formatFileSize(metadata.fileSize)}

الأدلة المستخرجة مسبقاً (إن وجدت):
${evidenceText}

يرجى تحليل هذه الصورة بعناية للبحث عن أي دليل على الامتثال للمتطلب ${criteriaId} وفقاً للإرشادات التفصيلية المحددة.

تعليمات مهمة للتحليل البصري:
1. اقرأ النص الموجود في الصورة بعناية
2. ابحث عن أي إشارة أو دليل حتى لو كان غير مباشر
3. استخدم السياق العام للوثيقة لفهم المحتوى
4. كن متساهلاً في التقييم - أي إشارة للموضوع تعتبر إيجابية
5. إذا كان النص غير واضح، ركز على الكلمات المفتاحية والمفاهيم العامة
6. قدم تحليلاً مفصلاً حتى لو كانت الأدلة محدودة
7. اذكر النص الفعلي الذي تم العثور عليه في الصورة
` : `
Document: ${metadata.filename}
File Type: ${metadata.fileType}
File Size: ${this.formatFileSize(metadata.fileSize)}

Previously extracted evidence (if any):
${evidenceText}

Please carefully analyze this image for any evidence of compliance with requirement ${criteriaId} according to the detailed guidelines specified.

Important instructions for visual analysis:
1. Read the text in the image carefully
2. Look for any indication or evidence even if indirect
3. Use the general context of the document to understand content
4. Be lenient in evaluation - any reference to the topic counts as positive
5. If text is unclear, focus on keywords and general concepts
6. Provide detailed analysis even if evidence is limited
7. Mention the actual text found in the image
`;

    // Create message with image - use proper MIME type
    const imageUrl = `data:${metadata.fileType};base64,${metadata.base64Image}`;
    
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage({
        content: [
          {
            type: "text",
            text: userPrompt
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      })
    ];

    const response = await this.llm.invoke(messages);
    return this.parseResponse(response.content as string, criteriaId, evidence, metadata);
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

    // Handle special cases where document has limited text content
    let textToAnalyze = metadata.extractedText;
    let analysisNote = '';

    if (textToAnalyze === '[IMAGE_FILE_FOR_VISION_API]') {
      // This shouldn't happen in text analysis, but handle it gracefully
      const fallbackMessage = language === 'ar' 
        ? `هذا ملف صورة (${metadata.filename}) يجب معالجته بـ Vision API.`
        : `This is an image file (${metadata.filename}) that should be processed with Vision API.`;
      textToAnalyze = fallbackMessage;
      analysisNote = language === 'ar' ? 'ملف صورة' : 'Image file';
    } else if (textToAnalyze === '[PDF_WITH_LIMITED_TEXT_CONTENT]' || textToAnalyze.trim().length < 20) {
      // For PDFs that couldn't be text-extracted, provide a helpful message
      const fallbackMessage = language === 'ar' 
        ? `هذه وثيقة PDF (${metadata.filename}) مع محتوى نصي محدود. قد تكون وثيقة ممسوحة ضوئياً أو تحتوي على صور بشكل أساسي. يرجى تحليل المحتوى بناءً على نوع الملف والسياق المتاح والأدلة المستخرجة.`
        : `This is a PDF document (${metadata.filename}) with limited text content. It may be a scanned document or primarily contain images. Please analyze based on file type, available context, and extracted evidence.`;
      
      textToAnalyze = fallbackMessage;
      analysisNote = language === 'ar' ? 'PDF مع محتوى محدود' : 'PDF with limited content';
    }

    // Limit text to prevent token overflow but keep more content for better analysis
    const maxTextLength = 12000;
    if (textToAnalyze.length > maxTextLength) {
      textToAnalyze = textToAnalyze.substring(0, maxTextLength) + '...';
    }

    // Include evidence in the analysis
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

تعليمات مهمة:
1. ابحث عن أي إشارة أو دليل حتى لو كان غير مباشر
2. استخدم السياق العام للوثيقة لفهم المحتوى
3. كن متساهلاً في التقييم - أي إشارة للموضوع تعتبر إيجابية
4. إذا كان النص محدود، ركز على نوع الوثيقة والسياق المتاح
5. قدم تحليلاً مفصلاً حتى لو كانت الأدلة محدودة
6. استخدم الأدلة المستخرجة كمرجع إضافي
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

Important instructions:
1. Look for any indication or evidence even if indirect
2. Use the general context of the document to understand content
3. Be lenient in evaluation - any reference to the topic counts as positive
4. If text is limited, focus on document type and available context
5. Provide detailed analysis even if evidence is limited
6. Use extracted evidence as additional reference
`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt)
    ];

    const response = await this.llm.invoke(messages);
    return this.parseResponse(response.content as string, criteriaId, evidence, metadata);
  }

  private getDetailedAuditPrompt(criteriaId: string, language: 'ar' | 'en'): string {
    const prompts = {
      '5.4.1': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.1: "إعداد دراسات وبرامج لتعزيز الثقافة والبيئة الرقمية"

الهدف: تحديد مستوى وعي منسوبي الجهة الحكومية بالتحول الرقمي وإعداد الدراسات والبرامج اللازمة لزيادة هذا الوعي.

إطار التقييم الشامل:

المتطلب الأول: دراسة الوعي بالتحول الرقمي
ابحث عن أي إشارة إلى:
- دراسات أو تقييمات أو مسوحات
- تحليل الوعي أو المعرفة أو المهارات
- التحول الرقمي أو الرقمنة أو التقنية
- فهم أو إدراك أو وعي الموظفين
- خطط أو مبادرات أو مشاريع رقمية
- فجوات أو احتياجات تدريبية

المتطلب الثاني: تطوير برامج التوعية
ابحث عن أي إشارة إلى:
- برامج تدريبية أو توعوية أو تطويرية
- ورش عمل أو دورات أو جلسات تدريب
- مجموعات مستهدفة أو فئات موظفين
- استراتيجيات تواصل أو تنفيذ
- جداول زمنية أو خطط تنفيذ

معايير التقييم المتساهلة:
✅ مطابق (80-100%): وجود إشارات واضحة لمعظم العناصر
⚠️ مطابق جزئياً (40-79%): وجود بعض الإشارات أو العناصر
❌ غير مطابق (0-39%): عدم وجود إشارات واضحة

الكلمات المفتاحية للبحث (كن مرناً في البحث):
دراسة، تحليل، تقييم، مسح، استطلاع، الوعي، المعرفة، التحول، الرقمي، التقنية، الرقمنة، برنامج، تدريب، تطوير، ورشة، دورة، موظف، منسوب، مهارة، ثقافة

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

Comprehensive Assessment Framework:

Requirement 1: Digital Transformation Awareness Study
Look for any reference to:
- Studies, assessments, or surveys
- Analysis of awareness, knowledge, or skills
- Digital transformation, digitization, or technology
- Employee understanding, perception, or awareness
- Digital plans, initiatives, or projects
- Gaps or training needs

Requirement 2: Awareness Programs Development
Look for any reference to:
- Training, awareness, or development programs
- Workshops, courses, or training sessions
- Target groups or employee categories
- Communication or implementation strategies
- Timelines or implementation plans

Lenient Evaluation Criteria:
✅ COMPLIANT (80-100%): Clear references to most elements
⚠️ PARTIALLY COMPLIANT (40-79%): Some references or elements present
❌ NON-COMPLIANT (0-39%): No clear references

Keywords to search for (be flexible):
study, analysis, assessment, survey, awareness, knowledge, transformation, digital, technology, digitization, program, training, development, workshop, course, employee, staff, skill, culture

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

الهدف: تنفيذ البرامج المعتمدة لزيادة وعي الموظفين بالتحول الرقمي وقياس أثر هذه البرامج.

ابحث عن أي إشارة إلى:

التنفيذ والتطبيق:
- تنفيذ أو تطبيق أو تطبق أو ينفذ
- أنشطة أو فعاليات أو مبادرات منفذة
- برامج أو ورش أو دورات تم تقديمها
- مشاركة أو حضور أو تفاعل الموظفين

القياس والمتابعة:
- قياس أو تقييم أو مراجعة
- مؤشرات أو نسب أو إحصائيات
- نتائج أو تقارير أو تقدم
- فعالية أو أثر أو تأثير

التدريب والتوعية:
- ورش عمل أو دورات تدريبية
- جلسات توعية أو تثقيف
- محتوى تدريبي أو مواد تعليمية
- مدربين أو محاضرين

القيادة والإشراف:
- مشاركة القيادة أو الإدارة العليا
- إشراف أو متابعة أو توجيه
- لجان أو فرق عمل
- تقارير إدارية أو محاضر اجتماعات

معايير التقييم المتساهلة:
✅ مطابق (70-100%): وجود إشارات للتنفيذ والقياس
⚠️ مطابق جزئياً (35-69%): وجود إشارات للتنفيذ أو القياس
❌ غير مطابق (0-34%): عدم وجود إشارات واضحة

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

Objective: Implement approved programs to increase employee awareness of digital transformation and measure the impact of these programs.

Look for any reference to:

Implementation and Application:
- Implementation, execution, or application
- Activities, events, or implemented initiatives
- Programs, workshops, or courses delivered
- Employee participation, attendance, or engagement

Measurement and Monitoring:
- Measurement, evaluation, or review
- Indicators, rates, or statistics
- Results, reports, or progress
- Effectiveness, impact, or influence

Training and Awareness:
- Workshops or training courses
- Awareness or education sessions
- Training content or educational materials
- Trainers or instructors

Leadership and Supervision:
- Leadership or senior management participation
- Supervision, monitoring, or guidance
- Committees or working teams
- Management reports or meeting minutes

Lenient Evaluation Criteria:
✅ COMPLIANT (70-100%): References to implementation and measurement
⚠️ PARTIALLY COMPLIANT (35-69%): References to implementation or measurement
❌ NON-COMPLIANT (0-34%): No clear references

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

الهدف: تعزيز اعتماد الأدوات التقنية لتحسين أداء العمل اليومي والروتيني للموظفين.

ابحث عن أي إشارة إلى:

الأدوات والتقنيات:
- أدوات تقنية أو رقمية أو إلكترونية
- أنظمة أو برمجيات أو تطبيقات
- منصات أو حلول تقنية
- تقنيات أو تكنولوجيا

الاستخدام والاعتماد:
- استخدام أو اعتماد أو تطبيق
- تشغيل أو تفعيل أو تنفيذ
- الاستفادة من أو العمل بـ
- تحسين أو تطوير الأداء

التدريب والدعم:
- تدريب على الأدوات أو الأنظمة
- دعم تقني أو مساعدة فنية
- ورش عمل تقنية أو دورات
- إرشادات أو أدلة استخدام

العمليات والإجراءات:
- تحسين العمليات أو الإجراءات
- أتمتة أو رقمنة المهام
- تسهيل أو تبسيط العمل
- كفاءة أو فعالية الأداء

معايير التقييم المتساهلة:
✅ مطابق (70-100%): وجود إشارات واضحة للأدوات والاستخدام
⚠️ مطابق جزئياً (35-69%): وجود إشارات للأدوات أو الاستخدام
❌ غير مطابق (0-34%): عدم وجود إشارات واضحة

كن متساهلاً - أي إشارة للتقنية أو الأدوات تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.3: "Using Technical Tools to Assist in Entity Operations"

Objective: Enhance adoption of technical tools to improve employees' daily and routine work performance.

Look for any reference to:

Tools and Technologies:
- Technical, digital, or electronic tools
- Systems, software, or applications
- Platforms or technical solutions
- Technologies or technology

Usage and Adoption:
- Use, adoption, or application
- Operation, activation, or implementation
- Utilization or working with
- Performance improvement or development

Training and Support:
- Training on tools or systems
- Technical support or assistance
- Technical workshops or courses
- Guidelines or user manuals

Operations and Procedures:
- Process or procedure improvement
- Automation or digitization of tasks
- Facilitating or simplifying work
- Efficiency or performance effectiveness

Lenient Evaluation Criteria:
✅ COMPLIANT (70-100%): Clear references to tools and usage
⚠️ PARTIALLY COMPLIANT (35-69%): References to tools or usage
❌ NON-COMPLIANT (0-34%): No clear references

Be lenient - any reference to technology or tools counts as positive.

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
      '5.4.4': {
        ar: `أنت خبير مدقق متخصص في تقييم المتطلب 5.4.4: "التطوير المستمر للثقافة الرقمية"

الهدف: وضع استراتيجيات وخطط للتطوير المستمر للثقافة الرقمية في الجهة ومتابعة تطبيقها وقياس أثرها على الأداء العام والتحسين المستمر.

ابحث عن أي إشارة إلى:

الاستراتيجيات والخطط:
- استراتيجية أو استراتيجيات
- خطة أو خطط أو تخطيط
- رؤية أو أهداف مستقبلية
- مبادرات أو مشاريع تطويرية

التطوير والتحسين:
- تطوير أو تحسين أو تعزيز
- تطوير مستمر أو تحسين مستمر
- نمو أو تقدم أو تقدم
- رفع أو زيادة القدرات

المتابعة والقياس:
- متابعة أو مراقبة أو رصد
- قياس أو تقييم أو مراجعة
- مؤشرات أو نتائج أو تقارير
- أثر أو تأثير على الأداء

الثقافة الرقمية:
- ثقافة رقمية أو ثقافة تقنية
- وعي رقمي أو معرفة تقنية
- مهارات رقمية أو قدرات تقنية
- بيئة رقمية أو تحول رقمي

معايير التقييم المتساهلة:
✅ مطابق (70-100%): وجود إشارات للتطوير والمتابعة
⚠️ مطابق جزئياً (35-69%): وجود إشارات للتطوير أو المتابعة
❌ غير مطابق (0-34%): عدم وجود إشارات واضحة

كن متساهلاً جداً - أي إشارة للتطوير أو التحسين تعتبر إيجابية.

أرجع استجابة JSON فقط:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "تحليل مفصل مع ربط الأدلة بالمتطلبات المحددة",
  "recommendations": ["توصية محددة 1", "توصية محددة 2", "توصية محددة 3"],
  "documentContent": "ملخص للمحتوى الفعلي الموجود في الوثيقة والذي تم تحليله"
}`,
        en: `You are an expert auditor specialized in evaluating requirement 5.4.4: "Continuous Development of Digital Culture"

Objective: Develop strategies and plans for continuous development of digital culture in the agency, monitor their implementation, and measure their impact on overall performance and continuous improvement.

Look for any reference to:

Strategies and Plans:
- Strategy or strategies
- Plan, plans, or planning
- Vision or future objectives
- Development initiatives or projects

Development and Improvement:
- Development, improvement, or enhancement
- Continuous development or continuous improvement
- Growth, progress, or advancement
- Capacity building or increasing capabilities

Monitoring and Measurement:
- Monitoring, tracking, or oversight
- Measurement, evaluation, or review
- Indicators, results, or reports
- Impact or effect on performance

Digital Culture:
- Digital culture or technical culture
- Digital awareness or technical knowledge
- Digital skills or technical capabilities
- Digital environment or digital transformation

Lenient Evaluation Criteria:
✅ COMPLIANT (70-100%): References to development and monitoring
⚠️ PARTIALLY COMPLIANT (35-69%): References to development or monitoring
❌ NON-COMPLIANT (0-34%): No clear references

Be very lenient - any reference to development or improvement counts as positive.

Return JSON response only:
{
  "score": number (0-100),
  "status": "pass" | "fail" | "partial",
  "confidence": number (70-95),
  "findings": "detailed analysis linking evidence to specific requirements",
  "recommendations": ["specific recommendation 1", "specific recommendation 2", "specific recommendation 3"],
  "documentContent": "summary of actual content found in the document that was analyzed"
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
    
    if (!text || text.trim().length < 10 || text === '[IMAGE_FILE_FOR_VISION_API]' || text === '[PDF_WITH_LIMITED_TEXT_CONTENT]') {
      return language === 'ar' 
        ? `وثيقة ${metadata.fileType} (${metadata.filename}) مع محتوى نصي محدود. قد تكون وثيقة ممسوحة ضوئياً أو تحتوي على صور.`
        : `${metadata.fileType} document (${metadata.filename}) with limited text content. May be a scanned document or contain images.`;
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