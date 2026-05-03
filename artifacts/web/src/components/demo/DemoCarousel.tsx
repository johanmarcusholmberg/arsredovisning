import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export interface DemoSlideDefinition {
  key: string;
  title: string;
  subtitle: string;
  body: string;
  visual: ReactNode;
}

interface DemoCarouselProps {
  slides: DemoSlideDefinition[];
}

export function DemoCarousel({ slides }: DemoCarouselProps) {
  const { t } = useLanguage();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    dragFree: false,
    containScroll: "trimSnaps",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when the user is typing in an input/textarea/select or
      // editing contenteditable content, so we don't hijack their typing.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollPrev, scrollNext]);

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={t("publicDemo.nav.dots")}
    >
      {/* Slide track with side arrows positioned over the slide edges */}
      <div className="relative">
        <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, idx) => (
              <div
                key={slide.key}
                className="flex-[0_0_100%] min-w-0 px-1"
                aria-hidden={selectedIndex !== idx}
                role="group"
                aria-roledescription="slide"
                aria-label={`${idx + 1} / ${slides.length}: ${slide.title}`}
              >
                <article className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-[760px] md:h-[520px]">
                  <div className="grid md:grid-cols-2 gap-0 h-full">
                    <div className="p-6 md:p-10 flex flex-col justify-center bg-gradient-to-br from-primary/5 via-transparent to-transparent overflow-hidden">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-primary/80 mb-3">
                        {t("publicDemo.slide.label")} {idx + 1} / {slides.length}
                      </span>
                      <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
                        {slide.title}
                      </h3>
                      <p className="mt-3 text-sm md:text-base text-primary/90 font-medium">
                        {slide.subtitle}
                      </p>
                      <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
                        {slide.body}
                      </p>
                    </div>
                    <div className="bg-muted/30 border-t md:border-t-0 md:border-l border-border p-5 md:p-8 flex items-center justify-center overflow-hidden">
                      <div className="w-full max-w-md">{slide.visual}</div>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>

        {/* Side arrows — absolutely positioned, vertically centered on the slide.
            On small screens they sit just inside the slide; on md+ they sit
            slightly outside to avoid covering content. */}
        <button
          type="button"
          onClick={scrollPrev}
          disabled={!canPrev}
          aria-label={t("publicDemo.nav.prev")}
          className="absolute top-1/2 -translate-y-1/2 left-2 md:-left-5 z-10 inline-flex items-center justify-center size-11 md:size-12 rounded-full border border-border bg-background/95 text-foreground shadow-md hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          <ChevronLeft className="size-5 md:size-6" />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          disabled={!canNext}
          aria-label={t("publicDemo.nav.next")}
          className="absolute top-1/2 -translate-y-1/2 right-2 md:-right-5 z-10 inline-flex items-center justify-center size-11 md:size-12 rounded-full border border-border bg-background/95 text-foreground shadow-md hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          <ChevronRight className="size-5 md:size-6" />
        </button>
      </div>

      {/* Dot indicators below the slide */}
      <div className="mt-5 flex items-center justify-center">
        <div
          className="flex items-center gap-2"
          role="tablist"
          aria-label={t("publicDemo.nav.dots")}
        >
          {slides.map((slide, idx) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={idx === selectedIndex}
              aria-label={`${t("publicDemo.nav.goto")} ${idx + 1}`}
              onClick={() => scrollTo(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === selectedIndex
                  ? "w-8 bg-primary"
                  : "w-2 bg-border hover:bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
