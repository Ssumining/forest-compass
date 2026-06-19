'use client';
import { CARD_TYPES } from '@/lib/apiContract';
import BypassChatCard from './BypassChatCard';
import CitationCard from './CitationCard';
import KpiCard from './KpiCard';

export default function CardRenderer({ cards, onShowMap }) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-2">
      {cards.map((card, i) => {
        if (card?.type === CARD_TYPES.bypass) return <BypassChatCard key={i} data={card.data} onShowMap={onShowMap} />;
        if (card?.type === CARD_TYPES.citation) return <CitationCard key={i} data={card.data} />;
        if (card?.type === CARD_TYPES.kpi) return <KpiCard key={i} data={card.data} />;
        return null; // 알 수 없는 type → 렌더 안 함
      })}
    </div>
  );
}
