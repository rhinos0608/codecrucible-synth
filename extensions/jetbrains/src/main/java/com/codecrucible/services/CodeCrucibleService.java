// JetBrains Plugin - CodeCrucible Service
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

package com.codecrucible.services;

import com.codecrucible.api.CodeCrucibleApi;
import com.codecrucible.models.*;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.psi.PsiFile;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service(Service.Level.PROJECT)
public final class CodeCrucibleService {
    private static final Logger LOG = Logger.getInstance(CodeCrucibleService.class);
    
    private final Project project;
    private final CodeCrucibleApi api;
    private final AuthenticationService authService;
    private final ContextExtractionService contextService;
    
    public CodeCrucibleService(@NotNull Project project) {
        this.project = project;
        this.authService = ApplicationManager.getApplication().getService(AuthenticationService.class);
        this.api = new CodeCrucibleApi(authService);
        this.contextService = new ContextExtractionService();
    }
    
    public static CodeCrucibleService getInstance(@NotNull Project project) {
        return project.getService(CodeCrucibleService.class);
    }
    
    /**
     * Generate code using AI council with consciousness-driven approach
     */
    public CompletableFuture<GenerationResult> generateWithCouncil(
            @NotNull String prompt,
            @Nullable PsiFile currentFile,
            @NotNull VoiceSelection voices
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOG.info("Starting AI council generation for prompt: " + prompt.substring(0, Math.min(prompt.length(), 50)) + "...");
                
                // Extract context from current file and project
                CodeContext context = contextService.extractContext(currentFile, project);
                
                // Create generation request following consciousness principles
                GenerationRequest request = GenerationRequest.builder()
                    .prompt(prompt)
                    .context(context)
                    .voices(voices)
                    .synthesisMode(SynthesisMode.COLLABORATIVE)
                    .maxSolutions(4)
                    .build();
                
                // Call API for generation
                GenerationResponse response = api.generate(request);
                
                LOG.info("Generation completed. Session ID: " + response.getSessionId() + 
                        ", Solutions: " + response.getSolutions().size());
                
                return GenerationResult.success(response);
                
            } catch (Exception e) {
                LOG.error("Generation failed", e);
                return GenerationResult.failure("Generation failed: " + e.getMessage());
            }
        });
    }
    
    /**
     * Synthesize multiple solutions into optimized result
     */
    public CompletableFuture<SynthesisResult> synthesizeSolutions(
            @NotNull List<Solution> solutions,
            @NotNull SynthesisGoal goal
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOG.info("Starting solution synthesis with " + solutions.size() + " solutions");
                
                SynthesisRequest request = SynthesisRequest.builder()
                    .solutions(solutions)
                    .synthesisGoal(goal)
                    .build();
                
                SynthesisResponse response = api.synthesize(request);
                
                LOG.info("Synthesis completed. Quality score: " + response.getQualityScore());
                
                return SynthesisResult.success(response);
                
            } catch (Exception e) {
                LOG.error("Synthesis failed", e);
                return SynthesisResult.failure("Synthesis failed: " + e.getMessage());
            }
        });
    }
    
    /**
     * Get AI-powered voice recommendations based on prompt and context
     */
    public CompletableFuture<List<VoiceRecommendation>> getVoiceRecommendations(
            @NotNull String prompt,
            @Nullable PsiFile currentFile
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOG.info("Getting voice recommendations for prompt");
                
                CodeContext context = currentFile != null ? 
                    contextService.extractContext(currentFile, project) : null;
                
                VoiceRecommendationResponse response = api.getRecommendations(prompt, context);
                
                return response.getRecommendations();
                
            } catch (Exception e) {
                LOG.error("Voice recommendations failed", e);
                return List.of(); // Return empty list on failure
            }
        });
    }
    
    /**
     * Review current file with AI council
     */
    public CompletableFuture<ReviewResult> reviewCurrentFile(@NotNull PsiFile file) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOG.info("Starting AI council review for file: " + file.getName());
                
                String fileContent = file.getText();
                CodeContext context = contextService.extractContext(file, project);
                
                // Create review-specific prompt
                String reviewPrompt = String.format(
                    "Please review this %s file for code quality, security, performance, and best practices:\n\n%s",
                    file.getLanguage().getDisplayName(),
                    fileContent
                );
                
                // Use review-focused voices
                VoiceSelection reviewVoices = VoiceSelection.builder()
                    .perspectives(List.of("Analyzer", "Maintainer"))
                    .roles(List.of("Security Engineer", "Performance Engineer"))
                    .build();
                
                GenerationRequest request = GenerationRequest.builder()
                    .prompt(reviewPrompt)
                    .context(context)
                    .voices(reviewVoices)
                    .synthesisMode(SynthesisMode.CONSENSUS)
                    .maxSolutions(3)
                    .build();
                
                GenerationResponse response = api.generate(request);
                
                // Convert generation response to review result
                return ReviewResult.fromGenerationResponse(response);
                
            } catch (Exception e) {
                LOG.error("File review failed", e);
                return ReviewResult.failure("Review failed: " + e.getMessage());
            }
        });
    }
    
    /**
     * Explain selected code using AI council
     */
    public CompletableFuture<ExplanationResult> explainCode(
            @NotNull String selectedCode,
            @NotNull PsiFile file
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                LOG.info("Getting code explanation for selection");
                
                CodeContext context = contextService.extractContext(file, project);
                
                String explanationPrompt = String.format(
                    "Please explain this %s code in detail, including its purpose, functionality, and any potential improvements:\n\n%s",
                    file.getLanguage().getDisplayName(),
                    selectedCode
                );
                
                // Use explanation-focused voices
                VoiceSelection explainerVoices = VoiceSelection.builder()
                    .perspectives(List.of("Explorer", "Maintainer"))
                    .roles(List.of("Systems Architect"))
                    .build();
                
                GenerationRequest request = GenerationRequest.builder()
                    .prompt(explanationPrompt)
                    .context(context)
                    .voices(explainerVoices)
                    .synthesisMode(SynthesisMode.COLLABORATIVE)
                    .maxSolutions(2)
                    .build();
                
                GenerationResponse response = api.generate(request);
                
                return ExplanationResult.fromGenerationResponse(response);
                
            } catch (Exception e) {
                LOG.error("Code explanation failed", e);
                return ExplanationResult.failure("Explanation failed: " + e.getMessage());
            }
        });
    }
    
    /**
     * Check API connection status
     */
    public CompletableFuture<ApiStatus> checkApiStatus() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return api.getApiStatus();
            } catch (Exception e) {
                LOG.error("API status check failed", e);
                return ApiStatus.builder()
                    .connected(false)
                    .authenticated(authService.isAuthenticated())
                    .error(e.getMessage())
                    .build();
            }
        });
    }
    
    /**
     * Get usage analytics for the extension
     */
    public CompletableFuture<UsageAnalytics> getUsageAnalytics() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return api.getUsage();
            } catch (Exception e) {
                LOG.error("Usage analytics failed", e);
                return UsageAnalytics.empty();
            }
        });
    }
    
    /**
     * Test API connection and authentication
     */
    public CompletableFuture<Boolean> testConnection() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return api.testConnection();
            } catch (Exception e) {
                LOG.error("Connection test failed", e);
                return false;
            }
        });
    }
    
    /**
     * Dispose resources
     */
    public void dispose() {
        // Clean up resources if needed
        LOG.info("CodeCrucible service disposed for project: " + project.getName());
    }
}