"use client";
import { useEffect, useRef, useCallback } from "react";

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
      userSelect: "none",
      flexShrink: 0,
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

function CarouselTrack({ reviews, speed, direction }: { reviews: Review[]; speed: number; direction: 1 | -1 }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const CARD_WIDTH = 316;
  const totalWidth = reviews.length * CARD_WIDTH;
  const doubled = [...reviews, ...reviews];

  const animate = useCallback(() => {
    if (!pausedRef.current) {
      posRef.current += speed * direction;
      if (posRef.current >= totalWidth) posRef.current -= totalWidth;
      if (posRef.current < 0) posRef.current += totalWidth;
      if (trackRef.current) {
        trackRef.current.style.transform = `translateX(-${posRef.current}px)`;
      }
      const container = containerRef.current;
      const track = trackRef.current;
      if (container && track) {
        const containerWidth = container.offsetWidth;
        const center = containerWidth / 2;
        const cards = track.children;
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i] as HTMLElement;
          const cardLeft = i * CARD_WIDTH - posRef.current;
          const cardCenter = cardLeft + CARD_WIDTH / 2;
          const dist = Math.abs(cardCenter - center);
          const maxDist = containerWidth / 2;
          const ratio = Math.min(dist / maxDist, 1);
          const scale = 1 - ratio * 0.12;
          const opacity = 1 - ratio * 0.55;
          card.style.transform = `scale(${scale})`;
          card.style.opacity = String(Math.max(0.4, opacity));
        }
      }
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [speed, direction, totalWidth]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      style={{
        overflow: "hidden",
        width: "100%",
        cursor: "grab",
        maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      <div ref={trackRef} style={{ display: "flex", gap: 16, willChange: "transform", paddingBottom: 8 }}>
        {doubled.map((r, i) => (
          <ReviewCard key={`${r.id}-${i}`} review={r} />
        ))}
      </div>
    </div>
  );
}

export default function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;
  const half = Math.ceil(reviews.length / 2);
  const row1 = reviews.slice(0, half);
  const row2 = reviews.slice(half).length > 0 ? reviews.slice(half) : reviews;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <CarouselTrack reviews={row1} speed={0.4} direction={1} />
      <CarouselTrack reviews={row2} speed={0.28} direction={-1} />
    </div>
  );
}
