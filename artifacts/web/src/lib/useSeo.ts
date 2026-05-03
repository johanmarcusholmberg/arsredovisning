import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  ogImage?: string;
  canonicalPath?: string;
};

/**
 * Per-page SEO setter (P4-3) for the marketing artifact.
 *
 * Updates `<title>`, the description meta tag, and Open Graph meta tags
 * on mount and whenever the props change. We mutate the DOM directly
 * rather than pulling in a heavyweight helmet library — the marketing
 * site only has a handful of pages and this keeps the bundle small.
 *
 * Tags created here are reused across pages by selector, so revisiting
 * a page just updates content rather than appending duplicates.
 */
export function useSeo({ title, description, ogImage, canonicalPath }: SeoProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousTitle = document.title;
    document.title = title;

    setMetaByName("description", description);
    setMetaByProperty("og:title", title);
    setMetaByProperty("og:description", description);
    setMetaByProperty("og:type", "website");
    if (ogImage) setMetaByProperty("og:image", ogImage);
    setMetaByName("twitter:card", "summary_large_image");
    setMetaByName("twitter:title", title);
    setMetaByName("twitter:description", description);
    if (ogImage) setMetaByName("twitter:image", ogImage);

    if (canonicalPath) {
      let link = document.head.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]',
      );
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      link.setAttribute("href", `${origin}${canonicalPath}`);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, ogImage, canonicalPath]);
}

function setMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
