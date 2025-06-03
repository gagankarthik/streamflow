
"use client";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LifeBuoy, MessageSquare, BookOpen, Search, Send } from "lucide-react";

const faqs = [
  {
    question: "How do I create a new project?",
    answer: "To create a new project, navigate to the 'Projects' page from the sidebar and click the 'Create New Project' button. Fill in the required details and save."
  },
  {
    question: "Can I invite team members to a project?",
    answer: "Yes, you can invite team members to specific projects. Go to the project's settings, find the 'Team Management' section, and use the invite option."
  },
  {
    question: "How does task prioritization work?",
    answer: "Tasks can be assigned priority levels (e.g., High, Medium, Low). This helps in organizing work and focusing on critical items first. You can set priority when creating or editing a task."
  },
  {
    question: "Is there a mobile app for ProjectFlow?",
    answer: "Currently, ProjectFlow is optimized for web browsers on desktop and mobile devices. A dedicated mobile app is planned for future development."
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Support Center"
        description="Find help with ProjectFlow. Explore FAQs, documentation, or contact us directly."
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Search className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
              </div>
              <CardDescription>Find answers to common questions about ProjectFlow.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem value={`item-${index + 1}`} key={index}>
                    <AccordionTrigger className="text-left hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                 <BookOpen className="h-6 w-6 text-primary" />
                <CardTitle>Documentation</CardTitle>
              </div>
              <CardDescription>Explore our comprehensive guides and tutorials.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Read Documentation
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" />
                <CardTitle>Contact Support</CardTitle>
              </div>
              <CardDescription>Can't find an answer? Reach out to our support team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supportSubject">Subject</Label>
                <Input id="supportSubject" placeholder="e.g., Issue with Kanban board" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportMessage">Message</Label>
                <Textarea id="supportMessage" placeholder="Describe your issue in detail..." rows={4} />
              </div>
              <Button className="w-full">
                <Send className="mr-2 h-4 w-4" /> Send Message
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
