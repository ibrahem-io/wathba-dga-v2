// src/services/openaiService.ts - Fixed thread ID handling

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface CriteriaAnalysis {
  score: number;
  status: 'pass' | 'fail' | 'partial';
  confidence: number;
  evidence: string[];
  findings: string;
  recommendations: string[];
}

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

// Upload file to OpenAI
async function uploadFileToOpenAI(file: File): Promise<string> {
  console.log(`📤 Uploading ${file.name} to OpenAI...`);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'assistants');

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
  }

  const result = await response.json();
  console.log(`✅ File uploaded successfully: ${result.id}`);
  return result.id;
}

// Create assistant for analysis
async function createAnalysisAssistant(language: 'ar' | 'en'): Promise<string> {
  const instructions = language === 'ar' ? `
أنت خبير مدقق لمعيار هيئة الحكومة الرقمية السعودية 5.4 "الثقافة والبيئة الرقمية".

متطلبات المعيار:
5.4.1 - دراسات وبرامج الوعي بالتحول الرقمي
5.4.2 - تنفيذ وتقييم برامج رفع الوعي  
5.4.3 - استخدام ودعم الأدوات التقنية
5.4.4 - التطوير المستمر للثقافة الرقمية

مهمتك:
1. قراءة الوثائق المرفوعة بعناية
2. البحث عن أي إشارة أو دليل متعلق بالمتطلب المحدد
3. كن متساهلاً في التقييم - أي إشارة بسيطة تعتبر إيجابية
4. تقديم تحليل موضوعي مع توصيات بناءة

نظام التقييم:
- 70+ نقطة: مطابق (pass)
- 40-69 نقطة: مطابق جزئياً (partial)
- أقل من 40: غير مطابق (fail)
` : `
You are an expert auditor for Saudi Arabia's Digital Government Authority (DGA) Standard 5.4 "Digital Culture and Environment".

Standard Requirements:
5.4.1 - Digital Transformation Awareness Studies and Programs
5.4.2 - Implementation and Evaluation of Awareness Programs
5.4.3 - Use and Support of Technical Tools  
5.4.4 - Continuous Development of Digital Culture

Your task:
1. Carefully read uploaded documents
2. Look for any reference or evidence related to the specified requirement
3. Be lenient in evaluation - any simple reference counts as positive
4. Provide objective analysis with constructive recommendations

Scoring System:
- 70+ points: Compliant (pass)
- 40-69 points: Partially compliant (partial)
- Below 40: Non-compliant (fail)
`;

  const assistant = await openai.beta.assistants.create({
    name: language === 'ar' ? 'مدقق الامتثال الرقمي' : 'Digital Compliance Auditor',
    instructions,
    model: "gpt-4o",
    tools: [{ type: "file_search" }]
  });

  return assistant.id;
}

export async function analyzeDocumentForCriteria(
  files: File[],
  criteriaId: string,
  language: 'ar' | 'en'
): Promise<CriteriaAnalysis> {
  let assistantId: string | null = null;
  let threadId: string | null = null;
  let uploadedFileIds: string[] = [];

  try {
    console.log(`🤖 Starting Assistants API analysis for criteria ${criteriaId}`);
    console.log(`📁 Files: ${files.map(f => f.name).join(', ')}`);

    // Step 1: Upload files to OpenAI
    console.log('📤 Uploading files to OpenAI...');
    uploadedFileIds = await Promise.all(files.map(uploadFileToOpenAI));
    console.log(`✅ Uploaded ${uploadedFileIds.length} files:`, uploadedFileIds);

    // Step 2: Create assistant
    console.log('🧠 Creating analysis assistant...');
    assistantId = await createAnalysisAssistant(language);
    console.log(`✅ Assistant created: ${assistantId}`);

    // Step 3: Create thread with uploaded files
    console.log('💬 Creating analysis thread...');
    
    const criteriaDescriptions = {
      '5.4.1': {
        ar: 'دراسات وبرامج الوعي بالتحول الرقمي - ابحث عن دراسات تحديد مستوى الوعي أو برامج التوعية',
        en: 'Digital Transformation Awareness Studies and Programs - look for awareness level studies or training programs'
      },
      '5.4.2': {
        ar: 'تنفيذ وتقييم برامج رفع الوعي - ابحث عن تنفيذ البرامج أو قياس النتائج',
        en: 'Implementation and Evaluation of Awareness Programs - look for program implementation or results measurement'
      },
      '5.4.3': {
        ar: 'استخدام ودعم الأدوات التقنية - ابحث عن الأدوات التقنية أو الدعم التقني',
        en: 'Use and Support of Technical Tools - look for technical tools or technical support'
      },
      '5.4.4': {
        ar: 'التطوير المستمر للثقافة الرقمية - ابحث عن استراتيجيات التطوير أو التحسين المستمر',
        en: 'Continuous Development of Digital Culture - look for development strategies or continuous improvement'
      }
    };

    const criteriaDesc = criteriaDescriptions[criteriaId as keyof typeof criteriaDescriptions];
    if (!criteriaDesc) {
      throw new Error(`Unknown criteria ID: ${criteriaId}`);
    }

    const prompt = language === 'ar' ? `
يرجى تحليل الوثائق المرفقة للمتطلب ${criteriaId}: ${criteriaDesc[language]}

أريد تحليلاً شاملاً يتضمن:
1. البحث بعناية عن أي إشارة أو دليل متعلق بهذا المتطلب
2. كن متساهلاً - أي إشارة بسيطة تعتبر إنجازاً
3. درجة الامتثال (0-100)
4. حالة الامتثال (pass إذا 70+، partial إذا 40-69، fail إذا أقل من 40)
5. درجة الثقة في التحليل (75-95)
6. أدلة محددة من الوثائق (اقتباسات فعلية)
7. نتائج التحليل المفصلة
8. توصيات بناءة للتحسين

يرجى الرد بتنسيق JSON فقط:
{
  "score": number,
  "status": "pass" | "partial" | "fail",
  "confidence": number,
  "evidence": ["نص محدد 1", "نص محدد 2"],
  "findings": "تحليل مفصل وإيجابي",
  "recommendations": ["توصية بناءة 1", "توصية بناءة 2"]
}
` : `
Please analyze the attached documents for requirement ${criteriaId}: ${criteriaDesc[language]}

I need a comprehensive analysis including:
1. Carefully search for any reference or evidence related to this requirement
2. Be lenient - any simple reference counts as achievement
3. Compliance score (0-100)
4. Compliance status (pass if 70+, partial if 40-69, fail if below 40)
5. Confidence level in analysis (75-95)
6. Specific evidence from documents (actual quotes)
7. Detailed analysis findings
8. Constructive recommendations for improvement

Please respond in JSON format only:
{
  "score": number,
  "status": "pass" | "partial" | "fail",
  "confidence": number,
  "evidence": ["specific text 1", "specific text 2"],
  "findings": "detailed positive analysis",
  "recommendations": ["constructive recommendation 1", "constructive recommendation 2"]
}
`;

    // FIXED: Create thread first, then get the ID
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: prompt,
          attachments: uploadedFileIds.map(fileId => ({
            file_id: fileId,
            tools: [{ type: "file_search" }]
          }))
        }
      ]
    });

    // FIXED: Properly assign thread ID
    threadId = thread.id;
    console.log(`✅ Thread created: ${threadId}`);

    // Validate thread ID before proceeding
    if (!threadId || threadId === 'undefined') {
      throw new Error('Failed to create thread - thread ID is undefined');
    }

    // Step 4: Run the assistant
    console.log('🏃 Running analysis...');
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });

    console.log(`✅ Run created: ${run.id}`);

    // Step 5: Wait for completion
    console.log('⏳ Waiting for analysis to complete...');
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    
    while ((runStatus.status === 'in_progress' || runStatus.status === 'queued') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`📊 Status: ${runStatus.status} (${attempts + 1}/${maxAttempts})`);
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      console.error('❌ Run failed with status:', runStatus.status);
      console.error('❌ Last error:', runStatus.last_error);
      throw new Error(`Analysis failed with status: ${runStatus.status}. ${runStatus.last_error?.message || ''}`);
    }

    // Step 6: Get the response
    console.log('📥 Retrieving analysis results...');
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error('No response from assistant');
    }

    const responseText = assistantMessage.content[0].type === 'text' 
      ? assistantMessage.content[0].text.value 
      : '';

    console.log('🎯 Raw assistant response:', responseText);

    // Step 7: Parse JSON response
    let result;
    try {
      // Extract JSON from response if it's wrapped in text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError);
      console.error('Response was:', responseText);
      throw new Error('Failed to parse assistant response as JSON');
    }

    // Step 8: Validate and return
    const validatedResult: CriteriaAnalysis = {
      score: typeof result.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 0,
      status: ['pass', 'fail', 'partial'].includes(result.status) ? result.status : 'fail',
      confidence: typeof result.confidence === 'number' ? Math.max(75, Math.min(95, result.confidence)) : 80,
      evidence: Array.isArray(result.evidence) ? result.evidence.slice(0, 5) : [],
      findings: typeof result.findings === 'string' ? result.findings : 'No analysis available',
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : []
    };

    console.log(`✅ Analysis complete for ${criteriaId}:`, validatedResult);
    return validatedResult;

  } catch (error) {
    console.error('❌ Assistants API Error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.message.includes('thread_id')) {
        errorMessage = 'Failed to create analysis thread. Please try again.';
      } else if (error.message.includes('Upload failed')) {
        errorMessage = 'Failed to upload files to OpenAI. Please check file format and size.';
      } else if (error.message.includes('API key')) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
      } else {
        errorMessage = error.message;
      }
    }
    
    throw new Error(language === 'ar' 
      ? `فشل تحليل الوثائق: ${errorMessage}`
      : `Document analysis failed: ${errorMessage}`);
  } finally {
    // Cleanup
    try {
      if (assistantId) {
        await openai.beta.assistants.del(assistantId);
        console.log('🗑️ Assistant deleted');
      }
      if (uploadedFileIds.length > 0) {
        await Promise.all(uploadedFileIds.map(async fileId => {
          try {
            await openai.files.del(fileId);
            console.log(`🗑️ File ${fileId} deleted`);
          } catch (err) {
            console.warn(`⚠️ Failed to delete file ${fileId}:`, err);
          }
        }));
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError);
    }
  }
}

// Keep existing functions for backward compatibility
export async function analyzeDocument(documentText: string, language: 'ar' | 'en'): Promise<AnalysisResult> {
  // This is now deprecated in favor of file-based analysis
  throw new Error('Please use file-based analysis instead of text-based analysis');
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