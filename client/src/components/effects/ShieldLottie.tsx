import Lottie from 'lottie-react'

const shieldAnimation = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: 'Shield Protection',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Shield',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [80, 80, 100] },
            { t: 30, s: [100, 100, 100] },
            { t: 60, s: [80, 80, 100] },
            { t: 90, s: [80, 80, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'sh',
              ks: {
                a: 0,
                k: {
                  i: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  o: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                  v: [
                    [0, -50],
                    [-30, 20],
                    [0, 50],
                    [30, 20],
                  ],
                  c: true,
                },
              },
            },
            {
              ty: 'st',
              c: { a: 0, k: [0.31, 0.27, 0.9, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 3 },
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.31, 0.27, 0.9, 0.2] },
              o: { a: 0, k: 100 },
            },
          ],
          nm: 'Shield Shape',
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
      bm: 0,
    },
  ],
}

interface ShieldLottieProps {
  size?: number
  className?: string
}

export function ShieldLottie({ size = 48, className = '' }: ShieldLottieProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <Lottie animationData={shieldAnimation} loop={true} />
    </div>
  )
}
