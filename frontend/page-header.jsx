export function PageHeader({ title, intro, document = false, id }) {
  return (
    <header
      className={`page-header${document ? " page-header--document" : ""}`}
    >
      <h1 id={id} tabIndex={-1}>
        {title}
      </h1>
      {intro && <p className="page-lead">{intro}</p>}
    </header>
  );
}
