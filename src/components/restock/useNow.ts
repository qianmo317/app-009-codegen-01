import { useEffect, useState } from 'react';

/** 当前时间，每 intervalMs 刷新一次：报价过期、到货倒计时这类随时间变化的展示用它 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
