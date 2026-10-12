import { ArrowLeft } from 'lucide-react';

export function RouteHeader({ backHref = '#home', title, description }) {
  return (
    <header className="route-header">
      <a className="back-link" href={backHref}><ArrowLeft size={17} aria-hidden="true" />Back</a>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
