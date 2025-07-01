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
      console.log('✅ LangChain Audit Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LangChain Audit Service:', error);
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

      console.log('✅ OpenAI API key validated successfully');
    } catch (error) {
      console.error('❌ API key validation error:', error);
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }
  }

  public async analyzeCriteria(
    file: File, 
    criteriaId: string, 
    language: 'ar' | 'en'
  ): Promise<ComplianceScore> {
    await this.initialize();

    try {
      console.log(`🚀 Starting criteria analysis for ${criteriaId} with file: ${file.name}`);
      
      // Step 1: Parse document
      console.log(`📄 Step 1: Parsing document...`);
      const parseResult = await this.agentManager.executeTask('document_parser', { file }, 1);
      if (!parseResult.success) {
        throw new Error(`Document parsing failed: ${parseResult.error}`);
      }

      const metadata: DocumentMetadata = parseResult.data;
      console.log(`✅ Document parsed successfully:
        - File: ${metadata.filename}
        - Type: ${metadata.fileType}
        - Language: ${metadata.language}
        - Words: ${metadata.wordCount}
        - Confidence: ${metadata.confidence}%
        - Text length: ${metadata.extractedText.length} characters
        - Is visual: ${metadata.isVisualDocument}
        - Has base64: ${!!metadata.base64Image}`);

      // Step 2: Extract evidence
      console.log(`🔍 Step 2: Extracting evidence for criteria ${criteriaId}...`);
      const evidenceResult = await this.agentManager.executeTask('evidence_extractor', {
        documentMetadata: metadata,
        criteriaId,
        language
      }, 2);

      const evidence: Evidence[] = evidenceResult.success ? evidenceResult.data : [];
      console.log(`✅ Evidence extraction completed: ${evidence.length} pieces found`);
      
      if (evidence.length > 0) {
        console.log(`📋 Evidence summary:`, evidence.map(e => 
          `"${e.text.substring(0, 50)}..." (${Math.round(e.relevance * 100)}%)`
        ));
      }

      // Step 3: Score compliance
      console.log(`📊 Step 3: Scoring compliance for criteria ${criteriaId}...`);
      const scoringResult = await this.agentManager.executeTask('compliance_scorer', {
        documentMetadata: metadata,
        evidence,
        criteriaId,
        language
      }, 3);

      if (!scoringResult.success) {
        console.error(`❌ Compliance scoring failed for ${criteriaId}: ${scoringResult.error}`);
        throw new Error(`Scoring failed: ${scoringResult.error}`);
      }

      const result = scoringResult.data;
      console.log(`✅ Criteria analysis completed for ${criteriaId}:
        - Status: ${result.status}
        - Score: ${result.score}%
        - Confidence: ${result.confidence}%
        - Evidence count: ${result.evidence.length}
        - Recommendations: ${result.recommendations.length}`);
      
      return result;

    } catch (error) {
      console.error(`❌ Criteria analysis failed for ${criteriaId}:`, error);
      
      // Provide more specific error handling
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('OpenAI API key is invalid or missing. Please check your configuration.');
        } else if (error.message.includes('Document parsing failed')) {
          throw new Error(`Document processing failed: ${error.message.replace('Document parsing failed: ', '')}`);
        } else if (error.message.includes('Scoring failed')) {
          throw new Error(`Analysis failed: ${error.message.replace('Scoring failed: ', '')}`);
        }
      }
      
      throw error;
    }
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
    console.log('🔄 LangChain Audit Service shut down');
  }
}

// Singleton instance
export const langchainService = new LangChainAuditService();