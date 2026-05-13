<script lang="ts">
  import { onMount } from "svelte";

  const dots = [
    { i: 1, cx: 245, cy: 90 },
    { i: 2, cx: 115, cy: 125 },
  ];

  onMount(() => {
    const line = document.querySelector<SVGLineElement>(".cp-line");

    if (!line) {
      return;
    }

    let raf: number;

    const dot = document.querySelector(".dot--1") as SVGGElement;
    if (!dot) {
      return;
    }

    function parseTransform(el: Element) {
      const defaultVal = { tx: 0, ty: 0 };
      const m = getComputedStyle(el).transform;

      if (m === "none") {
        return defaultVal;
      }

      const c = m.match(/matrix\(([^)]+)\)/);
      if (!c) {
        return defaultVal;
      }

      const v = c[1].split(", ").map(Number);
      return { tx: v[4], ty: v[5] };
    }

    function update() {
      const { tx, ty } = parseTransform(dot);
      line!.setAttribute("x1", String(245 + tx));
      line!.setAttribute("y1", String(90 + ty));
      raf = requestAnimationFrame(update);
    }

    raf = requestAnimationFrame(update);

    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="text-center max-w-85 px-6 select-none">
  <svg
    class="pl"
    viewBox="0 0 370 370"
    width="370"
    height="370"
    aria-label="A hand cursor places two dots via clicks, then grabs the first one and drags it to a new position"
  >
    <g fill="var(--fg)" stroke-linejoin="round">
      <line x1="245" y1="90" x2="115" y2="125" class="cp-line" />

      {#each dots as { i, cx, cy }}
        <g class="dot dot--{i}">
          <circle
            class="dot__glow"
            {cx}
            {cy}
            r="27"
            fill="var(--color-primary)"
          />
          <circle
            class="dot__donut"
            {cx}
            {cy}
            r="15"
            fill="var(--color-surface-raised)"
            stroke="var(--color-primary)"
            stroke-width="3"
          />
          <circle
            class="dot__core"
            {cx}
            {cy}
            r="7"
            fill="var(--color-primary)"
          />
        </g>
      {/each}

      <g class="hand">
        <g class="hand__position">
          <g
            transform="translate(-36, -60) scale(3)"
            stroke="var(--color-primary)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"
          >
            <g class="hand__state--open">
              <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
              <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
              <path
                d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
              />
            </g>
            <g class="hand__state--pointer">
              <path d="M22 14a8 8 0 0 1-8 8" />
              <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
              <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
              <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
              <path
                d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"
              />
            </g>
            <g class="hand__state--grab">
              <path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4" />
              <path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
              <path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5" />
              <path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
              <path
                d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>
  <h2
    class="font-heading italic text-[26px] leading-tight font-normal text-muted-dark m-0"
  >
    <span class="select-text">Begin</span> with a
    <span class="text-primary">gesture</span>.
  </h2>
  <p
    class="font-ui text-[11px] tracking-[0.04em] leading-[1.6] text-muted-gray mt-3"
  >
    Click to place a point.<br />
    Three or more become a curve.
  </p>
</div>

<style>
  :root {
    --hue: 223;
    --gray50: hsl(var(--hue) 10% 95%);
    --gray950: hsl(var(--hue) 10% 5%);
    --bg: light-dark(var(--gray50), var(--gray950));
    --fg: light-dark(var(--gray950), var(--gray50));
    --trans-dur: 0.3s;
    color-scheme: light dark;
  }

  .pl {
    display: block;
    width: 11.5em;
    height: auto;
  }

  .pl circle {
    transition:
      fill var(--trans-dur),
      stroke var(--trans-dur);
  }

  .dot__glow {
    fill-opacity: 0.18;
  }

  .dot__glow,
  .dot__core {
    opacity: 0;
  }

  .cp-line {
    fill: none;
    stroke: var(--color-primary);
    stroke-width: 3;
    stroke-dasharray: 7 4.5;
    stroke-linecap: round;
    opacity: 0;
  }

  .hand__state--pointer,
  .hand__state--grab {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .hand__position,
    .hand__state--open,
    .hand__state--pointer,
    .hand__state--grab,
    .dot--1,
    .dot--2,
    .cp-line {
      animation-duration: 6s;
      animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
      animation-iteration-count: infinite;
    }

    .dot--1 .dot__glow,
    .dot--1 .dot__core,
    .dot--2 .dot__glow,
    .dot--2 .dot__core {
      animation-duration: 6s;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }

    .hand__position,
    .dot--1 {
      will-change: transform;
    }

    .hand__position {
      animation-name: hand-pos;
    }
    .hand__state--open {
      animation-name: hand-state-open;
    }
    .hand__state--pointer {
      animation-name: hand-state-pointer;
    }
    .hand__state--grab {
      animation-name: hand-state-grab;
    }
    .dot--1 {
      animation-name: dot-1;
      transform-origin: 245px 90px;
    }
    .dot--2 {
      animation-name: dot-2;
      transform-origin: 115px 125px;
    }
    .cp-line {
      animation-name: cp-line;
    }

    .dot--1 .dot__glow,
    .dot--1 .dot__core {
      animation-name: dot-1-active;
    }

    .dot--2 .dot__glow,
    .dot--2 .dot__core {
      animation-name: dot-2-active;
    }

    @keyframes hand-pos {
      0%,
      8% {
        transform: translate(90px, 310px);
      }
      20% {
        transform: translate(260px, 140px);
      }
      24% {
        transform: translate(260px, 140px);
      }
      38% {
        transform: translate(130px, 180px);
      }
      42% {
        transform: translate(130px, 180px);
      }
      56% {
        transform: translate(260px, 140px);
      }
      60% {
        transform: translate(260px, 140px);
      }
      80% {
        transform: translate(270px, 288px);
      }
      100% {
        transform: translate(270px, 288px);
      }
    }

    @keyframes hand-state-open {
      0%,
      20% {
        opacity: 1;
      }
      20.01% {
        opacity: 0;
      }
      23.99% {
        opacity: 0;
      }
      24% {
        opacity: 1;
      }
      38% {
        opacity: 1;
      }
      38.01% {
        opacity: 0;
      }
      41.99% {
        opacity: 0;
      }
      42% {
        opacity: 1;
      }
      56% {
        opacity: 1;
      }
      56.01% {
        opacity: 0;
      }
      79.99% {
        opacity: 0;
      }
      80% {
        opacity: 1;
      }
      100% {
        opacity: 1;
      }
    }

    @keyframes hand-state-pointer {
      0%,
      20% {
        opacity: 0;
      }
      20.01% {
        opacity: 1;
      }
      23.99% {
        opacity: 1;
      }
      24% {
        opacity: 0;
      }
      38% {
        opacity: 0;
      }
      38.01% {
        opacity: 1;
      }
      41.99% {
        opacity: 1;
      }
      42% {
        opacity: 0;
      }
      56%,
      100% {
        opacity: 0;
      }
    }

    @keyframes hand-state-grab {
      0%,
      56% {
        opacity: 0;
      }
      56.01% {
        opacity: 1;
      }
      79.99% {
        opacity: 1;
      }
      80% {
        opacity: 0;
      }
      100% {
        opacity: 0;
      }
    }

    @keyframes dot-1 {
      0%,
      20% {
        transform: scale(0);
      }
      20.01% {
        transform: scale(1);
      }
      57% {
        transform: translate(0, 0) scale(1.1, 0.85);
      }
      59% {
        transform: translate(0, 0) scale(1);
      }
      60% {
        transform: translate(0, 0) scale(1);
      }
      80% {
        transform: translate(10px, 148px) scale(1);
      }
      81% {
        transform: translate(10px, 148px) scale(0.85, 1.15);
      }
      83% {
        transform: translate(10px, 148px) scale(1);
      }
      100% {
        transform: translate(10px, 148px) scale(1);
      }
    }

    @keyframes dot-2 {
      0%,
      38% {
        transform: scale(0);
      }
      38.01% {
        transform: scale(1);
      }
      42% {
        transform: scale(1);
      }
      100% {
        transform: scale(1);
      }
    }

    @keyframes cp-line {
      0%,
      38% {
        opacity: 0;
      }
      38.01%,
      100% {
        opacity: 0.6;
      }
    }

    @keyframes dot-1-active {
      0%,
      20% {
        opacity: 0;
      }
      20.01%,
      38% {
        opacity: 0.8;
      }
      38.01%,
      100% {
        opacity: 0;
      }
    }

    @keyframes dot-2-active {
      0%,
      38% {
        opacity: 0;
      }
      38.01%,
      100% {
        opacity: 0.8;
      }
    }
  }
</style>
