"use client";
import { useEffect, useRef, useState } from "react";

type Review = { id: number; name: string; role: string; avatar: string; text: string; rating: number };

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i <= rating ? "#22C55E" : "#1E293B"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div style={{
      minWidth: 300, maxWidth: 300,
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "24px",
      display: "flex", flexDirection: "column", gap: 0,
      userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {review.avatar ? (
          <img src={review.avatar} alt={review.name} style={{ width: 40, height: 40, borderRadius: "50%", background: "#1E293B" }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #22C55E, #16A34A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#071A0E", flexShrink: 0 }}>
            {review.name.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>{review.name}</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{review.role}</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "#22C55E", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "2px 8px" }}>Verified</div>
      </div>
      <StarRating rating={review.rating} />
      <p style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, margin: 0 }}>{review.text}</p>
    </div>
  );
}

export default function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);
  const doubled = [...reviews, ...reviews];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = 316;
    const totalWidth = reviews.length * cardWidth;

    function animate() {
      if (!paused) {
        posRef.current += 0.5;
        if (posRef.current >= totalWidth) posRef.current = 0;
        if (track) track.style.transform = `translateX(-${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused, reviews.length]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ overflow: "hidden", width: "100%", cursor: "grab" }}
    >
      <div ref={trackRef} style={{ display: "flex", gap: 16, willChange: "transform" }}>
        {doubled.map((r, i) => <ReviewCard key={`${r.id}-${i}`} review={r} />)}
      </div>
    </div>
  );
}
