import "./HeroSection.css";

type HeroSectionProps = {
  suggestions: string[];
  onSelectSuggestion: (value: string) => void;
};

export function HeroSection({ suggestions, onSelectSuggestion }: HeroSectionProps) {
  return (
    <section className="mobile-hero">
      <div className="mobile-hero-overlay">
        <div className="mobile-hero-copy">
          <h1>
            Hi, I’m Scarlet,
            <br />
            your virtual legal AI assistant
          </h1>
          <div className="eyebrow">try to ask me:</div>
          <div className="hero-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="pill-button"
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
