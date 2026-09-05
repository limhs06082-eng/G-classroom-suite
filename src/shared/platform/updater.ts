/**
 * 자동 갱신 — 화면이 아는 것은 이 셋뿐이다.
 *
 *   checkForUpdate()  새 판이 있는가 (없으면 null)
 *   installUpdate()   받아서 설치한다 (진행률을 알려 준다)
 *   relaunch()        설치가 끝난 뒤 앱을 다시 켠다
 *
 * Tauri 조각은 전부 **동적 import**다. 웹 번들에는 실리지 않고
 * (check-bundle-purity가 센다), 설치형에서만 실제 플러그인이 온다.
 * 부르는 쪽이 `isDesktop()` 뒤에 서는 것까지가 약속이다 — 웹에서 부르면
 * 조용히 null이다.
 *
 * 갱신은 **교사가 누를 때만** 설치한다. 확인은 앱이 하지만, 받고 다시
 * 켜는 것은 사람이 결정한다. 수업 중에 저절로 재시작하는 앱은 도구가
 * 아니라 사고다.
 */

export interface AvailableUpdate {
  version: string;
  /** 릴리스에 적은 안내. 없을 수 있다. */
  notes: string;
  /** 받아서 설치한다. 진행률은 0~1. */
  install: (onProgress: (ratio: number) => void) => Promise<void>;
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update === null) return null;

    return {
      version: update.version,
      notes: update.body ?? '',
      install: async (onProgress) => {
        let total = 0;
        let done = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') total = event.data.contentLength ?? 0;
          else if (event.event === 'Progress') {
            done += event.data.chunkLength;
            if (total > 0) onProgress(Math.min(1, done / total));
          } else if (event.event === 'Finished') onProgress(1);
        });
      },
    };
  } catch {
    /*
     * 인터넷이 없거나 릴리스가 아직 없거나(latest.json 404) 서명이 안
     * 맞거나 — 어느 쪽이든 "새 판 없음"과 같이 다룬다. 갱신 확인이
     * 실패했다고 아침 첫 화면에 빨간 오류를 띄울 일은 아니다.
     */
    return null;
  }
}

export async function relaunch(): Promise<void> {
  const { relaunch: doRelaunch } = await import('@tauri-apps/plugin-process');
  await doRelaunch();
}

/** 지금 설치된 판. 설치형이 아니면 빈 글자. */
export async function currentVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return '';
  }
}
