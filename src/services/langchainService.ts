import { AgentManager } from '../agents/AgentManager';
import { DocumentMetadata, Evidence, ComplianceScore } from '../agents/types';

export class LangChainAuditService {
  private agentManager: AgentManager;
  private isInitialized: boolean = false;

  constructor() {
    this.agentManager = new AgentManager();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Check if OpenAI API key is available
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY in your environment variables.');
      }

      // Test API key validity
      await this.testApiKey(apiKey);
      
      // Agent manager initializes agents automatically
      this.isInitialized = true;
      console.log('LangChain Audit Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LangChain Audit Service:', error);
      throw error;
    }
  }

  private async testApiKey(apiKey: string): Promise<void> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API key validation failed: ${response.status} ${response.statusText}`);
      }

      console.log('OpenAI API key validated successfully');
    } catch (error) {
      console.error('API key validation error:', error);
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }
  }

  public async analyzeDocument(file: File, language: 'ar' | 'en'): Promise<{
    metadata: DocumentMetadata;
    complianceScores: ComplianceScore[];
  }> {
    await this.initialize();

    try {
      // Step 1: Parse document
      console.log('Starting document parsing...');
      const parseResult = await this.agentManager.executeTask('document_parser', { file }, 1);
      
      if (!parseResult.success) {
        throw new Error(`Document parsing failed: ${parseResult.error}`);
      }

      const metadata: DocumentMetadata = parseResult.data;
      console.log('Document parsing completed successfully');

      // Step 2: Extract evidence for each criteria
      const criteriaIds = ['5.4.1', '5.4.2', '5.4.3', '5.4.4'];
      const evidencePromises = criteriaIds.map(criteriaId =>
        this.agentManager.executeTask('evidence_extractor', {
          documentMetadata: metadata,
          criteriaId,
          language
        }, 2)
      );

      console.log('Starting evidence extraction for all criteria...');
      const evidenceResults = await Promise.all(evidencePromises);
      
      // Step 3: Score compliance for each criteria
      const scoringPromises = criteriaIds.map((criteriaId, index) => {
        const evidenceResult = evidenceResults[index];
        const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];
        
        return this.agentManager.executeTask('compliance_scorer', {
          documentMetadata: metadata,
          evidence,
          criteriaId,
          language
        }, 3);
      });

      console.log('Starting compliance scoring for all criteria...');
      const scoringResults = await Promise.all(scoringPromises);

      // Compile results
      const complianceScores: ComplianceScore[] = scoringResults.map((result, index) => {
        if (result.success) {
          return result.data;
        } else {
          // Fallback score for failed scoring
          return {
            criteriaId: criteriaIds[index],
            score: 0,
            status: 'fail' as const,
            confidence: 50,
            evidence: [],
            findings: `Scoring failed: ${result.error}`,
            recommendations: ['Review document content', 'Ensure proper formatting', 'Add more detailed information']
          };
        }
      });

      console.log('Document analysis completed successfully');
      return {
        metadata,
        complianceScores
      };

    } catch (error) {
      console.error('Document analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async analyzeCriteria(
    file: File, 
    criteriaId: string, 
    language: 'ar' | 'en'
  ): Promise<ComplianceScore> {
    await this.initialize();

    try {
      console.log(`Starting criteria analysis for ${criteriaId}...`);
      
      // Parse document
      const parseResult = await this.agentManager.executeTask('document_parser', { file }, 1);
      if (!parseResult.success) {
        throw new Error(`Document parsing failed: ${parseResult.error}`);
      }

      const metadata: DocumentMetadata = parseResult.data;
      console.log(`Document parsed: ${metadata.filename} (${metadata.language}, ${metadata.wordCount} words, confidence: ${metadata.confidence}%)`);

      // Check if we have meaningful content or if it's a special case
      if (metadata.extractedText === '[IMAGE_FILE_FOR_VISION_API]') {
        console.log(`Image file detected: ${metadata.filename} - will use Vision API`);
      } else if (metadata.extractedText === '[PDF_WITH_LIMITED_TEXT_CONTENT]') {
        console.log(`PDF with limited text content: ${metadata.filename} - will analyze with available context`);
      } else if (metadata.wordCount === 0 || metadata.extractedText.trim().length < 10) {
        console.warn(`Document appears to have no meaningful content: ${metadata.filename}`);
        return this.createEmptyDocumentScore(criteriaId, language, metadata);
      }

      // Extract evidence (this will work even with limited text content)
      const evidenceResult = await this.agentManager.executeTask('evidence_extractor', {
        documentMetadata: metadata,
        criteriaId,
        language
      }, 2);

      const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];
      console.log(`Evidence extracted: ${evidence.length} pieces found with relevance scores:`, 
        evidence.map(e => `${Math.round(e.relevance * 100)}%`));

      // Score compliance
      const scoringResult = await this.agentManager.executeTask('compliance_scorer', {
        documentMetadata: metadata,
        evidence,
        criteriaId,
        language
      }, 3);

      if (!scoringResult.success) {
        console.error(`Compliance scoring failed for ${criteriaId}: ${scoringResult.error}`);
        throw new Error(`Scoring failed: ${scoringResult.error}`);
      }

      const result = scoringResult.data;
      console.log(`Criteria analysis completed for ${criteriaId}: ${result.status} (${result.score}%, confidence: ${result.confidence}%)`);
      return result;

    } catch (error) {
      console.error(`Criteria analysis failed for ${criteriaId}:`, error);
      throw error; // Re-throw to let the UI handle the error properly
    }
  }

  private createEmptyDocumentScore(
    criteriaId: string, 
    language: 'ar' | 'en',
    metadata: DocumentMetadata
  ): ComplianceScore {
    const findings = language === 'ar' 
      ? `لا يمكن تحليل الوثيقة "${metadata.filename}" بسبب عدم وجود محتوى نصي كافٍ. قد تكون الوثيقة فارغة أو تحتوي على صور فقط أو تحتاج إلى تحويل إلى تنسيق نصي.`
      : `Cannot analyze document "${metadata.filename}" due to insufficient text content. The document may be empty, contain only images, or need conversion to text format.`;

    const recommendations = language === 'ar' 
      ? [
          'تأكد من أن الوثيقة تحتوي على نص قابل للقراءة',
          'تحقق من تنسيق الملف وجودة المسح الضوئي',
          'أعد رفع الوثيقة بتنسيق مختلف إذا أمكن'
        ]
      : [
          'Ensure the document contains readable text',
          'Check file format and scan quality',
          'Re-upload the document in a different format if possible'
        ];

    return {
      criteriaId,
      score: 0,
      status: 'fail',
      confidence: 95, // High confidence that there's no content
      evidence: [],
      findings,
      recommendations
    };
  }

  public getSystemStatus(): {
    agentStates: any;
    queueLength: number;
    activeAgents: number;
  } {
    return {
      agentStates: Object.fromEntries(this.agentManager.getAgentStates()),
      queueLength: this.agentManager.getQueueLength(),
      activeAgents: this.agentManager.getActiveAgentCount()
    };
  }

  public async shutdown(): Promise<void> {
    await this.agentManager.shutdown();
    this.isInitialized = false;
    console.log('LangChain Audit Service shut down');
  }
}

// Singleton instance
export const langchainService = new LangChainAuditService();