import { AccountPanel } from '../shared/account/AccountPanel';

/**
 * 로그인 경로.
 *
 * 알맹이는 설정의 '계정·동기화' 탭과 같다. 이 경로를 따로 두는 이유는
 * 안내 문서와 오류 메시지가 `/login`을 가리키기 때문이다. 주소를 아는
 * 사람은 바로 올 수 있고, 모르는 사람은 설정에서 만난다.
 */
export default function LoginPage() {
  return <AccountPanel showHomeLink />;
}
