import {
  Navbar,
  HeroSection,
  StatsSection,
  PainPointsSection,
  FeaturesSection,
  AudienceSection,
  StepsSection,
  ScreenshotSection,
  PricingSection,
  CtaSection,
  Footer,
} from "./components";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <StatsSection />
      <ScreenshotSection />
      <PainPointsSection />
      <FeaturesSection />
      <AudienceSection />
      <StepsSection />
      <PricingSection />
      <CtaSection />
      <Footer />
    </>
  );
}
