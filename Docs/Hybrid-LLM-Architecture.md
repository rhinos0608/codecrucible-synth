# Hybrid LLM Architecture: LM Studio + Ollama Integration

## Overview

CodeCrucible Synth's Hybrid LLM Architecture combines the speed of LM Studio with the reasoning power of Ollama to create an optimal local AI coding assistant. This architecture provides sub-second responses for routine tasks while maintaining high-quality reasoning for complex operations.

## Architecture Diagram

```
CodeCrucible Synth CLI
         │
         ├─> Task Analysis & Routing
         │   ├─> Complexity Assessment
         │   ├─> Task Type Classification  
         │   └─> LLM Selection Logic
         │
    ┌────┴─────────────────────────────────────┐
    │                                          │
┌───▼────────┐                        ┌───▼────────┐
│ LM Studio  │                        │   Ollama   │
│ (Fast)     │                        │ (Quality)  │
├────────────┤                        ├────────────┤
│• Templates │                        │• Analysis  │
│• Edits     │                        │• Planning  │
│• Format    │                        │• Complex   │
│• Streaming │                        │• Multi-file│
└────────────┘                        └────────────┘
    │                                          │
    └─────────────┬──────────────────────────┘
                  │
         ┌────────▼─────────┐
         │ Unified Response │
         │ • Code Generated │
         │ • Execution      │
         │ • Feedback Loop  │
         └──────────────────┘
```

## Core Components

### 1. Hybrid Model Selector

**Location**: `src/core/intelligent-model-selector.ts`

The enhanced model selector routes tasks between LM Studio and Ollama based on:

- **Task Complexity**: Simple → LM Studio, Complex → Ollama
- **Task Type**: Templates → LM Studio, Analysis → Ollama  
- **Performance History**: Learn optimal routing over time
- **System Resources**: Dynamic allocation based on availability

```typescript
interface TaskRoutingDecision {
  selectedLLM: 'lmstudio' | 'ollama' | 'hybrid'
  confidence: number
  reasoning: string
  fallbackStrategy: string
}
```

### 2. LM Studio Client

**Location**: `src/core/lm-studio-client.ts` (new)

```typescript
class LMStudioClient implements LLMInterface {
  private endpoint = 'http://localhost:1234'
  
  async generateCode(prompt: string, context: string[]): Promise<LLMResponse> {
    // OpenAI-compatible API calls to LM Studio
    return this.httpClient.post('/v1/chat/completions', {
      model: this.selectedModel,
      messages: this.formatMessages(prompt, context),
      stream: true  // Enable streaming for real-time responses
    })
  }
  
  async getCapabilities(): Promise<LLMCapabilities> {
    return {
      strengths: ['speed', 'templates', 'streaming', 'windows-optimized'],
      optimalFor: ['quick-edits', 'boilerplate', 'formatting', 'simple-generation'],
      responseTime: '<1s',
      contextWindow: 4096
    }
  }
}
```

### 3. Enhanced Voice Archetype Mapping

Each voice archetype is optimized for specific LLM backends:

| Voice | Primary LLM | Use Case | Rationale |
|-------|-------------|----------|-----------|
| **Explorer** | LM Studio | File discovery, scanning | Speed for frequent operations |
| **Analyzer** | Ollama | Deep code analysis | Complex reasoning required |
| **Developer** | Hybrid | Mixed coding tasks | Dynamic escalation based on complexity |
| **Implementor** | LM Studio | Rapid code generation | High throughput for templates |
| **Security** | Ollama | Vulnerability analysis | Thorough analysis required |
| **Architect** | Ollama | System design | Strategic thinking needed |

## Task Routing Logic

### Simple Tasks → LM Studio
- Code formatting and linting
- Boilerplate generation (React components, API endpoints)
- Quick file edits and refactoring
- Template-based responses
- Documentation generation

### Complex Tasks → Ollama
- Multi-file analysis and refactoring
- Architecture planning and design
- Complex debugging and problem-solving
- Security vulnerability assessment
- Cross-system integration planning

### Hybrid Tasks → Dynamic Escalation
1. Start with LM Studio for speed
2. Analyze confidence score of response
3. If confidence < threshold, escalate to Ollama
4. Combine results for optimal output

## Performance Benefits

### Speed Optimization
- **LM Studio**: Native Windows performance, GPU acceleration
- **Streaming**: Real-time token generation for immediate feedback
- **Template Cache**: Pre-computed responses for common patterns
- **Parallel Processing**: Run both LLMs simultaneously for different tasks

### Quality Assurance  
- **Ollama**: Superior reasoning for complex tasks
- **Confidence Scoring**: Automatic quality assessment
- **Escalation**: Seamless upgrade to higher-quality LLM when needed
- **Feedback Learning**: Continuous improvement of routing decisions

### Resource Efficiency
- **Smart Allocation**: Only use expensive models when necessary
- **VRAM Sharing**: Coordinate memory usage between LLMs
- **Load Balancing**: Distribute tasks based on system capacity
- **Graceful Degradation**: Fallback strategies when services unavailable

## Configuration

### Hybrid Configuration Schema

```yaml
# config/hybrid-llm.yaml
hybrid:
  routing:
    defaultProvider: "auto"  # auto | lmstudio | ollama
    escalationThreshold: 0.7
    confidenceScoring: true
    learningEnabled: true
    
  lmStudio:
    endpoint: "http://localhost:1234"
    enabled: true
    models:
      - "codellama-7b-instruct"
      - "gemma-2b-it"
    taskTypes:
      - "template"
      - "edit"
      - "format"
      - "boilerplate"
    streamingEnabled: true
    maxConcurrent: 3
    
  ollama:
    endpoint: "http://localhost:11434"
    enabled: true
    models:
      - "codellama:34b"
      - "qwen2.5:72b"
    taskTypes:
      - "analysis"
      - "planning"
      - "complex"
      - "multi-file"
    maxConcurrent: 1
    
  performance:
    cacheEnabled: true
    metricsCollection: true
    autoOptimization: true
    healthChecking: true
```

## Implementation Phases

### Phase 1: Basic Integration (Week 1)
- [ ] Create LMStudioClient class
- [ ] Integrate with existing LocalModelClient
- [ ] Basic task routing in IntelligentModelSelector
- [ ] Update Fast Mode to use LM Studio
- [ ] Configuration management

### Phase 2: Advanced Routing (Week 2)  
- [ ] Implement confidence scoring
- [ ] Add escalation logic
- [ ] Performance metrics collection
- [ ] Health monitoring and fallbacks
- [ ] Voice archetype optimization

### Phase 3: Optimization (Week 3)
- [ ] Streaming response implementation
- [ ] Resource sharing and load balancing
- [ ] Learning system for routing improvement
- [ ] Advanced caching strategies
- [ ] Parallel task execution

### Phase 4: Production Readiness (Week 4)
- [ ] Comprehensive testing suite
- [ ] Performance benchmarking
- [ ] Documentation and examples
- [ ] Deployment automation
- [ ] Monitoring and alerting

## Usage Examples

### Basic Usage

```bash
# Fast template generation (LM Studio)
codecrucible --fast "create a React login component"

# Complex analysis (Ollama)  
codecrucible --analyze "review this codebase for security vulnerabilities"

# Hybrid mode (automatic routing)
codecrucible "refactor this module to use TypeScript"
```

### Programmatic Usage

```typescript
import { HybridModelClient } from './core/hybrid-model-client'

const client = new HybridModelClient({
  lmStudio: { endpoint: 'http://localhost:1234' },
  ollama: { endpoint: 'http://localhost:11434' }
})

// Automatic routing based on task complexity
const result = await client.generateCode(
  "Create a complex authentication system with JWT",
  { autoRoute: true }
)

// Force specific LLM
const fastResult = await client.generateCode(
  "Format this code", 
  { forceLLM: 'lmstudio' }
)
```

## Monitoring and Metrics

### Key Performance Indicators

1. **Response Time**
   - LM Studio: Target <1s for simple tasks
   - Ollama: Target <30s for complex tasks
   - Escalation: Total time including fallback

2. **Quality Metrics**
   - Code correctness (syntax validation)
   - User satisfaction scores
   - Task completion rates
   - Error rates by LLM

3. **Resource Utilization**
   - VRAM usage per LLM
   - CPU utilization
   - Memory consumption
   - Concurrent task handling

4. **Routing Efficiency** 
   - Escalation frequency
   - Routing accuracy
   - Learning improvement over time
   - Confidence score distributions

### Monitoring Dashboard

```typescript
interface HybridMetrics {
  lmStudio: {
    requestCount: number
    avgResponseTime: number
    successRate: number
    currentLoad: number
  }
  ollama: {
    requestCount: number
    avgResponseTime: number
    successRate: number
    currentLoad: number
  }
  routing: {
    escalationRate: number
    routingAccuracy: number
    confidenceDistribution: number[]
    learningProgress: number
  }
}
```

## Troubleshooting

### Common Issues

**1. LM Studio Connection Failed**
```bash
# Check if LM Studio is running
curl http://localhost:1234/v1/models

# Verify in LM Studio GUI that server is started
# Check Windows firewall settings
```

**2. Poor Routing Decisions**
```bash
# Reset learning data
codecrucible config reset hybrid.routing.learningData

# Adjust confidence threshold
codecrucible config set hybrid.routing.escalationThreshold 0.8
```

**3. Resource Conflicts**
```bash
# Check VRAM usage
codecrucible system vram --status

# Adjust concurrent limits
codecrucible config set hybrid.lmStudio.maxConcurrent 2
```

### Performance Optimization

1. **Model Selection**
   - Use quantized models (Q4_K_M) for LM Studio speed
   - Reserve full precision models for Ollama quality

2. **Memory Management**
   - Monitor VRAM usage across both services
   - Implement model swapping for memory optimization
   - Use streaming to reduce memory footprint

3. **Network Optimization**
   - Keep both services local for minimal latency
   - Use persistent connections
   - Implement request batching where possible

## Security Considerations

### Local-Only Processing
- All LLM processing happens locally
- No data transmitted to external services
- Full control over model selection and data

### Sandboxed Execution
- Code execution isolated in containers
- Resource limits prevent system damage
- Audit trails for all operations

### Configuration Security
- Encrypted storage of sensitive settings
- Role-based access to different LLMs
- Audit logs for configuration changes

## Future Enhancements

### Planned Features

1. **Multi-Model Ensembles**
   - Combine outputs from multiple LLMs
   - Consensus-based decision making
   - Confidence-weighted averaging

2. **Adaptive Learning**
   - User preference learning
   - Task-specific optimization
   - Automatic parameter tuning

3. **Cloud Integration**  
   - Hybrid local/cloud deployment
   - Cost optimization across providers
   - Latency-aware routing

4. **Advanced Caching**
   - Semantic similarity caching
   - Cross-session learning
   - Distributed cache sharing

## Conclusion

The Hybrid LLM Architecture represents a significant evolution in local AI coding assistance, combining the best aspects of speed and quality to create a system that's both responsive and intelligent. By leveraging LM Studio's Windows-optimized performance for routine tasks and Ollama's superior reasoning for complex operations, CodeCrucible Synth achieves optimal performance across all use cases.

This architecture is designed to be extensible, maintainable, and performant, providing a solid foundation for future AI-powered development tools.