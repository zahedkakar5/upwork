import { projects } from "@/lib/projects";
import { PageHeading } from "@/components/ui/page-heading";

export default function ProjectsPage() {
  return (
    <>
      <PageHeading
        title="Our projects"
        subtitle="Relevant experience for your next client conversation."
      />
      <div className="projects-intro">
        <p>
          {projects.length} portfolio references from the Nordstone Company and
          Project Brief.
        </p>
        <a
          href="https://docs.google.com/document/d/1HU9xHsnGKKxcV_y3jLtKThl-3lE-q3lZjOydq303jUQ/edit"
          target="_blank"
          rel="noreferrer"
        >
          View source brief ↗
        </a>
      </div>
      <div className="projects-grid">
        {projects.map((project) => (
          <article className="card project-card" key={project.name}>
            <span className="project-category">{project.category}</span>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
            <h3>Relevant enquiries</h3>
            <p>{project.relevance}</p>
          </article>
        ))}
      </div>
    </>
  );
}
