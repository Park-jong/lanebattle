// 버튼 글자가 정해진 줄 수에 들어가도록 글자 크기를 정하는 순수 함수.
// 줄 수는 호출하는 쪽이 실제 렌더링(Text.getWrappedText)으로 실측해 넘긴다.

/** baseSize부터 1px씩 내려가며 countLines(size) <= maxLines인 첫 크기를 반환. 없으면 minSize */
export function fitFontSize(maxLines: number, baseSize: number, minSize: number, countLines: (size: number) => number): number {
  for (let size = baseSize; size > minSize; size--) {
    if (countLines(size) <= maxLines) return size;
  }
  return minSize;
}
