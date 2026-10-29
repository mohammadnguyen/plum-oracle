/**
 * 手机指南针读数。浏览器能力差别大，这里只管把「手机顶端朝哪」读成 0–360°（北=0，顺时针）：
 *
 *   · iOS Safari：`deviceorientation` 事件带 `webkitCompassHeading`（已是磁北方位角）；
 *     iOS 13 起须在点击里先调 `DeviceOrientationEvent.requestPermission()`。
 *   · Android Chrome：`deviceorientationabsolute` 事件，`alpha` 为逆时针角，方位角 = 360 − alpha。
 *   · 其他浏览器的 `deviceorientation` 若 `absolute === true`，同 Android 算法。
 *   · 桌面电脑、读不到的：几秒内没有读数就报「不可用」，界面退回手选。
 *
 * 读数是磁北，不是真北；中国大陆磁偏角多在西偏 0°–10°，八方每格 45°，离分界远时不影响，
 * 近分界时界面会提醒用户核对（见 engine/zhiwu.ts 的 nearEdge）。
 * 只在 HTTPS（或 localhost）下可用；GitHub Pages 是 HTTPS。
 */

export type CompassStop = () => void;

interface OrientationEventLike extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

/** 屏幕旋转角：横屏时手机「顶端」不再是屏幕上方，要补回来。 */
function screenAngle(): number {
  const a = (screen.orientation && typeof screen.orientation.angle === "number")
    ? screen.orientation.angle
    : Number((window as unknown as { orientation?: number }).orientation ?? 0);
  return Number.isFinite(a) ? a : 0;
}

/** 圆周平均：359° 与 1° 的平均是 0°，不是 180°。 */
function circularMean(ds: readonly number[]): number {
  let s = 0, c = 0;
  for (const d of ds) { s += Math.sin((d * Math.PI) / 180); c += Math.cos((d * Math.PI) / 180); }
  return ((Math.atan2(s, c) * 180) / Math.PI + 360) % 360;
}

/**
 * 开始读指南针。**必须在点击事件里调用**（iOS 要在用户手势里申请权限）。
 * @param onHeading 每次有新读数（已做平滑）时回调；accuracy 为 iOS 给的误差度数，没有则为 null
 * @param onFail    不可用时回调一次，附一句给用户看的原因
 */
export async function startCompass(
  onHeading: (deg: number, accuracy: number | null) => void,
  onFail: (why: string) => void,
): Promise<CompassStop> {
  const noop = () => {};
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
    onFail("这台设备或浏览器读不到指南针，请手动选方位。");
    return noop;
  }
  if (!window.isSecureContext) {
    onFail("指南针只在 https 页面可用，请手动选方位。");
    return noop;
  }
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (typeof DOE.requestPermission === "function") {
    try {
      const p = await DOE.requestPermission();
      if (p !== "granted") {
        onFail("没有拿到方向传感器权限。可以在浏览器设置里允许「动作与方向」后重试，或手动选方位。");
        return noop;
      }
    } catch {
      onFail("没有拿到方向传感器权限，请手动选方位。");
      return noop;
    }
  }

  const recent: number[] = [];
  let got = false;
  const push = (deg: number, acc: number | null) => {
    got = true;
    recent.push(deg);
    if (recent.length > 8) recent.shift();
    onHeading(circularMean(recent), acc);
  };

  const onAbs = (e: Event) => {
    const ev = e as OrientationEventLike;
    if (ev.alpha == null) return;
    push((360 - ev.alpha + screenAngle()) % 360, null);
  };
  const onRel = (e: Event) => {
    const ev = e as OrientationEventLike;
    if (typeof ev.webkitCompassHeading === "number" && !Number.isNaN(ev.webkitCompassHeading)) {
      // iOS：已是方位角，只补屏幕旋转
      const acc = typeof ev.webkitCompassAccuracy === "number" && ev.webkitCompassAccuracy >= 0
        ? ev.webkitCompassAccuracy : null;
      push((ev.webkitCompassHeading + screenAngle()) % 360, acc);
    } else if (ev.absolute && ev.alpha != null) {
      push((360 - ev.alpha + screenAngle()) % 360, null);
    }
  };

  const hasAbs = "ondeviceorientationabsolute" in window;
  if (hasAbs) window.addEventListener("deviceorientationabsolute", onAbs);
  else window.addEventListener("deviceorientation", onRel);

  const timer = window.setTimeout(() => {
    if (!got) {
      stop();
      onFail("几秒内没读到指南针（电脑上通常没有）。请手动选方位。");
    }
  }, 3500);

  function stop() {
    window.clearTimeout(timer);
    window.removeEventListener("deviceorientationabsolute", onAbs);
    window.removeEventListener("deviceorientation", onRel);
  }
  return stop;
}
