import { DemoPreview } from "./demo-preview";

export function ScreenshotSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            直覺的儀表板介面
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            一目了然的數據視覺化，讓你快速掌握帳號表現
          </p>
        </div>

        <DemoPreview />
      </div>
    </section>
  );
}
