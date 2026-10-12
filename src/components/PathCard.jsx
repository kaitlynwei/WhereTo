import { ArrowUpRight } from 'lucide-react';

export function PathCard({ title, description, label, image, imagePosition = 'center', href }) {
  return (
    <a className="path-card" href={href}>
      <img src={image} alt="" style={{ objectPosition: imagePosition }} />
      <span className="path-card__veil" aria-hidden="true" />
      <div className="path-card__copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="path-card__action">
        {label}
        <ArrowUpRight aria-hidden="true" size={19} />
      </span>
    </a>
  );
}
