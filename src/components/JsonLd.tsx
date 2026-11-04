// Small helpers that emit schema.org structured data. "<" is escaped so page text can never close the script tag.
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** FAQPage markup that mirrors the questions and answers visible in the page's FAQ section. */
export function FaqJsonLd({ items }: { items: readonly (readonly [string, string])[] }) {
  if (!items.length) return null;
  return <JsonLd data={{
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: items.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })),
  }} />;
}
