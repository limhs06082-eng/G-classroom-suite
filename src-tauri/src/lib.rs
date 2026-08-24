use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // 단일 인스턴스 잠금이 없으면: 바탕화면 아이콘을 한 번 더 눌렀을 때 두
  // 프로세스가 동시에 뜨고, 각자 학급 자료 전체를 메모리에 올린 채 같은
  // data.json을 통째로 덮어쓴다. 나중에 저장을 끝낸 쪽이 이긴다 — 먼저 쓴
  // 쪽의 변경은 충돌 안내도 없이 조용히 사라진다. 게다가 두 프로세스가
  // 같은 data.json.tmp를 같이 쓰기 때문에, 한쪽의 rename이 다른 쪽이
  // 만들던 임시 파일을 가로채 본 파일도 임시 파일도 없는 순간이 생길 수도
  // 있다. 선생님은 그저 아이콘을 두 번 눌렀을 뿐인데 1년치 학급 기록이
  // 경고 한 줄 없이 날아갈 수 있다는 뜻이다.
  //
  // 그래서 두 번째로 뜬 프로세스는 data.json을 열어보기도 전에 여기서
  // 곧장 끝나고, 이미 떠 있는 창만 앞으로 불러온다. 이 플러그인은 모바일이
  // 없는 개념이라 데스크톱에서만 컴파일되므로(Cargo.toml의 타깃 제한과
  // 짝을 이룬다) #[cfg(desktop)]로 감싼다. Tauri 문서가 요구하는 대로 다른
  // .plugin(...)보다 반드시 먼저 등록한다 — 두 번째 프로세스가 넘겨주고
  // 죽는 일이 다른 플러그인 초기화보다 먼저 일어나야 하기 때문이다.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      // 창을 못 찾는 극히 드문 경우에도 이미 켜져 있던 정상 인스턴스를
      // panic으로 끌고 내려가지 않는다 — 그 인스턴스가 들고 있는 미저장
      // 자료를 지키는 게 여기서 창을 못 띄우는 것보다 훨씬 중요하다.
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }));
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
