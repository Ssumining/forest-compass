'use client';
import { useState, useMemo } from 'react';
import GlobalTopbar from '@/components/layout/GlobalTopbar';
import MobileTabBar from '@/components/layout/MobileTabBar';
import ChatPane from '@/components/chat/ChatPane';
import MapPane from '@/components/map/MapPane';
import FormPane from '@/components/form/FormPane';
import { computeStats } from '@/lib/slope';
import { useTerrain } from '@/lib/useTerrain';
import { usePersonaId, getPersona, clearPersona } from '@/lib/persona';
import PersonaScreen from '@/components/persona/PersonaScreen';

const PARCEL_ID = '전북 남원시 산내면 산 32-1';

export default function AppShell() {
  const personaId = usePersonaId();
  const [active, setActive] = useState('map');
  const [radius, setRadius] = useState(500);
  const [slopeLimit, setSlopeLimit] = useState(25);
  const [robotOn, setRobotOn] = useState(true);
  const [formOpen, setFormOpen] = useState(true);

  // 지형(격자·상수) 1회 fetch — 슬라이더 변화는 아래 computeStats가 재집계
  const terrain = useTerrain(PARCEL_ID);

  const { avgSlope, Y, compliant } = useMemo(
    () => computeStats(radius, slopeLimit, robotOn, terrain),
    [radius, slopeLimit, robotOn, terrain]
  );

  function handleReset() {
    setRadius(500);
    setSlopeLimit(25);
    setRobotOn(true);
  }

  const persona = getPersona(personaId);

  // 페르소나 미선택 시 → 진입 첫 화면
  if (!persona) return <PersonaScreen />;

  return (
    <div className="h-full flex flex-col bg-[#F4F5F7]">
      <GlobalTopbar
        formOpen={formOpen}
        onToggleForm={() => setFormOpen(o => !o)}
        persona={persona}
        onChangePersona={clearPersona}
      />

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-12 lg:gap-0">
        {/* Chat */}
        <section className={`lg:col-span-4 xl:col-span-3 min-h-0 ${active === 'chat' ? 'block' : 'hidden lg:block'}`}>
          <ChatPane onShowMap={() => setActive('map')} persona={persona} onChangePersona={clearPersona} />
        </section>

        {/* Map */}
        <section className={`min-h-0 lg:border-r lg:border-wline ${
          formOpen ? 'lg:col-span-4 xl:col-span-5' : 'lg:col-span-8 xl:col-span-9'
        } ${active === 'map' ? 'block' : 'hidden lg:block'}`}>
          <MapPane
            radius={radius} setRadius={setRadius}
            slopeLimit={slopeLimit} setSlopeLimit={setSlopeLimit}
            robotOn={robotOn} setRobotOn={setRobotOn}
            terrain={terrain}
            onReset={handleReset}
          />
        </section>

        {/* Form */}
        {formOpen && (
          <section className={`lg:col-span-4 min-h-0 ${active === 'form' ? 'block' : 'hidden lg:block'}`}>
            <FormPane
              radius={radius} slopeLimit={slopeLimit}
              avgSlope={avgSlope} Y={Y} compliant={compliant}
              onClose={() => setActive('map')}
            />
          </section>
        )}
      </div>

      <MobileTabBar active={active} onChange={setActive} />
      <div className="lg:hidden h-20" />
    </div>
  );
}
