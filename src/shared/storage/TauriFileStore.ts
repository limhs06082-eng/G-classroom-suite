import type { FileStore } from './FileStore';

/**
 * Tauri 파일 저장소.
 *
 * 앱 자료 폴더(`%APPDATA%\net.ssamdongne.gboard\`) 안에서만 움직인다.
 * `BaseDirectory.AppData`를 쓰면 경로를 우리가 조립하지 않아도 되고,
 * 운영체제가 달라도 알맞은 자리를 잡아 준다.
 *
 * `@tauri-apps/plugin-fs`는 동적으로 가져온다. 정적으로 부르면 웹 번들에도
 * 실린다 — Firebase를 붙일 때 첫 화면이 조용히 세 배가 된 적이 있다.
 */
export class TauriFileStore implements FileStore {
  /**
   * 없으면 null.
   *
   * 본 파일이 없을 때 `.tmp`를 한 번 더 본다. 이름을 바꾸는 도중에 앱이
   * 죽으면 본 파일은 사라지고 `.tmp`에 온전한 내용이 남는데, 그걸 안 보면
   * 선생님은 자료가 다 날아간 빈 화면을 마주한다. 바이트는 디스크에 멀쩡히
   * 있는데도 그렇다.
   */
  async read(path: string): Promise<string | null> {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const options = { baseDir: BaseDirectory.AppData } as const;

    try {
      if (await exists(path, options)) {
        return await readTextFile(path, options);
      }

      const temporary = `${path}.tmp`;
      if (!(await exists(temporary, options))) return null;

      const rescued = await readTextFile(temporary, options);

      /*
       * 건져 낸 김에 제자리로 옮겨 둔다. 이러지 않으면 켤 때마다 같은
       * 구조를 반복하고, 다음 저장이 이 .tmp를 덮어써 버릴 수도 있다.
       * 옮기다 실패해도 이번에 읽은 내용은 이미 손에 있으니 그냥 넘어간다.
       */
      const { rename } = await import('@tauri-apps/plugin-fs');
      await rename(temporary, path, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      }).catch(() => undefined);

      return rescued;
    } catch {
      // 못 읽는 것과 없는 것을 구별하지 않는다. 부르는 쪽이 할 일이 같다.
      return null;
    }
  }

  /**
   * 임시 파일에 쓴 뒤 이름을 바꿔 치운다.
   *
   * 곧바로 덮어쓰면, 쓰는 도중에 앱이 죽었을 때 반쪽짜리 파일이 남는다.
   * 그건 JSON도 아니라서 한 해치 학급 자료가 그대로 사라진다.
   * 이름 바꾸기는 운영체제가 쪼갤 수 없는 한 동작으로 처리한다.
   */
  async writeAtomic(path: string, text: string): Promise<void> {
    const { writeTextFile, rename, mkdir, exists, BaseDirectory } = await import(
      '@tauri-apps/plugin-fs'
    );

    const options = { baseDir: BaseDirectory.AppData } as const;
    const temporary = `${path}.tmp`;

    // 처음 실행이면 폴더가 아직 없다.
    await mkdir('', { ...options, recursive: true }).catch(() => undefined);

    await writeTextFile(temporary, text, options);

    // 윈도우는 대상이 있으면 rename이 실패한다. 먼저 치운다.
    if (await exists(path, options)) {
      await this.remove(path);
    }

    await rename(temporary, path, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  }

  async remove(path: string): Promise<void> {
    const { remove, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    const options = { baseDir: BaseDirectory.AppData } as const;

    if (await exists(path, options)) {
      await remove(path, options);
    }
  }
}
