import Section from "@/components/Section";
import AdminEditHint from "@/components/AdminEditHint";
import { getSiteContent } from "@/lib/site-content";

export default async function PublicationsPage() {
  const { publications } = await getSiteContent();

  return (
    <Section
      title={publications.title}
      subtitle={publications.subtitle}
    >
      <AdminEditHint section="publications" />
      <div className="grid gap-4">
        {publications.items.map((item) => (
          <article
            key={`${item.title}-${item.year}`}
            className="surface-card p-6 border-l-4 border-l-[var(--primary-color)]"
          >
            <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
            <div className="mt-2 text-sm text-slate-600">
              <span className="font-medium">שנה:</span> {item.year} |{" "}
              <span className="font-medium">כתב עת:</span> {item.journal}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {item.doi && item.doiUrl ? (
                <a
                  href={item.doiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition duration-300 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                >
                  DOI: {item.doi}
                </a>
              ) : null}
              {item.pubmedUrl ? (
                <a
                  href={item.pubmedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition duration-300 hover:border-[var(--primary-color)] hover:text-[var(--primary-color)]"
                >
                  PubMed
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
