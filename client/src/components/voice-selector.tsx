import { Brain, Code, User, Star, Play, Users, Edit, Trash2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";
import { useVoiceSelection, useVoiceActions, useAuthState } from "@/store";
import { validateVoiceSelection, logSecurityEvent, monitorPerformance } from "@/lib/security-validation";
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

export function PerspectiveSelector() {
  // Following AI_INSTRUCTIONS.md patterns: Single stable hook call to prevent infinite loops
  const voiceSelection = useVoiceSelection();
  const voiceActions = useVoiceActions();
  
  // Extract values with stable references
  const perspectives = voiceSelection.selectedPerspectives;
  const roles = voiceSelection.selectedRoles;
  
  const { user } = useAuthState();
  const { profiles, isLoading } = useVoiceProfiles();
  const { data: sharedVoices, isLoading: sharedVoicesLoading } = useTeamVoiceProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for edit/delete functionality following AI_INSTRUCTIONS.md patterns
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [deletingProfileId, setDeletingProfileId] = useState<number | null>(null);

  // Jung's Descent Protocol: Council-based error handling for voice profile operations
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
      console.error("Delete voice profile error:", error);
      toast({
        title: "Error",
        description: "Failed to delete voice profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Alexander's Pattern Language: Consistent editing patterns
  const handleEditProfile = (profile: VoiceProfile) => {
    setEditingProfile(profile);
    setShowEditDialog(true);
  };

  const handleDeleteProfile = (profileId: number) => {
    setDeletingProfileId(profileId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteProfile = () => {
    if (deletingProfileId) {
      deleteVoiceProfileMutation.mutate(deletingProfileId);
    }
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
    setShowEditDialog(false);
    setEditingProfile(null);
    toast({
      title: "Success",
      description: "Voice profile updated successfully",
    });
  };

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
    // Apply custom voice profile through store actions
    voiceActions.selectPerspectives(profile.selectedPerspectives || []);
    voiceActions.selectRoles(profile.selectedRoles || []);
    
    toast({
      title: "Profile Applied",
      description: `${profile.name} voice profile has been applied`,
    });
  }, [voiceActions, toast]);

  const renderUserProfileCard = (profile: VoiceProfile) => {
    // Jung's Descent Protocol: Visual consciousness feedback for applied profiles
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
  };

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
                
                // Following CodingPhilosophy.md: Multi-voice decision pattern with security validation
                const handlePerspectiveClick = () => {
                  const monitor = monitorPerformance('perspective-selection');
                  
                  try {
                    // Council decision: Should this perspective be selected?
                    const newPerspectives = isSelected 
                      ? perspectives.filter(p => p !== perspective.id)
                      : [...perspectives, perspective.id];
                    
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
                        perspectiveId: perspective.id,
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
                    console.error("Failed to toggle perspective:", error);
                    logSecurityEvent('PERSPECTIVE_SELECTION_ERROR', { 
                      error: error instanceof Error ? error.message : 'Unknown error',
                      perspectiveId: perspective.id 
                    });
                    toast({
                      title: "Error",
                      description: "Failed to update voice selection",
                      variant: "destructive"
                    });
                  } finally {
                    monitor.end();
                  }
                };
                
                return (
                  <Card
                    key={perspective.id}
                    className={`p-3 cursor-pointer transition-all group border ${
                      isSelected 
                        ? `border-blue-500/40 bg-blue-500/10` 
                        : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                    }`}
                    onClick={handlePerspectiveClick}
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
                
                // Following CodingPhilosophy.md: Multi-voice decision pattern with security validation
                const handleRoleClick = () => {
                  const monitor = monitorPerformance('role-selection');
                  
                  try {
                    // Council decision: Should this role be selected?
                    const newRoles = isSelected 
                      ? roles.filter(r => r !== role.id)
                      : [...roles, role.id];
                    
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
                        roleId: role.id,
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
                    console.error("Failed to toggle role:", error);
                    logSecurityEvent('ROLE_SELECTION_ERROR', { 
                      error: error instanceof Error ? error.message : 'Unknown error',
                      roleId: role.id 
                    });
                    toast({
                      title: "Error",
                      description: "Failed to update role selection",
                      variant: "destructive"
                    });
                  } finally {
                    monitor.end();
                  }
                };
                
                return (
                  <Card
                    key={role.id}
                    className={`p-3 cursor-pointer transition-all group border ${
                      isSelected
                        ? `border-green-500/40 bg-green-500/10`
                        : `border-gray-600 bg-gray-700/50 hover:border-gray-500`
                    }`}
                    onClick={handleRoleClick}
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
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="text-sm text-gray-400">Loading profiles...</div>
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-center py-6">
                  <User className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400 mb-2" />
                  <div className="text-sm text-gray-400 mb-2">No profiles yet</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Create custom profiles in Settings</div>
                </div>
              ) : (
                profiles.map(renderUserProfileCard)
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team-profiles" className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-gray-300">Team's Profiles</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Voice profiles shared by your team members</p>
            </div>
          </div>
          
          {sharedVoicesLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Loading team profiles...</p>
            </div>
          ) : !sharedVoices?.sharedProfiles || sharedVoices.sharedProfiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team profiles shared yet</p>
              <p className="text-xs mt-1">Team members can share their custom voice profiles here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sharedVoices.sharedProfiles.map((profile: any) => (
                <Card
                  key={profile.id}
                  className="p-3 cursor-pointer transition-all group border border-gray-600 bg-gray-700/50 hover:border-blue-500/40 hover:bg-blue-500/10"
                  onClick={() => {
                    // Convert shared profile to VoiceProfile format for application
                    const voiceProfile = {
                      id: profile.id,
                      name: profile.name,
                      description: profile.description,
                      selectedPerspectives: profile.specializations?.slice(0, 2) || [],
                      selectedRoles: profile.specializations?.slice(0, 2) || [],
                      avatar: "👥",
                      specialization: profile.specializations?.join(', ') || '',
                      isDefault: false
                    };
                    handleApplyProfile(voiceProfile as VoiceProfile);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20">
                      <span className="text-sm">👥</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-blue-300 flex items-center gap-2">
                          {profile.name}
                          <Badge variant="outline" className="text-xs px-1 py-0 bg-blue-500/10 border-blue-500/30">
                            Team
                          </Badge>
                        </h4>
                        <Play className="w-3 h-3 text-gray-400 group-hover:text-blue-400" />
                      </div>
                      <div className="flex gap-1 mt-1 mb-1">
                        {profile.specializations?.slice(0, 3).map((spec: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs px-1 py-0">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 truncate">{profile.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>by {profile.creator}</span>
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {profile.effectiveness}% effective
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bateson's Recursive Learning: Edit Dialog with Meta-Learning */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-100">Edit Voice Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Modify your AI voice profile to enhance its consciousness and pattern recognition capabilities.
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <AdvancedAvatarCustomizer
              initialData={editingProfile}
              onSuccess={handleEditSuccess}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Campbell's Mythic Journey: Delete Confirmation with Sacred Ritual */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Delete Voice Profile
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This action cannot be undone. The voice profile and all its consciousness patterns will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="border-gray-600 text-gray-400 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProfile}
              disabled={deleteVoiceProfileMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteVoiceProfileMutation.isPending ? "Deleting..." : "Delete Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Applied Profile Status removed - undefined variable causing crash */}
    </div>
  );
}