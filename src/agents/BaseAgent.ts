import { AgentConfig, AgentResult } from './types';

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected isInitialized: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  public getConfig(): AgentConfig {
    return this.config;
  }

  protected async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      await this.onInitialize();
      this.isInitialized = true;
    } catch (error) {
      console.error(`Failed to initialize agent ${this.config.id}:`, error);
      throw error;
    }
  }

  protected abstract onInitialize(): Promise<void>;

  public async execute(input: any): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      const result = await this.onExecute(input);
      const executionTime = Date.now() - startTime;

      return {
        agentId: this.config.id,
        success: true,
        data: result,
        executionTime,
        metadata: {
          agentType: this.config.type,
          agentName: this.config.name
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Agent ${this.config.id} execution failed:`, error);
      
      return {
        agentId: this.config.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        metadata: {
          agentType: this.config.type,
          agentName: this.config.name
        }
      };
    }
  }

  protected abstract onExecute(input: any): Promise<any>;

  protected createErrorBoundary<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    return operation().catch(error => {
      console.warn(`Agent ${this.config.id} operation failed, using fallback:`, error);
      return fallback;
    });
  }
}

