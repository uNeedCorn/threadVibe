import {
  Navbar,
  HeroSection,
  StatsSection,
  PainPointsSection,
  FeaturesSection,
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
      <StepsSection />
      <PricingSection />
      <CtaSection />
      <Footer />
    </>
  );
}
