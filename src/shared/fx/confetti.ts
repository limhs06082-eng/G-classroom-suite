/**
 * 색종이.
 *
 * 라이브러리를 안 쓴다 — 필요한 것은 "터지고, 떨어지고, 사라진다"뿐이라
 * 캔버스 하나와 파티클 백여 개면 된다. 의존성 하나가 주는 것보다
 * 번들과 관리 부담이 크다.
 *
 * - `prefers-reduced-motion`이면 아무것도 그리지 않는다. CSS 전역 규칙은
 *   JS가 그리는 캔버스까지 못 끄므로 여기서 직접 본다.
 * - 실패해도 조용하다. 캔버스가 없는 환경(jsdom)에서는 그냥 넘어간다.
 * - 2.2초 뒤 캔버스째 치운다. 축하는 순간이고 화면은 수업 도구다.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
}

/** 기능 색과 어울리는 밝은 조각들. 테마와 무관하게 잘 보이는 채도로 고정한다. */
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#ef4444'];

const DURATION_MS = 2200;
const COUNT = 140;

export function confettiBurst(): void {
  try {
    if (typeof document === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context === null) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // 제일 위에서, 클릭은 통과시킨다. 축하가 조작을 막으면 안 된다.
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:9999;pointer-events:none;';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      // 화면 위쪽 가운데 넓은 부채꼴로 쏜다.
      const angle = Math.PI * (0.15 + Math.random() * 0.7);
      const speed = 6 + Math.random() * 9;
      return {
        x: canvas.width * (0.3 + Math.random() * 0.4),
        y: canvas.height * 0.35,
        vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1),
        vy: -Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#f59e0b',
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
      };
    });

    const startedAt = performance.now();

    const frame = (nowMs: number): void => {
      const elapsed = nowMs - startedAt;
      if (elapsed > DURATION_MS) {
        canvas.remove();
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      // 끝나갈수록 옅어진다. 뚝 끊기면 지워진 티가 난다.
      context.globalAlpha = Math.min(1, (DURATION_MS - elapsed) / 600);

      for (const p of particles) {
        p.vy += 0.25; // 중력
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillStyle = p.color;
        context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        context.restore();
      }

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  } catch {
    // 축하가 안 터졌다고 앱이 멈추면 안 된다.
  }
}
