import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Scale, Shield, FileText, Mail, Calendar } from "lucide-react";

export default function LegalSection() {
  const [activeTab, setActiveTab] = useState("terms");

  return (
    <Card className="bg-gray-800/50 border-gray-700/50 mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-gray-200 text-sm font-medium">
          <Scale className="h-4 w-4 mr-2 text-gray-400" />
          Legal Information
          <Badge variant="secondary" className="ml-2 bg-gray-700/30 text-gray-400 text-xs">
            Updated July 11, 2025
          </Badge>
        </CardTitle>
        <CardDescription className="text-gray-400 text-xs">
          Terms of Service and Privacy Policy for CodeCrucible platform usage
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800/30 border border-gray-600/30 mb-4">
            <TabsTrigger 
              value="terms" 
              className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-200 text-gray-400 text-xs hover:text-gray-300 transition-colors"
            >
              <FileText className="h-3 w-3 mr-1" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger 
              value="privacy" 
              className="data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-200 text-gray-400 text-xs hover:text-gray-300 transition-colors"
            >
              <Shield className="h-3 w-3 mr-1" />
              Privacy Policy
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="terms" className="mt-0">
            <ScrollArea className="h-64 w-full rounded-md border border-gray-600/50 bg-gray-800/30 p-4">
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-center mb-3">
                  <FileText className="h-4 w-4 mr-2 text-gray-400" />
                  <h3 className="font-semibold text-gray-200">Terms of Service</h3>
                  <div className="flex items-center ml-auto text-xs text-gray-500">
                    <Calendar className="h-3 w-3 mr-1" />
                    Effective: July 11, 2025
                  </div>
                </div>
                
                <div className="space-y-4">
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">1. Overview</h4>
                    <p className="text-gray-300 leading-relaxed">
                      CodeCrucible is a web-based multi-voice AI development platform created by Rhythm Chamber. 
                      These Terms govern your access to and use of the service. By using the platform, you agree to these Terms.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">2. Subscriptions and Payments</h4>
                    <p className="text-gray-300 leading-relaxed mb-2">
                      We offer Free, Pro ($15/month), and Team ($50/month) plans.
                    </p>
                    <ul className="text-gray-400 text-xs space-y-1 ml-4">
                      <li>• Payments are processed securely via Stripe</li>
                      <li>• You may cancel at any time</li>
                      <li>• Access will persist until the end of the current billing cycle</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">3. Acceptable Use</h4>
                    <p className="text-gray-300 leading-relaxed mb-2">You agree not to:</p>
                    <ul className="text-gray-400 text-xs space-y-1 ml-4">
                      <li>• Abuse or attempt to bypass system limits</li>
                      <li>• Reverse-engineer or tamper with service logic</li>
                      <li>• Use the product to generate malicious or unethical code</li>
                    </ul>
                    <p className="text-gray-400 text-xs mt-2">
                      We reserve the right to suspend or terminate access for violations.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">4. Intellectual Property</h4>
                    <p className="text-gray-300 leading-relaxed">
                      All generated code belongs to the user. The platform logic, architecture, and voice framework 
                      remain the property of Rhythm Chamber.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">5. Availability</h4>
                    <p className="text-gray-300 leading-relaxed">
                      We strive for high uptime but do not guarantee uninterrupted access.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">6. Limitation of Liability</h4>
                    <p className="text-gray-300 leading-relaxed">
                      We are not liable for damages from misuse, code bugs, or outages. Use is at your own risk.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">7. Privacy</h4>
                    <p className="text-gray-300 leading-relaxed">
                      Your use of the service is governed by our Privacy Policy.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">8. Contact</h4>
                    <div className="flex items-center">
                      <Mail className="h-3 w-3 mr-2 text-gray-400" />
                      <a 
                        href="mailto:support@rhythmchamber.app" 
                        className="text-gray-300 hover:text-gray-200 text-sm underline"
                      >
                        support@rhythmchamber.app
                      </a>
                    </div>
                  </section>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="privacy" className="mt-0">
            <ScrollArea className="h-64 w-full rounded-md border border-gray-600/50 bg-gray-800/30 p-4">
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-center mb-3">
                  <Shield className="h-4 w-4 mr-2 text-gray-400" />
                  <h3 className="font-semibold text-gray-200">Privacy Policy</h3>
                  <div className="flex items-center ml-auto text-xs text-gray-500">
                    <Calendar className="h-3 w-3 mr-1" />
                    Effective: July 11, 2025
                  </div>
                </div>
                
                <div className="space-y-4">
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">1. What We Collect</h4>
                    <ul className="text-gray-400 text-xs space-y-1 ml-4">
                      <li>• Email, usage logs, and Stripe billing info</li>
                      <li>• Generation patterns (not code contents)</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">2. How We Use Data</h4>
                    <ul className="text-gray-400 text-xs space-y-1 ml-4">
                      <li>• Enforce subscription limits</li>
                      <li>• Improve model behavior</li>
                      <li>• Detect abuse via logging</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">3. Sharing</h4>
                    <p className="text-gray-300 leading-relaxed mb-2">
                      We never sell your data. Shared only with:
                    </p>
                    <ul className="text-gray-400 text-xs space-y-1 ml-4">
                      <li>• Stripe (billing)</li>
                      <li>• Log systems (e.g., Sentry/PostHog)</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">4. Security</h4>
                    <p className="text-gray-300 leading-relaxed">
                      Strict quota enforcement, session rate-limiting, and audit logging are implemented 
                      following AI_INSTRUCTIONS.md security patterns.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">5. Cookies & Tracking</h4>
                    <p className="text-gray-300 leading-relaxed">
                      Cookies are used for session and analytics only.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">6. Data Retention</h4>
                    <p className="text-gray-300 leading-relaxed">
                      Plan status and generation logs are kept for 30 days. No generation contents are retained.
                    </p>
                  </section>
                  
                  <section>
                    <h4 className="font-medium text-gray-300 mb-2">7. Your Rights</h4>
                    <p className="text-gray-300 leading-relaxed">
                      You can request, correct, or delete your data by contacting support.
                    </p>
                    <div className="flex items-center mt-2">
                      <Mail className="h-3 w-3 mr-2 text-gray-400" />
                      <a 
                        href="mailto:support@rhythmchamber.app" 
                        className="text-gray-300 hover:text-gray-200 text-sm underline"
                      >
                        support@rhythmchamber.app
                      </a>
                    </div>
                  </section>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}