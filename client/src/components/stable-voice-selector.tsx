// Production-ready Voice Selector following AI_INSTRUCTIONS.md consciousness patterns
// Implements stable state management to prevent infinite loops

import { Brain, Code, User, Star, Play, Users, Edit, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { useAppStore } from "@/store";
import { useVoiceProfiles } from "@/hooks/use-voice-profiles";
import { useTeamVoiceProfiles } from "@/hooks/useTeamVoiceProfiles";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdvancedAvatarCustomizer } from "@/components/advanced-avatar-customizer";
import * as LucideIcons from "lucide-react";
import type { VoiceProfile } from "@shared/schema";
import { useState, useCallback, useMemo } from "react";
import { validateVoiceSelection, logSecurityEvent, monitorPerformance } from "@/lib/security-validation";

export function StableVoiceSelector() {
  // Following AI_INSTRUCTIONS.md patterns: Ultra-stable selectors with direct store access
  const perspectives = useAppStore(state => state.voice.selectedPerspectives);
  const roles = useAppStore(state => state.voice.selectedRoles);
  const user = useAppStore(state => state.auth.user);
  
  // Extract actions with stable reference
  const voiceActions = useAppStore(state => state.voice.actions);
  
  const { profiles, isLoading } = useVoiceProfiles();
  const { data: sharedVoices, isLoading: sharedVoicesLoading } = useTeamVoiceProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for edit/delete functionality following AI_INSTRUCTIONS.md patterns
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<number | null>(null);

  // Following CodingPhilosophy.md: Council-based error handling for voice profile operations
  const deleteVoiceProfileMutation = useMutation({
    mutationFn: async (profileId: number) => {
      const response = await apiRequest(`/api/voice-profiles/${profileId}`, {
        method: "DELETE"
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      toast({
        title: "Success",
        description: "Voice profile deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingProfileId(null);
    },
    onError: (error: any) => {
      logSecurityEvent('VOICE_PROFILE_DELETE_ERROR', { error: error.message });
      toast({
        title: "Error",
        description: "Failed to delete voice profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Following Alexander's Pattern Language: Consistent editing patterns
  const handleEditProfile = useCallback((profile: VoiceProfile) => {
    setEditingProfile(profile);
    setShowEditDialog(true);
  }, []);

  const handleDeleteProfile = useCallback((profileId: number) => {
    setDeletingProfileId(profileId);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteProfile = useCallback(() => {
    if (deletingProfileId) {
      deleteVoiceProfileMutation.mutate(deletingProfileId);
    }
  }, [deletingProfileId, deleteVoiceProfileMutation]);

  const handleEditSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
    setShowEditDialog(false);
    setEditingProfile(null);
    toast({
      title: "Success",
      description: "Voice profile updated successfully",
    });
  }, [queryClient, toast]);

  // Following AI_INSTRUCTIONS.md: Cached icon renderer with error handling
  const renderIcon = useCallback((iconName: string, className: string) => {
    try {
      const IconComponent = (LucideIcons as any)[iconName.charAt(0).toUpperCase() + iconName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())];
      return IconComponent ? <IconComponent className={className} /> : <Brain className={className} />;
    } catch (error) {
      console.warn(`Failed to render icon: ${iconName}`, error);
      return <Brain className={className} />;
    }
  }, []);

  // Following CodingPhilosophy.md: Cache callbacks to prevent re-renders
  const handleApplyProfile = useCallback((profile: VoiceProfile) => {
    const monitor = monitorPerformance('apply-voice-profile');
    
    try {
      // Apply custom voice profile through store actions
      voiceActions.selectPerspectives(profile.selectedPerspectives || []);
      voiceActions.selectRoles(profile.selectedRoles || []);
      
      logSecurityEvent('VOICE_PROFILE_APPLIED', {
        profileId: profile.id,
        profileName: profile.name,
        perspectiveCount: profile.selectedPerspectives?.length || 0,
        roleCount: profile.selectedRoles?.length || 0
      });
      
      toast({
        title: "Profile Applied",
        description: `${profile.name} voice profile has been applied`,
      });
    } catch (error) {
      logSecurityEvent('VOICE_PROFILE_APPLY_ERROR', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: profile.id 
      });
      toast({
        title: "Error",
        description: "Failed to apply voice profile",
        variant: "destructive"
      });
    } finally {
      monitor.end();
    }
  }, [voiceActions, toast]);

  // Following CodingPhilosophy.md: Multi-voice decision pattern with security validation
  const handlePerspectiveClick = useCallback((perspectiveId: string) => {
    const monitor = monitorPerformance('perspective-selection');
    
    try {
      const isSelected = perspectives.includes(perspectiveId);
      const newPerspectives = isSelected 
        ? perspectives.filter(p => p !== perspectiveId)
        : [...perspectives, perspectiveId];
      
      // Following AI_INSTRUCTIONS.md: Validate selection with security patterns
      const validation = validateVoiceSelection({
        perspectives: newPerspectives,
        roles: roles,
        prompt: 'perspective-selection',
        context: 'UI interaction'
      });
      
      if (validation.success) {
        voiceActions.selectPerspectives(newPerspectives);
        logSecurityEvent('PERSPECTIVE_SELECTED', {
          perspectiveId,
          isSelected: !isSelected,
          totalSelected: newPerspectives.length
        });
      } else {
        toast({
          title: "Selection Limit",
          description: "Maximum 5 voices can be selected at once",
          variant: "destructive"
        });
      }
    } catch (error) {
      logSecurityEvent('PERSPECTIVE_SELECTION_ERROR', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        perspectiveId 
      });
      toast({
        title: "Error",
        description: "Failed to update voice selection",
        variant: "destructive"
      });
    } finally {
      monitor.end();
    }
  }, [perspectives, roles, voiceActions, toast]);

  const handleRoleClick = useCallback((roleId: string) => {
    const monitor = monitorPerformance('role-selection');
    
    try {
      const isSelected = roles.includes(roleId);
      const newRoles = isSelected 
        ? roles.filter(r => r !== roleId)
        : [...roles, roleId];
      
      // Following AI_INSTRUCTIONS.md: Validate selection with security patterns
      const validation = validateVoiceSelection({
        perspectives: perspectives,
        roles: newRoles,
        prompt: 'role-selection',
        context: 'UI interaction'
      });
      
      if (validation.success) {
        voiceActions.selectRoles(newRoles);
        logSecurityEvent('ROLE_SELECTED', {
          roleId,
          isSelected: !isSelected,
          totalSelected: newRoles.length
        });
      } else {
        toast({
          title: "Selection Limit",
          description: "Maximum 4 specialization roles can be selected",
          variant: "destructive"
        });
      }
    } catch (error) {
      logSecurityEvent('ROLE_SELECTION_ERROR', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        roleId 
      });
      toast({
        title: "Error",
        description: "Failed to update role selection",
        variant: "destructive"
      });
    } finally {
      monitor.end();
    }
  }, [perspectives, roles, voiceActions, toast]);

  const renderUserProfileCard = useCallback((profile: VoiceProfile) => {
    // Following Jung's Descent Protocol: Visual consciousness feedback for applied profiles
    const isApplied = false; // TODO: Track applied profile in store
    
    return (
      <Card
        key={profile.id}
        className={`p-3 transition-all group border ${
          isApplied 
            ? "border-green-500 bg-green-500/20 shadow-lg shadow-green-500/20" 
            : "border-gray-600 bg-gray-700/50 hover:border-purple-500/40 hover:bg-purple-500/10"
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20">
            <span className="text-sm">{profile.avatar || "🤖"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm text-purple-300 flex items-center gap-2">
                {profile.name}
                {profile.isDefault && (
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                )}
                {isApplied && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-500/20 text-green-400 border-green-400/40">
                    Active
                  </Badge>
                )}
              </h4>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApplyProfile(profile);
                  }}
                  className={`h-6 px-2 text-xs ${
                    isApplied 
                      ? "text-green-400 hover:text-green-300 hover:bg-green-500/20" 
                      : "text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                  }`}
                  title={isApplied ? "Profile currently applied" : "Apply this profile"}
                  disabled={isApplied}
                >
                  <Play className="w-3 h-3 mr-1" />
                  {isApplied ? "Applied" : "Apply"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditProfile(profile);
                  }}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20"
                  title="Edit profile"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProfile(profile.id);
                  }}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/20"
                  title="Delete profile"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1 mt-1 mb-1">
              {profile.selectedPerspectives?.slice(0, 2).map((perspectiveId: any) => {
                const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
                return perspective ? (
                  <Badge key={perspectiveId} variant="outline" className="text-xs px-1 py-0">
                    {perspective.name}
                  </Badge>
                ) : null;
              })}
              {profile.selectedRoles?.slice(0, 2).map((roleId: any) => {
                const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
                return role ? (
                  <Badge key={roleId} variant="outline" className="text-xs px-1 py-0">
                    {role.name}
                  </Badge>
                ) : null;
              })}
            </div>
            <p className="text-xs text-gray-400 truncate">{profile.description || profile.specialization}</p>
          </div>
        </div>
      </Card>
    );
  }, [handleApplyProfile, handleEditProfile, handleDeleteProfile]);

  return (
    <div className="p-4">
      <Tabs defaultValue="perspectives" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4 h-auto bg-gray-800/50 border border-gray-700">
          <TabsTrigger 
            value="perspectives" 
            className="text-xs px-2 py-3 flex flex-col items-center space-y-1 data-[state=active]:bg-gray-700 data-[state=active]:text-gray-100 text-gray-400 hover:text-gray-200" 
            data-tour="perspectives-tab"
          >
            <Brain className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap leading-tight">Analysis</span>
          </TabsTrigger>
          <TabsTrigger 
            value="roles" 
            className="text-xs px-2 py-3 flex flex-col items-center space-y-1 data-[state=active]:bg-gray-700 data-[state=active]:text-gray-100 text-gray-400 hover:text-gray-200" 
            data-tour="roles-tab"
          >
            <Code className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap leading-tight">Specialization</span>
          </TabsTrigger>
          <TabsTrigger 
            value="profiles" 
            className="text-xs px-2 py-3 flex flex-col items-center space-y-1 data-[state=active]:bg-gray-700 data-[state=active]:text-gray-100 text-gray-400 hover:text-gray-200"
          >
            <User className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap leading-tight">My Profiles</span>
          </TabsTrigger>
          <TabsTrigger 
            value="team-profiles" 
            className="text-xs px-2 py-3 flex flex-col items-center space-y-1 data-[state=active]:bg-gray-700 data-[state=active]:text-gray-100 text-gray-400 hover:text-gray-200"
          >
            <Users className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap leading-tight">Team Profiles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perspectives" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <Brain className="w-4 h-4 mr-2 text-blue-400" />
              Code Analysis Engines
            </h3>
            <div className="space-y-2">
              {CODE_PERSPECTIVES.map((perspective) => {
                const isSelected = perspectives.includes(perspective.id);
                
                return (
                  <Card
                    key={perspective.id}
                    className={`p-3 cursor-pointer transition-all group border ${
                      isSelected 
                        ? `border-blue-500/40 bg-blue-500/10` 
                        : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                    }`}
                    onClick={() => handlePerspectiveClick(perspective.id)}
                    data-tour="perspective-button"
                    data-selected={isSelected}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-500/20' : 'bg-gray-600/50'
                      }`}>
                        {renderIcon(perspective.icon, `w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className={`font-medium text-sm ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                            {perspective.name}
                          </h4>
                          <div className={`w-3 h-3 border rounded-sm transition-colors ${
                            isSelected ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
                          }`} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{perspective.function}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <Code className="w-4 h-4 mr-2 text-green-400" />
              Code Specialization Engines
            </h3>
            <div className="space-y-2">
              {DEVELOPMENT_ROLES.map((role) => {
                const isSelected = roles.includes(role.id);
                
                return (
                  <Card
                    key={role.id}
                    className={`p-3 cursor-pointer transition-all group border ${
                      isSelected
                        ? `border-green-500/40 bg-green-500/10`
                        : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                    }`}
                    onClick={() => handleRoleClick(role.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-green-500/20' : 'bg-gray-600/50'
                      }`}>
                        {renderIcon(role.icon, `w-4 h-4 ${isSelected ? 'text-green-400' : 'text-gray-400'}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className={`font-medium text-sm ${isSelected ? 'text-green-300' : 'text-gray-200'}`}>
                            {role.name}
                          </h5>
                          <div className={`w-3 h-3 border rounded-sm transition-colors ${
                            isSelected ? 'border-green-400 bg-green-400' : 'border-gray-500'
                          }`} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{role.domain}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <User className="w-4 h-4 mr-2 text-purple-400" />
              My Voice Profiles
            </h3>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading profiles...</p>
              </div>
            ) : profiles?.length ? (
              <div className="space-y-3">
                {profiles.map(renderUserProfileCard)}
              </div>
            ) : (
              <div className="text-center py-8">
                <User className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No custom voice profiles yet</p>
                <p className="text-xs text-gray-500">Create your first voice profile to get started</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="team-profiles" className="space-y-6 mt-0">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center uppercase tracking-wider">
              <Users className="w-4 h-4 mr-2 text-indigo-400" />
              Team Voice Profiles
            </h3>
            {sharedVoicesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading team profiles...</p>
              </div>
            ) : sharedVoices?.sharedProfiles?.length ? (
              <div className="space-y-3">
                {sharedVoices.sharedProfiles.map(renderUserProfileCard)}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">No team voice profiles available</p>
                <p className="text-xs text-gray-500">Team members haven't shared any voice profiles yet</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-100">
              Edit Voice Profile
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Customize your voice profile settings and personality traits
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <AdvancedAvatarCustomizer
              profile={editingProfile}
              onSave={handleEditSuccess}
              onCancel={() => setShowEditDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Voice Profile
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this voice profile? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProfile}
              disabled={deleteVoiceProfileMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteVoiceProfileMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}