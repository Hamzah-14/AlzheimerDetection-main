export function NeuralBG() {
  return (
    <div className="neural-bg" aria-hidden="true">
      <svg
        className="neural-bg__svg"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        {/* soft lines */}
        <g className="neural-lines">
          <path d="M60 120 C 280 40, 420 220, 640 140 S 980 60, 1140 200" />
          <path d="M80 640 C 260 520, 420 700, 620 560 S 980 480, 1140 620" />
          <path d="M200 80 C 360 260, 520 260, 680 120 S 940 0, 1160 140" />
          <path d="M180 760 C 380 620, 560 640, 720 740 S 980 820, 1180 680" />
          <path d="M120 360 C 300 240, 520 300, 700 360 S 980 460, 1160 360" />
        </g>

        {/* nodes */}
        <g className="neural-nodes">
          <circle cx="120" cy="120" r="3" />
          <circle cx="260" cy="90" r="2.5" />
          <circle cx="420" cy="210" r="3" />
          <circle cx="560" cy="160" r="2.5" />
          <circle cx="720" cy="140" r="3" />
          <circle cx="920" cy="110" r="2.5" />
          <circle cx="1060" cy="200" r="3" />

          <circle cx="160" cy="640" r="3" />
          <circle cx="340" cy="560" r="2.5" />
          <circle cx="520" cy="690" r="3" />
          <circle cx="700" cy="600" r="2.5" />
          <circle cx="900" cy="520" r="3" />
          <circle cx="1080" cy="620" r="2.5" />
        </g>

        {/* subtle moving ---scan--- highlight along the lines */}
        <g className="neural-scan">
          <path d="M60 120 C 280 40, 420 220, 640 140 S 980 60, 1140 200" />
          <path d="M120 360 C 300 240, 520 300, 700 360 S 980 460, 1160 360" />
        </g>
      </svg>
    </div>
  );
}