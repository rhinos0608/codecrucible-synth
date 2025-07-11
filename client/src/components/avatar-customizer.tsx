import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateVoiceProfile, useVoiceProfiles, useUpdateVoiceProfile } from "@/hooks/use-voice-profiles";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Brain, Palette, Sparkles, Settings, MessageSquare, User } from "lucide-react";
import type { VoiceProfile } from "@shared/schema";

const voiceProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  perspective: z.string().min(1, "Perspective is required"),
  role: z.string().min(1, "Role is required"),
  personality: z.string().min(1, "Personality description is required").max(500),
  avatar: z.string().optional(),
  chatStyle: z.string().min(1, "Chat style is required"),
  specialization: z.string().min(1, "Specialization is required").max(200),
  ethicalStance: z.string().min(1, "Ethical stance is required"),
  isDefault: z.boolean().default(false),
});

interface AvatarCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  editingProfile?: VoiceProfile | null;
}

export function AvatarCustomizer({ isOpen, onClose, editingProfile }: AvatarCustomizerProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("🤖");
  const { profiles } = useVoiceProfiles();
  const createProfile = useCreateVoiceProfile();
  const updateProfile = useUpdateVoiceProfile();

  const form = useForm({
    resolver: zodResolver(voiceProfileSchema),
    defaultValues: editingProfile ? {
      name: editingProfile.name,
      perspective: editingProfile.perspective,
      role: editingProfile.role,
      personality: editingProfile.personality,
      avatar: editingProfile.avatar || "🤖",
      chatStyle: editingProfile.chatStyle,
      specialization: editingProfile.specialization,
      ethicalStance: editingProfile.ethicalStance,
      isDefault: editingProfile.isDefault,
    } : {
      name: "",
      perspective: "",
      role: "",
      personality: "",
      avatar: "🤖",
      chatStyle: "analytical",
      specialization: "",
      ethicalStance: "neutral",
      isDefault: false,
    },
  });

  const perspectives = [
    { value: "seeker", label: "Explorer", description: "Investigates edge cases, alternative algorithms" },
    { value: "steward", label: "Maintainer", description: "Focuses on code sustainability and technical debt" },
    { value: "witness", label: "Analyzer", description: "Identifies patterns, performance bottlenecks, code smells" },
    { value: "nurturer", label: "Developer", description: "Prioritizes developer experience and API usability" },
    { value: "decider", label: "Implementor", description: "Makes technical decisions, ships production code" },
  ];

  const roles = [
    { value: "guardian", label: "Security Engineer", description: "Vulnerability analysis, input validation, secure coding" },
    { value: "architect", label: "Systems Architect", description: "Scalable architecture, design patterns, microservices" },
    { value: "designer", label: "UI/UX Engineer", description: "Component design, responsive layouts, accessibility" },
    { value: "optimizer", label: "Performance Engineer", description: "Algorithm optimization, caching, performance monitoring" },
  ];

  const avatarOptions = ["🤖", "👨‍💻", "👩‍💻", "🧠", "⚡", "🔮", "🎯", "🌟", "🛡️", "🏗️", "🎨", "⚙️"];

  const chatStyles = [
    { value: "analytical", label: "Analytical", description: "Detailed, structured responses" },
    { value: "creative", label: "Creative", description: "Imaginative, out-of-the-box thinking" },
    { value: "concise", label: "Concise", description: "Brief, to-the-point communication" },
    { value: "conversational", label: "Conversational", description: "Friendly, casual dialogue" },
    { value: "technical", label: "Technical", description: "Deep technical explanations" },
  ];

  const ethicalStances = [
    { value: "neutral", label: "Neutral", description: "Balanced ethical considerations" },
    { value: "progressive", label: "Progressive", description: "Innovation-focused ethics" },
    { value: "conservative", label: "Conservative", description: "Safety-first approach" },
    { value: "collaborative", label: "Collaborative", description: "Team-focused decisions" },
  ];

  const onSubmit = async (data: any) => {
    try {
      if (editingProfile) {
        await updateProfile.mutateAsync({ 
          id: editingProfile.id, 
          updates: { ...data, avatar: selectedAvatar } 
        });
      } else {
        await createProfile.mutateAsync({ ...data, avatar: selectedAvatar });
      }
      form.reset();
      onClose();
    } catch (error) {
      console.error("Failed to save voice profile:", error);
    }
  };

  const isPending = createProfile.isPending || updateProfile.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {editingProfile ? "Edit Code Engine Profile" : "Create Custom Code Engine Profile"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic" className="flex items-center gap-1">
              <User className="w-4 h-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="avatar" className="flex items-center gap-1">
              <Palette className="w-4 h-4" />
              Avatar
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Chat Style
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Engine Profile Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., My Senior Full-Stack Engine" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specialization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialization</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., React, Python, DevOps" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="perspective"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Archetype Perspective</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select perspective" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {perspectives.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  <div>
                                    <div className="font-medium">{p.label}</div>
                                    <div className="text-xs text-muted-foreground">{p.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coding Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roles.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  <div>
                                    <div className="font-medium">{r.label}</div>
                                    <div className="text-xs text-muted-foreground">{r.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="personality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personality & Approach</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe how this voice should approach problems, communicate, and make decisions..."
                            className="h-24"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="avatar" className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Choose Avatar</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select an emoji that represents this voice profile
                    </p>
                    <div className="grid grid-cols-6 gap-3">
                      {avatarOptions.map((emoji) => (
                        <Button
                          key={emoji}
                          type="button"
                          variant={selectedAvatar === emoji ? "default" : "outline"}
                          className="h-12 text-2xl"
                          onClick={() => setSelectedAvatar(emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Avatar Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="text-4xl">{selectedAvatar}</div>
                        <div>
                          <p className="font-medium">{form.watch("name") || "Profile Name"}</p>
                          <p className="text-sm text-muted-foreground">
                            {form.watch("perspective")} • {form.watch("role")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chat" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="chatStyle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Communication Style</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select chat style" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {chatStyles.map((style) => (
                                <SelectItem key={style.value} value={style.value}>
                                  <div>
                                    <div className="font-medium">{style.label}</div>
                                    <div className="text-xs text-muted-foreground">{style.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ethicalStance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ethical Stance</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select ethical approach" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ethicalStances.map((stance) => (
                                <SelectItem key={stance.value} value={stance.value}>
                                  <div>
                                    <div className="font-medium">{stance.label}</div>
                                    <div className="text-xs text-muted-foreground">{stance.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-2xl">{selectedAvatar}</span>
                        {form.watch("name") || "Voice Profile"}
                      </CardTitle>
                      <CardDescription>
                        {form.watch("specialization") && (
                          <Badge variant="secondary" className="mr-2">
                            {form.watch("specialization")}
                          </Badge>
                        )}
                        <Badge variant="outline" className="mr-2">
                          {form.watch("perspective")} Perspective
                        </Badge>
                        <Badge variant="outline">
                          {form.watch("role")} Role
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Personality</h4>
                        <p className="text-sm text-muted-foreground">
                          {form.watch("personality") || "No personality description provided."}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Chat Style:</span> {form.watch("chatStyle")}
                        </div>
                        <div>
                          <span className="font-medium">Ethical Stance:</span> {form.watch("ethicalStance")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving..." : editingProfile ? "Update Profile" : "Create Profile"}
                    </Button>
                  </div>
                </TabsContent>
              </form>
            </Form>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}