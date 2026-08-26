/**
 * 급식을 받아 올 학교가 정해졌는가.
 *
 * 둘 다 있어야 NEIS에 물을 수 있다. 그런데 `officeCode`와 `schoolCode`는
 * 서로 따로인 선택 항목이라 **한쪽만 채워진 설정이 저장될 수 있다.**
 * 코드를 손으로 넣던 옛 화면을 쓰던 교사가 그런 상태로 넘어온다.
 *
 * 화면마다 기준이 다르면 설정 화면은 "정해졌습니다"라 하고 홈은 "학교를
 * 정하세요"라 한다. 둘을 같이 본 교사는 무엇을 믿어야 할지 알 수 없고,
 * 어느 쪽도 무엇을 해야 하는지 말해 주지 않는다. 기준은 한 자리에 둔다.
 */
export function hasSchool(
  officeCode: string | undefined,
  schoolCode: string | undefined,
): boolean {
  return (
    officeCode !== undefined && officeCode !== '' && schoolCode !== undefined && schoolCode !== ''
  );
}
