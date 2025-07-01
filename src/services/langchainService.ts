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
      console.log(`Document parsed: ${metadata.filename} (${metadata.language}, ${metadata.wordCount} words)`);

      // Extract evidence
      const evidenceResult = await this.agentManager.executeTask('evidence_extractor', {
        documentMetadata: metadata,
        criteriaId,
        language
      }, 2);

      const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];
      console.log(`Evidence extracted: ${evidence.length} pieces found`);

      // Score compliance
      const scoringResult = await this.agentManager.executeTask('compliance_scorer', {
        documentMetadata: metadata,
        evidence,
        criteriaId,
        language
      }, 3);

      if (!scoringResult.success) {
        console.warn(`Compliance scoring failed, using fallback: ${scoringResult.error}`);
        // Return fallback score instead of throwing error
        return this.createFallbackScore(criteriaId, evidence, language, metadata);
      }

      console.log(`Criteria analysis completed for ${criteriaId}`);
      return scoringResult.data;

    } catch (error) {
      console.error(`Criteria analysis failed for ${criteriaId}:`, error);
      
      // Return a meaningful fallback instead of throwing
      return this.createFallbackScore(criteriaId, [], language, {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        language,
        extractedText: '',
        wordCount: 0,
        confidence: 50
      });
    }
  }

  private createFallbackScore(
    criteriaId: string, 
    evidence: Evidence[], 
    language: 'ar' | 'en',
    metadata: DocumentMetadata
  ): ComplianceScore {
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
    } else if (metadata.wordCount > 100) {
      // Give some credit for having content
      score = 30;
      status = 'partial';
    } else {
      score = 15;
      status = 'fail';
    }

    const findings = language === 'ar' 
      ? `تم تحليل الوثيقة "${metadata.filename}" وعثر على ${evidenceCount} دليل. التقييم الآلي بسبب عدم توفر التحليل المتقدم. عدد الكلمات: ${metadata.wordCount}.`
      : `Analyzed document "${metadata.filename}" and found ${evidenceCount} evidence pieces. Automated assessment due to unavailable advanced analysis. Word count: ${metadata.wordCount}.`;

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