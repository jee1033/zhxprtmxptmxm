import { useEffect, useMemo, useRef, useState } from 'react';
import { SpriteMood, spriteFrames } from './sprites';

type PetState = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  age: number;
  coins: number;
  alive: boolean;
};

const MAX_STAT = 100;
const clamp = (value: number) => Math.max(0, Math.min(MAX_STAT, value));

const moodFromStats = (pet: PetState) => {
  const average = (pet.hunger + pet.happiness + pet.energy + pet.cleanliness) / 4;
  if (!pet.alive) return '💀 무지개 다리를 건넜어요';
  if (average >= 80) return '😄 최고로 행복해요';
  if (average >= 60) return '🙂 기분이 좋아요';
  if (average >= 40) return '😐 조금 지쳤어요';
  if (average >= 20) return '😣 많이 힘들어요';
  return '😭 돌봐줘요!';
};

const createInitialPet = (name: string): PetState => ({
  name,
  hunger: 80,
  happiness: 80,
  energy: 80,
  cleanliness: 80,
  age: 0,
  coins: 20,
  alive: true,
});

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: value > 60 ? '#22c55e' : value > 30 ? '#f59e0b' : '#ef4444',
            transition: 'width 250ms ease',
          }}
        />
      </div>
    </div>
  );
}

function PixelSprite({ mood }: { mood: SpriteMood }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    frameRef.current = 0;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const frames = spriteFrames[mood];
      const current = frames[frameRef.current % frames.length];

      ctx.clearRect(0, 0, 16, 16);
      current.forEach((row, y) => {
        row.split('').forEach((cell, x) => {
          if (cell === '1') {
            ctx.fillStyle = '#111';
            ctx.fillRect(x, y, 1, 1);
          }
        });
      });

      frameRef.current += 1;
    };

    render();
    const timer = setInterval(render, mood === 'dead' ? 500 : 250);
    return () => clearInterval(timer);
  }, [mood]);

  return (
    <canvas
      ref={canvasRef}
      width={16}
      height={16}
      style={{
        width: 170,
        height: 170,
        imageRendering: 'pixelated',
        border: '4px solid #111',
        borderRadius: 10,
        background: '#f3f4f6',
      }}
    />
  );
}

export default function App() {
  const [pet, setPet] = useState<PetState>(() => createInitialPet('다마'));
  const [nameInput, setNameInput] = useState('다마');
  const [message, setMessage] = useState('다마고치를 잘 돌봐주세요!');

  useEffect(() => {
    const timer = setInterval(() => {
      setPet((prev) => {
        if (!prev.alive) return prev;

        const next: PetState = {
          ...prev,
          hunger: clamp(prev.hunger - 4),
          happiness: clamp(prev.happiness - 3),
          energy: clamp(prev.energy - 2),
          cleanliness: clamp(prev.cleanliness - 3),
          age: prev.age + 1,
          coins: prev.coins + 1,
        };

        const criticalCount = [next.hunger, next.happiness, next.energy, next.cleanliness].filter((s) => s <= 0).length;
        if (criticalCount >= 2) {
          setMessage('너무 오랫동안 돌보지 못했어요...');
          return { ...next, alive: false };
        }

        return next;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const mood = useMemo(() => moodFromStats(pet), [pet]);

  const spriteMood: SpriteMood = useMemo(() => {
    if (!pet.alive) return 'dead';
    if (pet.happiness > 70) return 'happy';
    if (pet.energy < 30 || pet.hunger < 20) return 'sleepy';
    return 'idle';
  }, [pet]);

  const doAction = (action: 'feed' | 'play' | 'sleep' | 'clean' | 'snack') => {
    setPet((prev) => {
      if (!prev.alive) return prev;

      if (action === 'snack' && prev.coins < 5) {
        setMessage('코인이 부족해요! (간식은 5코인)');
        return prev;
      }

      const updated = { ...prev };
      switch (action) {
        case 'feed':
          updated.hunger = clamp(updated.hunger + 18);
          updated.cleanliness = clamp(updated.cleanliness - 5);
          setMessage('냠냠! 배가 불러졌어요.');
          break;
        case 'play':
          updated.happiness = clamp(updated.happiness + 20);
          updated.energy = clamp(updated.energy - 10);
          updated.hunger = clamp(updated.hunger - 7);
          setMessage('신나게 놀았어요!');
          break;
        case 'sleep':
          updated.energy = clamp(updated.energy + 25);
          updated.hunger = clamp(updated.hunger - 8);
          setMessage('푹 쉬고 기운을 차렸어요.');
          break;
        case 'clean':
          updated.cleanliness = clamp(updated.cleanliness + 25);
          updated.happiness = clamp(updated.happiness + 5);
          setMessage('깨끗해져서 기분이 좋아요!');
          break;
        case 'snack':
          updated.coins -= 5;
          updated.hunger = clamp(updated.hunger + 8);
          updated.happiness = clamp(updated.happiness + 12);
          setMessage('간식을 먹고 행복해졌어요!');
          break;
      }

      return updated;
    });
  };

  const resetPet = () => {
    const trimmed = nameInput.trim() || '다마';
    setPet(createInitialPet(trimmed));
    setMessage(`${trimmed}와(과) 새로 시작했어요!`);
  };

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '20px auto',
        padding: 20,
        borderRadius: 20,
        fontFamily: 'Pretendard, system-ui, sans-serif',
        background: 'linear-gradient(180deg, #f0f9ff, #eef2ff)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 6 }}>🥚 다마고치 게임</h1>
      <p style={{ marginTop: 0, color: '#374151' }}>레트로 스프라이트 애니메이션 펫을 돌봐주세요.</p>

      <section style={{ background: '#ffffffcc', borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <PixelSprite mood={spriteMood} />
        </div>
        <h2 style={{ textAlign: 'center', margin: '0 0 4px' }}>{pet.name}</h2>
        <p style={{ textAlign: 'center', margin: 0 }}>나이: {pet.age}턴 · 코인: {pet.coins}</p>
        <p style={{ textAlign: 'center', margin: '8px 0 0', fontWeight: 600 }}>{mood}</p>
      </section>

      <section style={{ background: '#ffffffcc', borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <StatBar label="포만감" value={pet.hunger} />
        <StatBar label="행복" value={pet.happiness} />
        <StatBar label="에너지" value={pet.energy} />
        <StatBar label="청결" value={pet.cleanliness} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
        <button onClick={() => doAction('feed')} disabled={!pet.alive}>🍚 밥주기</button>
        <button onClick={() => doAction('play')} disabled={!pet.alive}>🎾 놀아주기</button>
        <button onClick={() => doAction('sleep')} disabled={!pet.alive}>🛌 재우기</button>
        <button onClick={() => doAction('clean')} disabled={!pet.alive}>🧽 씻기기</button>
        <button onClick={() => doAction('snack')} disabled={!pet.alive} style={{ gridColumn: '1 / -1' }}>🍬 간식(5코인)</button>
      </section>

      <p style={{ minHeight: 24, background: '#fff', padding: '8px 10px', borderRadius: 10 }}>{message}</p>

      <section style={{ marginTop: 12, background: '#ffffffcc', borderRadius: 16, padding: 14 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>이름 바꾸고 새로 시작</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="펫 이름"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid #d1d5db' }}
          />
          <button onClick={resetPet}>새 게임</button>
        </div>
      </section>
    </main>
  );
}
