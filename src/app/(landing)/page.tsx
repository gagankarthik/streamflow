
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { LoadingSpinner } from "@/components/common/loading-spinner";
import { ArrowRight, CheckCircle, Users, Zap, BarChart, ListChecks, MessageSquare, Users2, TrendingUp, Smile, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const features = [
  {
    icon: <ListChecks className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Intuitive Task Management",
    description: "Organize, assign, and track tasks effortlessly with our clean and simple interface. Focus on what truly matters.",
  },
  {
    icon: <Users2 className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Seamless Team Collaboration",
    description: "Work together in real-time, share files, and keep everyone on the same page, fostering clear communication.",
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Clear Progress Tracking",
    description: "Visualize project progress at a glance with intuitive boards and insightful summaries. Stay informed and on track.",
  },
];

const workBenefits = [
  {
    icon: <Zap className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Boosts Productivity",
    description: "Focus on what matters with streamlined task management, clear priorities, and fewer distractions. Get more done, faster.",
  },
  {
    icon: <Users className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Enhances Collaboration",
    description: "Keep your team in sync with shared projects, real-time updates, and effortless communication. Work better, together.",
  },
  {
    icon: <Smile className="h-8 w-8 text-primary dark:text-cambridge_blue-500" />,
    title: "Reduces Stress",
    description: "Gain clarity and control over your work with organized workflows, leading to less overwhelm and more accomplishment.",
  }
];

const testimonials = [
  {
    quote: "StreamFlow has simplified our project workflows significantly. It's so easy to use, and our team adopted it instantly!",
    name: "Sarah L.",
    role: "Project Manager, Tech Solutions Inc.",
    avatarHint: "woman smiling",
  },
  {
    quote: "The clarity and focus StreamFlow brings to task management is a game-changer. We're getting more done with less stress.",
    name: "Mike B.",
    role: "Founder, Creative Co.",
    avatarHint: "man glasses",
  }
];

const faqItems = [
  {
    question: "What is StreamFlow?",
    answer: "StreamFlow is a simple and elegant SaaS project management app designed to help individuals and teams organize tasks, collaborate seamlessly, and track progress with clarity and ease.",
  },
  {
    question: "Is there a free trial available?",
    answer: "Yes! You can try StreamFlow completely free to see if it's the right fit for you. No credit card is required to get started.",
  },
  {
    question: "How does StreamFlow improve team collaboration?",
    answer: "StreamFlow provides shared project spaces, real-time updates on task statuses, and clear assignment visibility, ensuring everyone on your team is on the same page and can work together efficiently.",
  },
  {
    question: "Can I use StreamFlow on mobile devices?",
    answer: "StreamFlow is designed to be responsive and works well on modern web browsers across desktop, tablet, and mobile devices, allowing you to stay productive on the go."
  }
];


export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] flex-col items-center justify-center bg-background text-foreground">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg">Loading StreamFlow...</p>
      </div>
    );
  }
  
  if (user) {
    return (
       <div className="flex h-[calc(100vh-5rem)] flex-col items-center justify-center bg-background text-foreground">
        <LoadingSpinner size={48} />
        <p className="mt-4 text-lg">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground animate-fadeIn">
      {/* Hero Section */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-background via-tan-100/20 to-cambridge_blue-100/10 dark:from-oxford_blue-500 dark:via-oxford_blue-400/30 dark:to-prussian_blue-500/20">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary font-medium py-1.5 px-4 rounded-full shadow-sm animate-fadeInUp dark:border-cambridge_blue-500/50 dark:bg-cambridge_blue-500/20 dark:text-cambridge_blue-300" style={{animationDelay: '0.1s'}}>
            <Zap className="h-4 w-4 mr-2" /> Effortless Project Management
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl animate-fadeInUp" style={{animationDelay: '0.2s'}}>
            Focus on Flow, Not Friction
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground sm:text-xl md:text-xl animate-fadeInUp" style={{animationDelay: '0.3s'}}>
            StreamFlow helps your team organize tasks, collaborate seamlessly, and achieve goals with intuitive simplicity and elegance.
          </p>
          <div className="mt-10 animate-fadeInUp" style={{animationDelay: '0.4s'}}>
            <Button size="xl" asChild className="rounded-lg px-8 py-4 text-base font-medium shadow-md hover:shadow-lg transition-shadow duration-300 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-cambridge_blue-600 dark:hover:bg-cambridge_blue-700 dark:text-oxford_blue-100">
              <Link href="/signup">Try it Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <p className="mt-3 text-sm text-muted-foreground animate-fadeInUp" style={{animationDelay: '0.5s'}}>No credit card required. Start in seconds.</p>
          </div>
           <div className="mt-16 relative aspect-video max-w-4xl mx-auto animate-fadeInUp" style={{animationDelay: '0.6s'}}>
            <Image 
              src="https://placehold.co/1200x675.png" 
              alt="StreamFlow application dashboard showing a project board" 
              layout="fill"
              objectFit="cover"
              className="rounded-xl shadow-2xl ring-1 ring-border/20 dark:ring-prussian_blue-300/50"
              data-ai-hint="project management dashboard"
              priority
            />
             <div className="absolute inset-0 bg-gradient-to-t from-tan-100/30 via-transparent to-transparent opacity-30 rounded-xl dark:from-oxford_blue-400/40"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28 bg-background dark:bg-oxford_blue-500">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl animate-fadeInUp" style={{animationDelay: '0.1s'}}>Designed for Clarity and Simplicity</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground animate-fadeInUp" style={{animationDelay: '0.2s'}}>
              StreamFlow offers the essential tools you need, elegantly designed for peak productivity.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={feature.title} className="flex flex-col items-center text-center p-6 bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fadeInUp dark:bg-prussian_blue-400 dark:border-prussian_blue-300" style={{animationDelay: `${0.3 + index * 0.15}s`}}>
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/20 dark:bg-cambridge_blue-500/15 dark:text-cambridge_blue-400 dark:ring-cambridge_blue-500/30">
                    {feature.icon}
                </div>
                <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-xl font-semibold text-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <p className="text-md text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* How It Affects Your Work Section */}
      <section id="benefits" className="py-20 md:py-28 bg-secondary/20 dark:bg-prussian_blue-500/40">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <TrendingUp className="h-10 w-10 text-primary mx-auto mb-3 animate-fadeInUp dark:text-cambridge_blue-500" style={{animationDelay: '0.1s'}}/>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl animate-fadeInUp" style={{animationDelay: '0.2s'}}>Transform Your Workflow</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground animate-fadeInUp" style={{animationDelay: '0.3s'}}>
              Discover how StreamFlow can elevate your team's performance and bring peace to your projects.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {workBenefits.map((benefit, index) => (
              <Card key={benefit.title} className="flex flex-col p-6 bg-card rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fadeInUp dark:bg-prussian_blue-400 dark:border-prussian_blue-300" style={{animationDelay: `${0.4 + index * 0.15}s`}}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary ring-2 ring-primary/15 dark:bg-cambridge_blue-500/15 dark:text-cambridge_blue-400 dark:ring-cambridge_blue-500/25">
                    {benefit.icon}
                </div>
                <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-xl font-semibold text-foreground">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <p className="text-md text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section - Dark Background Example */}
      <section className="py-20 md:py-28 bg-oxford_blue-500 text-tan-900 dark:bg-prussian_blue-500 dark:text-tan-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
             <Users className="h-10 w-10 text-cambridge_blue-500 mx-auto mb-3 animate-fadeInUp" style={{animationDelay: '0.1s'}}/>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl animate-fadeInUp" style={{animationDelay: '0.2s'}}>Loved by Teams Worldwide</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="p-6 bg-prussian_blue-400/80 rounded-xl shadow-xl animate-fadeInUp dark:bg-oxford_blue-400/90 dark:border-prussian_blue-300" style={{animationDelay: `${0.3 + index * 0.15}s`}}>
                <CardContent className="p-0">
                  <MessageSquare className="h-6 w-6 text-cambridge_blue-500/90 mb-4"/>
                  <p className="text-lg italic mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <Image 
                        src={`https://placehold.co/48x48.png`} 
                        alt={testimonial.name} 
                        width={48} 
                        height={48} 
                        className="rounded-full"
                        data-ai-hint={testimonial.avatarHint}
                      />
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-tan-700 dark:text-tan-600">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-28 bg-secondary/20 dark:bg-prussian_blue-500/40">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-16">
             <CheckCircle className="h-10 w-10 text-primary mx-auto mb-3 animate-fadeInUp dark:text-cambridge_blue-500" style={{animationDelay: '0.1s'}} />
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl animate-fadeInUp" style={{animationDelay: '0.2s'}}>Frequently Asked Questions</h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground animate-fadeInUp" style={{animationDelay: '0.3s'}}>
              Have questions? We've got answers.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full bg-card p-2 rounded-xl shadow-lg animate-fadeInUp dark:bg-prussian_blue-400 dark:border-prussian_blue-300" style={{animationDelay: '0.4s'}}>
            {faqItems.map((item, index) => (
              <AccordionItem value={`item-${index + 1}`} key={index} className="border-b-border/50 dark:border-b-prussian_blue-300/50 last:border-b-0">
                <AccordionTrigger className="p-4 text-left text-md font-medium text-foreground hover:text-primary hover:no-underline dark:hover:text-cambridge_blue-500">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0 text-base text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>


      {/* Final CTA Section */}
      <section className="py-24 md:py-32 bg-gradient-to-r from-prussian_blue-600 via-prussian_blue-500 to-cambridge_blue-500 text-primary-foreground dark:from-prussian_blue-700 dark:via-prussian_blue-600 dark:to-cambridge_blue-600">
        <div className="container mx-auto px-4 text-center animate-fadeInUp" style={{animationDelay: '0.2s'}}>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Ready to Streamline Your Workflow?
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-lg text-prussian_blue-100/90 sm:text-xl dark:text-tan-200/90">
            Join thousands of teams achieving more with StreamFlow. It's free to get started.
          </p>
          <div className="mt-12">
            <Button 
              size="xl" 
              asChild 
              className="bg-background text-primary hover:bg-tan-800/90 shadow-lg hover:shadow-xl transition-all duration-300 text-lg px-10 py-4 rounded-lg font-semibold dark:bg-tan-900 dark:text-prussian_blue-600 dark:hover:bg-tan-800"
            >
              <Link href="/signup">Try StreamFlow Free <ArrowRight className="ml-2.5 h-5 w-5"/></Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

